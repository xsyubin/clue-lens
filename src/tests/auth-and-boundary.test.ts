process.env.TEST_MODE = "true";

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { monopolyClues, user } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  importCluesAction,
  dispatchClueAction,
  submitHandlingAction,
  reviewClueAction,
  closeClueAction,
  generateAdvisoryAction,
  exportCluesAction,
  getClueDetailAction,
  switchDemoRoleAction,
} from "../app/actions/clues";

describe("服务端可信 RBAC 鉴权与 Zod 输入边界全量防卫测试", () => {
  const BOUNDARY_CLUE_NO = "CLUE-BOUNDARY-TEST-001";
  let clueId = "";

  before(async () => {
    // 确保关联测试账号
    const [existing] = await db.select().from(user).where(eq(user.id, "test-user-id"));
    if (!existing) {
      await db.insert(user).values({
        id: "test-user-id",
        name: "测试综合管理员",
        email: "admin@test.local",
        role: "综合管理人员",
        department: "综合办公室",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const [inserted] = await db
      .insert(monopolyClues)
      .values({
        clueNo: BOUNDARY_CLUE_NO,
        discoveryDate: "2026-11-01",
        region: "城北区",
        source: "12313热线",
        type: "假冒商标",
        targetName: "边界测试烟酒店",
        riskLevel: "高",
        status: "PENDING_ASSIGN",
        userId: "test-user-id",
      })
      .returning();
    clueId = inserted.id;
  });

  after(async () => {
    if (clueId) {
      await db.delete(monopolyClues).where(eq(monopolyClues.id, clueId));
    }
  });

  // --------------------------------------------------------------------------
  // 1. 服务端权威角色 RBAC 守卫与客户端角色伪造阻断
  // --------------------------------------------------------------------------
  test("防卫 1: 客户端恶意伪造 operatorRole 为'部门负责人'无法越权复核", async () => {
    // 模拟服务端真实会话为“综合管理人员”
    process.env.TEST_USER_ROLE = "综合管理人员";

    const res = await reviewClueAction({
      clueId,
      action: "APPROVE",
      comment: "恶意客户端尝试复核",
      operatorRole: "部门负责人", // 伪造参数
    });

    assert.equal(res.ok, false);
    assert.equal(res.error, "权限拦截：仅部门负责人允许执行复核审批");
  });

  test("防卫 2: 线索核查人员无法越权执行线索分派与归档", async () => {
    process.env.TEST_USER_ROLE = "线索核查人员";

    const dispatchRes = await dispatchClueAction({
      clueId,
      department: "专卖稽查大队",
      handler: "李四",
      deadline: "2026-11-20",
    });
    assert.equal(dispatchRes.ok, false);
    assert.equal(dispatchRes.error, "权限拦截：仅综合管理人员允许执行线索分派");

    const closeRes = await closeClueAction({
      clueId,
      closeReason: "核查员擅自归档",
    });
    assert.equal(closeRes.ok, false);
    assert.equal(closeRes.error, "权限拦截：仅部门负责人允许执行终审归档");
  });

  test("防卫 3: 部门负责人无法越权提交现场核查办理记录", async () => {
    process.env.TEST_USER_ROLE = "部门负责人";

    const res = await submitHandlingAction({
      clueId,
      checkDate: "2026-11-05",
      checkResult: "负责人直接填写核查",
      measures: "直接下达处罚",
    });
    assert.equal(res.ok, false);
    assert.equal(res.error, "权限拦截：仅线索核查人员允许提交办结结果");
  });

  test("防卫 4: 非综合管理人员无法执行 Excel 台账导入", async () => {
    process.env.TEST_USER_ROLE = "线索核查人员";

    const formData = new FormData();
    const fakeFile = new File(["fake content"], "clues.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    formData.append("file", fakeFile);

    const res = await importCluesAction(formData);
    assert.equal(res.ok, false);
    assert.equal(res.error, "权限拦截：仅综合管理人员允许执行台账导入");
  });

  // --------------------------------------------------------------------------
  // 2. Excel 导入入口 FormData 与文件边界校验
  // --------------------------------------------------------------------------
  test("防卫 5: 上传入口拒绝非法 FormData 与缺失文件封装", async () => {
    process.env.TEST_USER_ROLE = "综合管理人员";

    // 传入非 FormData
    const nonFormDataRes = await importCluesAction({} as any);
    assert.equal(nonFormDataRes.ok, false);
    assert.ok(nonFormDataRes.error?.includes("FormData"));

    // 缺少 file 字段
    const emptyFormData = new FormData();
    const noFileRes = await importCluesAction(emptyFormData);
    assert.equal(noFileRes.ok, false);
    assert.ok(noFileRes.error?.includes("请选择需要上传的 Excel 文件"));
  });

  test("防卫 6: 上传入口拒绝非法后缀文件（如 .exe / .csv / .sh）", async () => {
    process.env.TEST_USER_ROLE = "综合管理人员";

    const formData = new FormData();
    const badFile = new File(["malicious"], "exploit.exe", { type: "application/x-msdownload" });
    formData.append("file", badFile);

    const res = await importCluesAction(formData);
    assert.equal(res.ok, false);
    assert.ok(res.error?.includes("仅支持上传 .xlsx 或 .xls"));
  });

  test("防卫 7: 上传入口拒绝空文件 (0 字节) 与超大文件 (>10MB)", async () => {
    process.env.TEST_USER_ROLE = "综合管理人员";

    // 空文件
    const emptyFormData = new FormData();
    const emptyFile = new File([], "empty.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    emptyFormData.append("file", emptyFile);
    const emptyRes = await importCluesAction(emptyFormData);
    assert.equal(emptyRes.ok, false);
    assert.ok(emptyRes.error?.includes("不可为空"));

    // 超大文件 (模拟 11MB)
    const bigFormData = new FormData();
    const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], "oversized.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    bigFormData.append("file", bigFile);
    const bigRes = await importCluesAction(bigFormData);
    assert.equal(bigRes.ok, false);
    assert.ok(bigRes.error?.includes("10MB"));
  });

  // --------------------------------------------------------------------------
  // 3. 所有 Server Action 的 Zod safeParse 边界校验
  // --------------------------------------------------------------------------
  test("防卫 8: generateAdvisoryAction 严格经过 Zod safeParse 校验非法入参", async () => {
    // 传入非法 uuid
    const badUuidRes = await generateAdvisoryAction("not-a-valid-uuid");
    assert.equal(badUuidRes.ok, false);
    assert.ok(badUuidRes.error?.includes("非法线索 ID"));

    // 传入空参数
    const emptyRes = await generateAdvisoryAction("");
    assert.equal(emptyRes.ok, false);
    assert.ok(emptyRes.error?.includes("非法线索 ID"));

    // 合法 UUID 但线索不存在
    const notFoundRes = await generateAdvisoryAction(crypto.randomUUID());
    assert.equal(notFoundRes.ok, false);
    assert.ok(notFoundRes.error?.includes("未找到目标线索"));
  });

  test("防卫 9: exportCluesAction 严格校验非法导出格式与入参", async () => {
    // 非法 format (如 PDF)
    const badFormatRes = await exportCluesAction("PDF" as any);
    assert.equal(badFormatRes.ok, false);
    assert.ok(badFormatRes.error?.includes("导出格式仅支持 XLSX 或 MARKDOWN"));

    // 传入非法对象结构
    const badObjectRes = await exportCluesAction({ format: "DOCX" } as any);
    assert.equal(badObjectRes.ok, false);
    assert.ok(badObjectRes.error?.includes("导出格式仅支持 XLSX 或 MARKDOWN"));
  });

  test("防卫 10: getClueDetailAction 严格校验非法线索 ID", async () => {
    const badRes = await getClueDetailAction("abc");
    assert.equal(badRes.ok, false);
    assert.ok(badRes.error?.includes("非法线索 ID"));
  });

  test("防卫 11: switchDemoRoleAction 严格限制角色枚举白名单", async () => {
    const badRoleRes = await switchDemoRoleAction({ role: "超级无敌Root管理员" });
    assert.equal(badRoleRes.ok, false);
    assert.ok(badRoleRes.error?.includes("不支持的目标角色") || badRoleRes.error?.includes("目标角色不合法"));

    // 合法角色切换成功
    const goodRoleRes = await switchDemoRoleAction({ role: "部门负责人" });
    assert.equal(goodRoleRes.ok, true);
    assert.equal(goodRoleRes.role, "部门负责人");
  });
});
