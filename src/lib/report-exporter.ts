import * as XLSX from "xlsx";
import type { MonopolyClue } from "../db/schema";

export interface ReportStats {
  total: number;
  highRisk: number;
  pending: number;
  overdue: number;
  areaDistribution: { area: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
}

/**
 * 生成多 Sheet 统计台账 Excel Buffer
 */
export function generateCluesExcelWorkbook(clues: MonopolyClue[]): Buffer {
  const workbook = XLSX.utils.book_new();

  // 1. Sheet 1: 线索明细清单
  const detailData = clues.map((item) => ({
    线索编号: item.clueNo,
    发现日期: item.discoveryDate,
    所属区域: item.region,
    线索来源: item.source,
    线索类型: item.type,
    经营对象: item.targetName,
    风险等级: item.riskLevel,
    涉案金额: item.amount,
    责任部门: item.department || "未分派",
    责任人: item.handler || "未指定",
    办理期限: item.deadline || "无",
    办理状态: item.status,
    核查时间: item.checkDate || "-",
    核查结果: item.checkResult || "-",
    处置措施: item.measures || "-",
    复核意见: item.reviewComment || "-",
  }));

  const detailSheet = XLSX.utils.json_to_sheet(detailData);
  XLSX.utils.book_append_sheet(workbook, detailSheet, "线索明细清单");

  // 2. Sheet 2: 区域与类型统计汇总
  const areaCountMap = new Map<string, number>();
  const typeCountMap = new Map<string, number>();

  for (const c of clues) {
    areaCountMap.set(c.region, (areaCountMap.get(c.region) || 0) + 1);
    typeCountMap.set(c.type, (typeCountMap.get(c.type) || 0) + 1);
  }

  const summaryData = [
    { 统计维度: "=== 按区域分布统计 ===", 分类项: "", 线索条数: "" },
    ...Array.from(areaCountMap.entries()).map(([k, v]) => ({
      统计维度: "区域分布",
      分类项: k,
      线索条数: String(v),
    })),
    { 统计维度: "=== 按问题类型统计 ===", 分类项: "", 线索条数: "" },
    ...Array.from(typeCountMap.entries()).map(([k, v]) => ({
      统计维度: "问题类型",
      分类项: k,
      线索条数: String(v),
    })),
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "数据统计汇总");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

/**
 * 结构化生成 Markdown 研判分析初稿
 */
export function generateMarkdownReport(
  stats: ReportStats,
  topRepeatTargets: { targetName: string; count: number }[],
  overdueList: MonopolyClue[]
): string {
  const nowStr = new Date().toISOString().split("T")[0];

  const lines: string[] = [
    `# 专卖监管线索态势研判与闭环处置分析报告`,
    ``,
    `> **研判日期**: ${nowStr}  `,
    `> **报告生成主体**: 专卖监督管理与情报分析工作台  `,
    `> **密级与时效**: 内部业务研判 / 实时态势  `,
    ``,
    `---`,
    ``,
    `## 一、全盘总体态势概览`,
    ``,
    `- **当前全库线索总数**: **${stats.total}** 条`,
    `- **高风险重点线索**: **${stats.highRisk}** 条（占比约 ${stats.total > 0 ? ((stats.highRisk / stats.total) * 100).toFixed(1) : 0}%）`,
    `- **处于流转办理中/待办**: **${stats.pending}** 条`,
    `- **当前已超期未办结事项**: **${stats.overdue}** 条（需重点催办）`,
    ``,
    `### 1.1 线索类型分布 TOP 榜`,
    `| 排名 | 线索异常类型 | 线索数量 | 占比 |`,
    `|---|---|---|---|`,
  ];

  stats.typeDistribution.forEach((t, i) => {
    const pct = stats.total > 0 ? ((t.count / stats.total) * 100).toFixed(1) : "0.0";
    lines.push(`| 第 ${i + 1} 名 | ${t.type} | ${t.count} 条 | ${pct}% |`);
  });

  lines.push(
    ``,
    `### 1.2 区域线索分布特征`,
    `| 区域 | 线索总量 | 风险评注 |`,
    `|---|---|---|`
  );

  stats.areaDistribution.forEach((a) => {
    lines.push(`| ${a.area} | ${a.count} 条 | ${a.count >= 5 ? "⚠️ 短期集中预警" : "正常平稳"} |`);
  });

  lines.push(
    ``,
    `---`,
    ``,
    `## 二、重点高危主体与异常特征探查`,
    ``,
    `### 2.1 重复出现涉案经营对象 (累犯/重点监控清单)`,
    `| 经营主体对象名称 | 历史关联线索频次 | 处置建议与管控级别 |`,
    `|---|---|---|`
  );

  if (topRepeatTargets.length === 0) {
    lines.push(`| (暂无重复出现对象) | - | 状态良好 |`);
  } else {
    topRepeatTargets.forEach((tgt) => {
      lines.push(`| **${tgt.targetName}** | 累计 ${tgt.count} 次 | 建议纳入季度重点双随机抽检黑名单 |`);
    });
  }

  lines.push(
    ``,
    `### 2.2 超期未结案警示清单`,
    `| 线索编号 | 经营对象 | 责任部门/责任人 | 办理时限 | 当前状态 |`,
    `|---|---|---|---|---|`
  );

  if (overdueList.length === 0) {
    lines.push(`| (全盘暂无超期事项) | - | - | - | 全部按期闭环 |`);
  } else {
    overdueList.forEach((o) => {
      lines.push(`| ${o.clueNo} | ${o.targetName} | ${o.department || "未分派"} / ${o.handler || "未指定"} | ${o.deadline || "-"} | ${o.status} |`);
    });
  }

  lines.push(
    ``,
    `---`,
    ``,
    `## 三、后续闭环处置与监管工作建议`,
    ``,
    `1. **强化对高频涉案对象的穿透式稽查**：针对出现 $\\ge 2$ 次以上的重复对象，由稽查支队成立专项核查组突击检查仓储暗格。`,
    `2. **压实办理时限与催办督导**：督促各基层专卖所对超期线索在 3 个工作日内完成现场检查并反馈核查笔录。`,
    `3. **健全跨部门复核把关机制**：部门负责人应对高风险办结线索实施 100% 抽样复核，确保整改闭环不走过场。`,
    ``
  );

  return lines.join("\n");
}
