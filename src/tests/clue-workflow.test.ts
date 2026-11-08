process.env.TEST_MODE = "true";

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { db } from "../db";
import { monopolyClues, clueTimelineLogs, systemAuditLogs, user } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  importCluesAction,
  dispatchClueAction,
  submitHandlingAction,
  reviewClueAction,
  closeClueAction,
  getDashboardDataAction,
  getClueDetailAction,
} from "../app/actions/clues";

describe("专卖监管线索全生命周期状态机与端到端 GWT 场景自动化测试", () => {
  const TEST_CLUE_NOS = [
    "CLUE-2026-E2E-001",
    "CLUE-2026-E2E-002",
    "CLUE-2026-E2E-003",
  ];

  // 测试前后清理环境
  const cleanup = async () => {
    const existing = await db
      .select({ id: monopolyClues.id })
      .from(monopolyClues)
      .where(inArray(monopolyClues.clueNo, TEST_CLUE_NOS));

    if (existing.length > 0) {
      const ids = existing.map((c) => c.id);
      await db.delete(clueTimelineLogs).where(inArray(clueTimelineLogs.clueId, ids));
      await db.delete(monopolyClues).where(inArray(monopolyClues.id, ids));
    }
  };

  before(async () => {
    // 确保测试关联用户存在
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, "test-user-id"));
    if (!existingUser) {
      await db.insert(user).values({
        id: "test-user-id",
        name: "测试综合管理员",
        email: "admin@test.local",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  // ============================================================================
  // GWT 场景 1【正向黄金流转全生命周期闭环】
  // ============================================================================
  test("GWT 场景 1【正向黄金流转全生命周期闭环: 导入 -> 分派 -> 办理 -> 复核通过 -> 归档】", async () => {
    // 1. Given: 综合管理人员已成功导入包含编号 CLUE-2026-E2E-001 的 Excel 台账，初始状态为 PENDING_ASSIGN
    const rows = [
      {
        线索编号: "CLUE-2026-E2E-001",
        发现日期: "2026-11-01",
        所属区域: "城东区",
        线索来源: "日常检查",
        线索类型: "许可证异常",
        经营对象: "诚信便民烟酒超市",
        风险等级: "高",
        涉及金额: 120000,
        责任部门: "",
        责任人: "",
        办理期限: "",
        是否需要复核: "是",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "线索清单");
    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const file = new File([excelBuffer], "clues.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const formData = new FormData();
    formData.append("file", file);

    const importRes = await importCluesAction(formData);
    assert.equal(importRes.ok, true, `导入应当成功: ${importRes.error}`);
    assert.equal(importRes.importedCount, 1);

    const [clue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.clueNo, "CLUE-2026-E2E-001"));
    assert.ok(clue, "数据库中必须已存在导入的线索记录");
    assert.equal(clue.status, "PENDING_ASSIGN", "导入初始状态必须为 PENDING_ASSIGN");

    // 2. When: 综合管理人员选择责任人“李四”，设定办理期限为 7 天后，勾选“需要复核=是”，提交分派
    const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]!;
    const dispatchRes = await dispatchClueAction({
      clueId: clue.id,
      department: "专卖稽查一队",
      handler: "李四",
      deadline: sevenDaysLater,
      needReview: true,
      operatorRole: "综合管理人员",
    });
    assert.equal(dispatchRes.ok, true, `分派应当成功: ${dispatchRes.error}`);

    // 3. Then: 线索状态变更为 IN_PROGRESS
    const [dispatchedClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clue.id));
    assert.equal(dispatchedClue.status, "IN_PROGRESS");
    assert.equal(dispatchedClue.handler, "李四");
    assert.equal(dispatchedClue.department, "专卖稽查一队");
    assert.equal(dispatchedClue.deadline, sevenDaysLater);

    // And: 切换为“李四”角色，该线索出现在待办清单中
    const dashboardData = await getDashboardDataAction({
      handler: "李四",
      status: "IN_PROGRESS",
    });
    assert.equal(dashboardData.ok, true);
    const inLiList = dashboardData.clues.some((c) => c.clueNo === "CLUE-2026-E2E-001");
    assert.equal(inLiList, true, "李四待办列表中必须包含该线索");

    // And: 李四填报核查结论并提交办结后，状态自动跃迁为 PENDING_REVIEW
    const submitRes = await submitHandlingAction({
      clueId: clue.id,
      checkDate: "2026-11-03",
      checkResult: "现场核查属实，存在超范围无证销售新型卷烟行为",
      measures: "依法责令限期整改，现场查扣涉案卷烟 40 条，立案查处",
      operatorRole: "线索核查人员",
    });
    assert.equal(submitRes.ok, true, `办结提交应当成功: ${submitRes.error}`);
    if ("nextStatus" in submitRes) {
      assert.equal(submitRes.nextStatus, "PENDING_REVIEW");
    }

    const [handledClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clue.id));
    assert.equal(handledClue.status, "PENDING_REVIEW");
    assert.ok(handledClue.checkResult?.includes("现场核查属实"));

    // And: 部门负责人点击“复核通过”，状态变更为 COMPLETED
    const reviewRes = await reviewClueAction({
      clueId: clue.id,
      action: "APPROVE",
      comment: "现场核查事实清楚，处置措施规范得当，准予办结",
      operatorRole: "部门负责人",
    });
    assert.equal(reviewRes.ok, true, `复核审批应当成功: ${reviewRes.error}`);
    if ("nextStatus" in reviewRes) {
      assert.equal(reviewRes.nextStatus, "COMPLETED");
    }

    const [reviewedClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clue.id));
    assert.equal(reviewedClue.status, "COMPLETED");
    assert.ok(reviewedClue.reviewComment?.includes("准予办结"));

    // And: 部门负责人点击“归档”，状态变更为 CLOSED，时间轴记录完整 5 步流水
    const closeRes = await closeClueAction({
      clueId: clue.id,
      closeReason: "全流程合规履职闭环，予以结案归档",
      operatorRole: "部门负责人",
    });
    assert.equal(closeRes.ok, true, `归档应当成功: ${closeRes.error}`);

    const [closedClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clue.id));
    assert.equal(closedClue.status, "CLOSED");
    assert.equal(closedClue.closeReason, "全流程合规履职闭环，予以结案归档");

    // 检查时间轴流水
    const timeline = await db
      .select()
      .from(clueTimelineLogs)
      .where(eq(clueTimelineLogs.clueId, clue.id))
      .orderBy(clueTimelineLogs.createdAt);

    assert.equal(timeline.length, 5, `时间轴必须正好有 5 步流水记录，当前为 ${timeline.length}`);
    assert.equal(timeline[0].action, "IMPORT");
    assert.equal(timeline[1].action, "DISPATCH");
    assert.equal(timeline[2].action, "SUBMIT");
    assert.equal(timeline[3].action, "APPROVE");
    assert.equal(timeline[4].action, "CLOSE");
  });

  // ============================================================================
  // GWT 场景 2【终审复核驳回与回退二次办结】
  // ============================================================================
  test("GWT 场景 2【终审复核驳回与回退二次办结: 待复核 -> 驳回回退办理中 -> 补充后再次提交 -> 终审通过】", async () => {
    // 1. Given: 存在一条处于 PENDING_REVIEW（待复核）状态的线索
    const today = new Date().toISOString().split("T")[0]!;
    const [inserted] = await db
      .insert(monopolyClues)
      .values({
        clueNo: "CLUE-2026-E2E-002",
        discoveryDate: today,
        region: "城南区",
        source: "群众举报",
        type: "假冒走私",
        targetName: "顺达便利烟酒行",
        riskLevel: "高",
        amount: 85000,
        department: "专卖稽查二队",
        handler: "王五",
        deadline: today,
        needReview: true,
        status: "PENDING_REVIEW",
        checkDate: today,
        checkResult: "初步查验，缺少抽样照片与完整清单",
        measures: "责令整改",
        userId: "test-user-id",
      })
      .returning();

    assert.ok(inserted);
    assert.equal(inserted.status, "PENDING_REVIEW");

    // 2. When: 部门负责人点击“驳回”并输入原因“缺少现场检查笔录与涉案烟草抽样照片”
    const rejectComment = "缺少现场检查笔录与涉案烟草抽样照片，请补充后重报";
    const rejectRes = await reviewClueAction({
      clueId: inserted.id,
      action: "REJECT",
      comment: rejectComment,
      operatorRole: "部门负责人",
    });
    assert.equal(rejectRes.ok, true, `驳回应当成功: ${rejectRes.error}`);
    if ("nextStatus" in rejectRes) {
      assert.equal(rejectRes.nextStatus, "IN_PROGRESS");
    }

    // 3. Then: 系统阻止进入已完成，线索状态强行回退为 IN_PROGRESS
    const [rejectedClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, inserted.id));
    assert.equal(rejectedClue.status, "IN_PROGRESS", "驳回后状态必须强行原子回退至 IN_PROGRESS");
    assert.equal(rejectedClue.reviewComment, rejectComment);

    // And: 时间轴中新增一条红色驳回事件及附带原因
    const timeline = await db
      .select()
      .from(clueTimelineLogs)
      .where(eq(clueTimelineLogs.clueId, inserted.id));
    const rejectLog = timeline.find((t) => t.action === "REJECT");
    assert.ok(rejectLog, "必须在时间轴中存在 REJECT 驳回记录");
    assert.equal(rejectLog.toStatus, "IN_PROGRESS");
    assert.equal(rejectLog.comment, rejectComment);

    // And: 核查人员李四（此处为王五）重新进入该线索，补充措施后再次提交，状态重新进入 PENDING_REVIEW
    const resubmitRes = await submitHandlingAction({
      clueId: inserted.id,
      checkDate: today,
      checkResult: "已补充现场勘验笔录、执法记录仪视频截图及涉案烟草封存抽样照片",
      measures: "证据链已补齐，完成立案查扣手续并移送处理",
      operatorRole: "线索核查人员",
    });
    assert.equal(resubmitRes.ok, true);
    if ("nextStatus" in resubmitRes) {
      assert.equal(resubmitRes.nextStatus, "PENDING_REVIEW");
    }

    const [resubmittedClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, inserted.id));
    assert.equal(resubmittedClue.status, "PENDING_REVIEW");

    // And: 部门负责人此时复核通过，最终状态成功进入 COMPLETED
    const finalApproveRes = await reviewClueAction({
      clueId: inserted.id,
      action: "APPROVE",
      comment: "补充材料充分详实，事实清楚，复核通过",
      operatorRole: "部门负责人",
    });
    assert.equal(finalApproveRes.ok, true);
    if ("nextStatus" in finalApproveRes) {
      assert.equal(finalApproveRes.nextStatus, "COMPLETED");
    }

    const [finalClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, inserted.id));
    assert.equal(finalClue.status, "COMPLETED");
  });

  // ============================================================================
  // GWT 场景 3【超期时限与非法入参阻断防御】
  // ============================================================================
  test("GWT 场景 3【超期时限与非法入参阻断防御: 过去日期拦截、空责任人拦截、驳回未填原因拦截】", async () => {
    // 1. Given: 分派表单处于打开状态，存在一条处于 PENDING_ASSIGN 的线索
    const today = new Date().toISOString().split("T")[0]!;
    const [clue] = await db
      .insert(monopolyClues)
      .values({
        clueNo: "CLUE-2026-E2E-003",
        discoveryDate: today,
        region: "城西区",
        source: "系统预警",
        type: "经营异常",
        targetName: "万客来超市",
        riskLevel: "中",
        status: "PENDING_ASSIGN",
        userId: "test-user-id",
      })
      .returning();

    assert.ok(clue);

    // 2. When: 经办人员故意将办理期限选择为“昨天”
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]!;
    const pastDateRes = await dispatchClueAction({
      clueId: clue.id,
      department: "专卖稽查一队",
      handler: "张三",
      deadline: yesterday,
      needReview: true,
      operatorRole: "综合管理人员",
    });

    // 3. Then: 服务端拦截，返回校验错误，数据库状态保持 PENDING_ASSIGN 不发生任何改变
    assert.equal(pastDateRes.ok, false);
    assert.ok(pastDateRes.error?.includes("不得早于当前系统日期"));

    let [checkClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clue.id));
    assert.equal(checkClue.status, "PENDING_ASSIGN", "状态必须保持 PENDING_ASSIGN");

    // 4. When: 将责任人置空直接点击提交
    const emptyHandlerRes = await dispatchClueAction({
      clueId: clue.id,
      department: "专卖稽查一队",
      handler: "",
      deadline: today,
      needReview: true,
      operatorRole: "综合管理人员",
    });

    assert.equal(emptyHandlerRes.ok, false);
    [checkClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clue.id));
    assert.equal(checkClue.status, "PENDING_ASSIGN", "责任人为空时状态必须保持 PENDING_ASSIGN");

    // 5. When: 在待复核状态下点击“驳回”但不填写驳回意见
    // 先正常分派并办结流转至 PENDING_REVIEW
    await dispatchClueAction({
      clueId: clue.id,
      department: "专卖稽查一队",
      handler: "张三",
      deadline: today,
      needReview: true,
      operatorRole: "综合管理人员",
    });
    await submitHandlingAction({
      clueId: clue.id,
      checkDate: today,
      checkResult: "核查完成",
      measures: "已下达通知书",
      operatorRole: "线索核查人员",
    });

    // 故意空 comment 驳回
    const emptyCommentRejectRes = await reviewClueAction({
      clueId: clue.id,
      action: "REJECT",
      comment: "",
      operatorRole: "部门负责人",
    });

    // 6. Then: 服务端状态守卫拒绝执行，提示“驳回时必须录入驳回原因”，线索仍保持 PENDING_REVIEW
    assert.equal(emptyCommentRejectRes.ok, false);
    assert.ok(
      emptyCommentRejectRes.error?.includes("驳回原因必填") ||
        emptyCommentRejectRes.error?.includes("必须录入驳回原因")
    );

    [checkClue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clue.id));
    assert.equal(checkClue.status, "PENDING_REVIEW", "驳回原因缺失时状态必须保持 PENDING_REVIEW");

    // 7. Extra Guard: 越权与非法状态机守卫
    // 非部门负责人尝试复核审批 -> 权限拦截
    const illegalRoleReview = await reviewClueAction({
      clueId: clue.id,
      action: "APPROVE",
      operatorRole: "线索核查人员",
    });
    assert.equal(illegalRoleReview.ok, false);
    assert.ok(illegalRoleReview.error?.includes("权限拦截"));

    // 在 PENDING_REVIEW 状态下再次尝试分派 -> 状态机守卫拦截
    const illegalStateDispatch = await dispatchClueAction({
      clueId: clue.id,
      department: "专卖稽查一队",
      handler: "李四",
      deadline: today,
      needReview: true,
      operatorRole: "综合管理人员",
    });
    assert.equal(illegalStateDispatch.ok, false);
    assert.ok(illegalStateDispatch.error?.includes("状态机守卫拦截"));
  });
});
