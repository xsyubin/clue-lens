"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  monopolyClues,
  clueTimelineLogs,
  systemAuditLogs,
  type MonopolyClue,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import {
  dispatchClueSchema,
  submitHandlingSchema,
  reviewClueSchema,
  closeClueSchema,
  filterCluesSchema,
} from "@/lib/validations/clue";
import { parseCluesExcel } from "@/lib/excel-parser";
import { detectAnomalies, type AnomalyContext, type AnomalyTag } from "@/lib/anomaly-detector";
import { generateAdvisory } from "@/lib/advisory-engine";
import {
  generateCluesExcelWorkbook,
  generateMarkdownReport,
  type ReportStats,
} from "@/lib/report-exporter";

export type ClueWithTags = MonopolyClue & {
  anomalyTags: AnomalyTag[];
};

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // 忽略在自动化测试或非 HTTP 运行时调用 revalidatePath 的异常
  }
}

/**
 * 1. Excel 台账文件上传与批量 Upsert Action
 */
export async function importCluesAction(formData: FormData) {
  try {
    const session = await requireSession();
    const file = formData.get("file") as File | null;
    if (!file) {
      return { ok: false, error: "请选择需要上传的 Excel 文件" };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parseResult = parseCluesExcel(buffer);

    if (!parseResult.success) {
      return { ok: false, error: parseResult.error || "Excel 解析失败" };
    }

    const { validRows, skippedRows, totalRows } = parseResult;
    if (validRows.length === 0) {
      return {
        ok: false,
        error: "未提取到任何有效线索记录，已跳过全量异常行",
        skippedRows,
      };
    }

    // 在数据库事务中执行基于 clueNo 的 Upsert
    const importedCount = db.transaction((tx) => {
      const clueNos = validRows.map((r) => r.clueNo);
      const existingClues = tx
        .select()
        .from(monopolyClues)
        .where(inArray(monopolyClues.clueNo, clueNos))
        .all();
      const existingMap = new Map(existingClues.map((c) => [c.clueNo, c]));

      let count = 0;
      for (const row of validRows) {
        const existing = existingMap.get(row.clueNo);
        if (existing) {
          // 增量更新已存在线索的属性，保留其既有流转时间轴
          tx.update(monopolyClues)
            .set({
              discoveryDate: row.discoveryDate,
              region: row.region,
              source: row.source,
              type: row.type,
              targetName: row.targetName,
              riskLevel: row.riskLevel,
              amount: row.amount,
              department: row.department ?? existing.department,
              handler: row.handler ?? existing.handler,
              deadline: row.deadline ?? existing.deadline,
              needReview: row.needReview,
              updatedAt: new Date(),
            })
            .where(eq(monopolyClues.id, existing.id))
            .run();
        } else {
          // 新增线索
          const inserted = tx
            .insert(monopolyClues)
            .values({
              clueNo: row.clueNo,
              discoveryDate: row.discoveryDate,
              region: row.region,
              source: row.source,
              type: row.type,
              targetName: row.targetName,
              riskLevel: row.riskLevel,
              amount: row.amount,
              department: row.department,
              handler: row.handler,
              deadline: row.deadline,
              needReview: row.needReview,
              status: row.status ?? "PENDING_ASSIGN",
              userId: session.user.id,
              checkDate: row.checkDate,
              checkResult: row.checkResult,
              measures: row.measures,
              reviewComment: row.reviewComment,
            })
            .returning()
            .get();

          if (inserted) {
            // 写入时间轴初始记录
            tx.insert(clueTimelineLogs).values({
              clueId: inserted.id,
              operatorRole: "综合管理人员",
              operatorName: session.user.name,
              action: "IMPORT",
              fromStatus: null,
              toStatus: inserted.status,
              comment: `Excel 台账导入新增，来源：${row.source}`,
            }).run();
          }
        }
        count++;
      }

      // 记录安全审计日志
      tx.insert(systemAuditLogs).values({
        traceId: crypto.randomUUID(),
        operatorRole: "综合管理人员",
        operatorId: session.user.id,
        action: "IMPORT_CLUES_EXCEL",
        details: JSON.stringify({
          filename: file.name,
          total: totalRows,
          imported: count,
          skipped: skippedRows.length,
        }),
      }).run();

      return count;
    });

    safeRevalidatePath("/clues");
    safeRevalidatePath("/");

    return {
      ok: true,
      totalRows,
      importedCount,
      skippedCount: skippedRows.length,
      skippedRows,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "导入未知异常";
    return { ok: false, error: msg };
  }
}

/**
 * 2. 线索分派 Server Action
 */
export async function dispatchClueAction(input: unknown) {
  try {
    const session = await requireSession();
    const parsed = dispatchClueSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "入参校验失败" };
    }

    const { clueId, department, handler, deadline, needReview, operatorRole } = parsed.data;

    // 办理期限防卫校验：不得早于当前日期
    const today = new Date().toISOString().split("T")[0]!;
    if (deadline < today) {
      return { ok: false, error: "办理期限不得早于当前系统日期" };
    }

    return db.transaction((tx) => {
      // 状态机守卫：仅待分派允许分派
      const existing = tx
        .select()
        .from(monopolyClues)
        .where(eq(monopolyClues.id, clueId))
        .get();

      if (!existing) return { ok: false, error: "线索不存在" };
      if (existing.status !== "PENDING_ASSIGN") {
        return {
          ok: false,
          error: `状态机守卫拦截：当前线索状态为【${existing.status}】，仅允许在【待分派】状态下执行分派`,
        };
      }

      // 更新线索属性与状态
      tx.update(monopolyClues)
        .set({
          department,
          handler,
          deadline,
          needReview,
          status: "IN_PROGRESS",
          updatedAt: new Date(),
        })
        .where(eq(monopolyClues.id, clueId))
        .run();

      // 追加时间轴流水
      tx.insert(clueTimelineLogs).values({
        clueId,
        operatorRole,
        operatorName: session.user.name,
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: `分派至【${department} - ${handler}】，办理期限至 ${deadline}${needReview ? "（需复核）" : ""}`,
      }).run();

      // 追加安全审计日志
      tx.insert(systemAuditLogs).values({
        traceId: crypto.randomUUID(),
        operatorRole,
        operatorId: session.user.id,
        action: "CLUE_DISPATCH",
        targetId: clueId,
        details: JSON.stringify({ department, handler, deadline, needReview }),
      }).run();

      safeRevalidatePath("/clues");
      safeRevalidatePath(`/clues/${clueId}`);
      return { ok: true };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "分派失败";
    return { ok: false, error: msg };
  }
}

/**
 * 3. 登记核查办理与办结提交 Server Action
 */
export async function submitHandlingAction(input: unknown) {
  try {
    const session = await requireSession();
    const parsed = submitHandlingSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "入参校验失败" };
    }

    const { clueId, checkDate, checkResult, measures, operatorRole } = parsed.data;

    return db.transaction((tx) => {
      // 状态机守卫：仅办理中允许提交办结
      const existing = tx
        .select()
        .from(monopolyClues)
        .where(eq(monopolyClues.id, clueId))
        .get();

      if (!existing) return { ok: false, error: "线索不存在" };
      if (existing.status !== "IN_PROGRESS") {
        return {
          ok: false,
          error: `状态机守卫拦截：当前线索状态为【${existing.status}】，仅允许在【办理中】状态下提交办理结果`,
        };
      }

      // 决定流转目标状态
      const nextStatus = existing.needReview ? "PENDING_REVIEW" : "COMPLETED";

      tx.update(monopolyClues)
        .set({
          checkDate,
          checkResult,
          measures,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(monopolyClues.id, clueId))
        .run();

      tx.insert(clueTimelineLogs).values({
        clueId,
        operatorRole,
        operatorName: session.user.name,
        action: "SUBMIT",
        fromStatus: "IN_PROGRESS",
        toStatus: nextStatus,
        comment: `核查完成：${checkResult}；采取措施：${measures}`,
      }).run();

      tx.insert(systemAuditLogs).values({
        traceId: crypto.randomUUID(),
        operatorRole,
        operatorId: session.user.id,
        action: "CLUE_SUBMIT_HANDLING",
        targetId: clueId,
        details: JSON.stringify({ checkDate, nextStatus }),
      }).run();

      safeRevalidatePath("/clues");
      safeRevalidatePath(`/clues/${clueId}`);
      return { ok: true, nextStatus };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "办结提交失败";
    return { ok: false, error: msg };
  }
}

/**
 * 4. 审批复核（通过或驳回退回）Server Action
 */
export async function reviewClueAction(input: unknown) {
  try {
    const session = await requireSession();
    const parsed = reviewClueSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "入参校验失败" };
    }

    const { clueId, action, comment, operatorRole } = parsed.data;

    // 权限守卫：仅部门负责人具备复核资格
    if (operatorRole !== "部门负责人") {
      return { ok: false, error: "权限拦截：仅部门负责人允许执行复核审批" };
    }

    return db.transaction((tx) => {
      // 状态机守卫：仅待复核允许审核
      const existing = tx
        .select()
        .from(monopolyClues)
        .where(eq(monopolyClues.id, clueId))
        .get();

      if (!existing) return { ok: false, error: "线索不存在" };
      if (existing.status !== "PENDING_REVIEW") {
        return {
          ok: false,
          error: `状态机守卫拦截：当前线索状态为【${existing.status}】，仅允许在【待复核】状态下执行审批`,
        };
      }

      // 驳回时目标回退至 IN_PROGRESS，通过时跃迁至 COMPLETED
      const nextStatus = action === "APPROVE" ? "COMPLETED" : "IN_PROGRESS";
      const actionName = action === "APPROVE" ? "APPROVE" : "REJECT";

      tx.update(monopolyClues)
        .set({
          status: nextStatus,
          reviewComment: comment || null,
          updatedAt: new Date(),
        })
        .where(eq(monopolyClues.id, clueId))
        .run();

      tx.insert(clueTimelineLogs).values({
        clueId,
        operatorRole,
        operatorName: session.user.name,
        action: actionName,
        fromStatus: "PENDING_REVIEW",
        toStatus: nextStatus,
        comment: comment || (action === "APPROVE" ? "复核通过，准予结案" : "复核驳回"),
      }).run();

      tx.insert(systemAuditLogs).values({
        traceId: crypto.randomUUID(),
        operatorRole,
        operatorId: session.user.id,
        action: `CLUE_${actionName}`,
        targetId: clueId,
        details: JSON.stringify({ action, nextStatus, comment }),
      }).run();

      safeRevalidatePath("/clues");
      safeRevalidatePath(`/clues/${clueId}`);
      return { ok: true, nextStatus };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "复核审批失败";
    return { ok: false, error: msg };
  }
}

/**
 * 5. 终审归档关闭 Server Action
 */
export async function closeClueAction(input: unknown) {
  try {
    const session = await requireSession();
    const parsed = closeClueSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "入参校验失败" };
    }

    const { clueId, closeReason, operatorRole } = parsed.data;
    if (operatorRole !== "部门负责人") {
      return { ok: false, error: "权限拦截：仅部门负责人允许执行终审归档" };
    }

    return db.transaction((tx) => {
      const existing = tx
        .select()
        .from(monopolyClues)
        .where(eq(monopolyClues.id, clueId))
        .get();

      if (!existing) return { ok: false, error: "线索不存在" };
      if (existing.status !== "COMPLETED") {
        return {
          ok: false,
          error: `状态机守卫拦截：当前线索状态为【${existing.status}】，仅已完成线索允许执行归档关闭`,
        };
      }

      tx.update(monopolyClues)
        .set({
          status: "CLOSED",
          closeReason: closeReason || "正常归档结案",
          updatedAt: new Date(),
        })
        .where(eq(monopolyClues.id, clueId))
        .run();

      tx.insert(clueTimelineLogs).values({
        clueId,
        operatorRole,
        operatorName: session.user.name,
        action: "CLOSE",
        fromStatus: "COMPLETED",
        toStatus: "CLOSED",
        comment: `归档关闭：${closeReason || "结案归档"}`,
      }).run();

      tx.insert(systemAuditLogs).values({
        traceId: crypto.randomUUID(),
        operatorRole,
        operatorId: session.user.id,
        action: "CLUE_CLOSE",
        targetId: clueId,
        details: JSON.stringify({ closeReason }),
      }).run();

      safeRevalidatePath("/clues");
      safeRevalidatePath(`/clues/${clueId}`);
      return { ok: true };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "归档失败";
    return { ok: false, error: msg };
  }
}

/**
 * 6. 生成辅助处置建议 Action
 */
export async function generateAdvisoryAction(clueId: string, useAi?: boolean) {
  try {
    await requireSession();
    const [clue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clueId))
      .limit(1);

    if (!clue) {
      return { ok: false, error: "未找到目标线索" };
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    const advisory = await generateAdvisory(
      {
        type: clue.type,
        riskLevel: clue.riskLevel,
        targetName: clue.targetName,
        region: clue.region,
        amount: clue.amount,
      },
      { useAi, apiKey }
    );

    return { ok: true, advisory };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "建议生成失败";
    return { ok: false, error: msg };
  }
}

/**
 * 7. 多维复合查询与全景大盘统计 Action
 */
export async function getDashboardDataAction(filterInput?: unknown) {
  try {
    await requireSession();
    const parsed = filterCluesSchema.safeParse(filterInput || {});
    const filter = parsed.success ? parsed.data : {};

    // 1. 查询全部线索用于内存高速分析
    const allClues = await db.select().from(monopolyClues);

    // 2. 构建聚合上下文用于异常识别
    const targetCountMap = new Map<string, number>();
    const region30DaysCountMap = new Map<string, number>();
    const regionType30DaysCountMap = new Map<string, number>();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]!;

    for (const c of allClues) {
      targetCountMap.set(c.targetName, (targetCountMap.get(c.targetName) || 0) + 1);
      if (c.discoveryDate >= thirtyDaysAgo) {
        region30DaysCountMap.set(c.region, (region30DaysCountMap.get(c.region) || 0) + 1);
        const rtk = `${c.region}__${c.type}`;
        regionType30DaysCountMap.set(rtk, (regionType30DaysCountMap.get(rtk) || 0) + 1);
      }
    }

    const anomalyContext: AnomalyContext = {
      targetCountMap,
      region30DaysCountMap,
      regionType30DaysCountMap,
    };

    // 3. 计算所有线索的异常标签并进行过滤
    const cluesWithTags: ClueWithTags[] = allClues.map((c) => ({
      ...c,
      anomalyTags: detectAnomalies(c, anomalyContext),
    }));

    // 根据条件过滤
    const filteredClues = cluesWithTags.filter((c) => {
      if (filter.region && c.region !== filter.region) return false;
      if (filter.type && c.type !== filter.type) return false;
      if (filter.riskLevel && c.riskLevel !== filter.riskLevel) return false;
      if (filter.status && c.status !== filter.status) return false;
      if (filter.department && c.department !== filter.department) return false;
      if (filter.handler && c.handler !== filter.handler) return false;
      if (filter.startDate && c.discoveryDate < filter.startDate) return false;
      if (filter.endDate && c.discoveryDate > filter.endDate) return false;
      if (filter.keyword) {
        const kw = filter.keyword.trim().toLowerCase();
        const hit =
          c.clueNo.toLowerCase().includes(kw) ||
          c.targetName.toLowerCase().includes(kw) ||
          c.region.toLowerCase().includes(kw);
        if (!hit) return false;
      }
      if (filter.anomalyTag) {
        if (!c.anomalyTags.some((t) => t.code === filter.anomalyTag)) return false;
      }
      return true;
    });

    // 4. 统计大盘指标
    const stats: ReportStats = {
      total: allClues.length,
      highRisk: allClues.filter((c) => c.riskLevel === "高").length,
      pending: allClues.filter((c) => ["PENDING_ASSIGN", "IN_PROGRESS", "PENDING_REVIEW"].includes(c.status)).length,
      overdue: cluesWithTags.filter((c) => c.anomalyTags.some((t) => t.code === "OVERDUE")).length,
      areaDistribution: Array.from(
        allClues.reduce((m, c) => m.set(c.region, (m.get(c.region) || 0) + 1), new Map<string, number>()).entries()
      ).map(([area, count]) => ({ area, count })),
      typeDistribution: Array.from(
        allClues.reduce((m, c) => m.set(c.type, (m.get(c.type) || 0) + 1), new Map<string, number>()).entries()
      ).map(([type, count]) => ({ type, count })),
    };

    return {
      ok: true,
      stats,
      clues: filteredClues,
      allRegions: Array.from(new Set(allClues.map((c) => c.region))),
      allTypes: Array.from(new Set(allClues.map((c) => c.type))),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "获取大盘数据失败";
    return { ok: false, error: msg, stats: null, clues: [] };
  }
}

/**
 * 8. 查询单个线索详情与时间轴
 */
export async function getClueDetailAction(clueId: string) {
  try {
    await requireSession();
    const [clue] = await db
      .select()
      .from(monopolyClues)
      .where(eq(monopolyClues.id, clueId))
      .limit(1);

    if (!clue) return { ok: false, error: "线索不存在" };

    const timeline = await db
      .select()
      .from(clueTimelineLogs)
      .where(eq(clueTimelineLogs.clueId, clueId))
      .orderBy(clueTimelineLogs.createdAt);

    return { ok: true, clue, timeline };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "获取线索详情失败";
    return { ok: false, error: msg };
  }
}

/**
 * 9. 导出分析报告或台账 Action
 */
export async function exportCluesAction(format: "XLSX" | "MARKDOWN", filterInput?: unknown) {
  try {
    await requireSession();
    const res = await getDashboardDataAction(filterInput);
    if (!res.ok || !res.clues || !res.stats) {
      return { ok: false, error: "无可导出的数据" };
    }

    const { clues, stats } = res;

    if (format === "XLSX") {
      const buffer = generateCluesExcelWorkbook(clues);
      const base64 = buffer.toString("base64");
      return {
        ok: true,
        filename: `专卖监管线索台账_${new Date().toISOString().split("T")[0]}.xlsx`,
        fileBase64: base64,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    } else {
      // 提取重复经营对象
      const topRepeatTargets = Array.from(
        clues.reduce((m, c) => m.set(c.targetName, (m.get(c.targetName) || 0) + 1), new Map<string, number>()).entries()
      )
        .filter(([, count]) => count >= 2)
        .map(([targetName, count]) => ({ targetName, count }));

      // 提取超期清单
      const overdueList = clues.filter((c) => c.anomalyTags.some((t) => t.code === "OVERDUE"));

      const markdownContent = generateMarkdownReport(stats, topRepeatTargets, overdueList);
      return {
        ok: true,
        filename: `专卖监管线索研判报告_${new Date().toISOString().split("T")[0]}.md`,
        content: markdownContent,
        contentType: "text/markdown; charset=utf-8",
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "导出失败";
    return { ok: false, error: msg };
  }
}
