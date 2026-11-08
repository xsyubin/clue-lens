import type { MonopolyClue } from "../db/schema";

export interface AnomalyTag {
  code: string;
  label: string;
  type: "danger" | "warning" | "info";
  detail?: string;
}

export interface AnomalyContext {
  targetCountMap: Map<string, number>;
  region30DaysCountMap: Map<string, number>;
  regionType30DaysCountMap: Map<string, number>;
}

/**
 * 确定性 5 维（+高危待派）异常规则识别纯函数
 * 完全脱离 Web 上下文，纯函数无副作用
 */
export function detectAnomalies(
  clue: Pick<MonopolyClue, "targetName" | "region" | "type" | "amount" | "deadline" | "status" | "riskLevel">,
  context: AnomalyContext,
  nowDate: string = new Date().toISOString().split("T")[0]
): AnomalyTag[] {
  const tags: AnomalyTag[] = [];

  // 1. 重复出现对象判定 (关联全库线索数 >= 2)
  const count = context.targetCountMap.get(clue.targetName) || 1;
  if (count >= 2) {
    tags.push({
      code: "REPEAT_TARGET",
      label: `重复对象(${count}次)`,
      type: "danger",
      detail: `涉案经营主体累计出现 ${count} 次`,
    });
  }

  // 2. 区域短期集中判定 (近30天区域线索 >= 5)
  const regionCount = context.region30DaysCountMap.get(clue.region) || 0;
  if (regionCount >= 5) {
    tags.push({
      code: "REGION_CONCENTRATED",
      label: "区域集中",
      type: "warning",
      detail: `所属区域近30天集中出现 ${regionCount} 条线索`,
    });
  }

  // 3. 同类问题连发 (近30天同区域同类型 >= 3)
  const regionTypeKey = `${clue.region}__${clue.type}`;
  const typeCount = context.regionType30DaysCountMap.get(regionTypeKey) || 0;
  if (typeCount >= 3) {
    tags.push({
      code: "TYPE_REPEATED",
      label: "同类连发",
      type: "warning",
      detail: `同区域近30天高发【${clue.type}】达 ${typeCount} 次`,
    });
  }

  // 4. 涉案金额异常 (金额 >= 100,000 元)
  if (clue.amount >= 100000) {
    tags.push({
      code: "AMOUNT_ABNORMAL",
      label: "金额异常",
      type: "danger",
      detail: `涉及金额 ￥${clue.amount.toLocaleString()} 元`,
    });
  }

  // 5. 办理超期预警 (未完成/未关闭 且 当前日期 > 办理期限)
  if (
    clue.deadline &&
    !["COMPLETED", "CLOSED"].includes(clue.status) &&
    nowDate > clue.deadline
  ) {
    tags.push({
      code: "OVERDUE",
      label: "办理超期",
      type: "danger",
      detail: `已超期！截止时限为 ${clue.deadline}`,
    });
  }

  // 6. 高风险未分派
  if (clue.riskLevel === "高" && clue.status === "PENDING_ASSIGN") {
    tags.push({
      code: "HIGH_RISK_UNASSIGNED",
      label: "高危待派",
      type: "danger",
      detail: "高风险等级线索尚未分派责任人，需紧急处理",
    });
  }

  return tags;
}
