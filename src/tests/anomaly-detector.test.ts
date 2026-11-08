import test from "node:test";
import assert from "node:assert/strict";
import { detectAnomalies, type AnomalyContext } from "../lib/anomaly-detector";

test("异常规则引擎单元测试", async (t) => {
  const mockContext: AnomalyContext = {
    targetCountMap: new Map([
      ["诚信烟酒商行", 3],
      ["合规便利店", 1],
    ]),
    region30DaysCountMap: new Map([
      ["城东区", 6],
      ["城北区", 2],
    ]),
    regionType30DaysCountMap: new Map([
      ["城东区__许可证异常", 4],
      ["城北区__价格异常", 1],
    ]),
  };

  await t.test("重复经营对象判定 (>=2条打标，1条不打标)", () => {
    const clueWithRepeat = {
      targetName: "诚信烟酒商行",
      region: "城北区",
      type: "价格异常",
      amount: 5000,
      deadline: "2026-12-31",
      status: "IN_PROGRESS",
      riskLevel: "中",
    };
    const tags = detectAnomalies(clueWithRepeat, mockContext, "2026-11-01");
    assert.ok(tags.some((tag) => tag.code === "REPEAT_TARGET"));
    assert.strictEqual(tags.find((tag) => tag.code === "REPEAT_TARGET")?.label, "重复对象(3次)");

    const clueWithoutRepeat = {
      ...clueWithRepeat,
      targetName: "合规便利店",
    };
    const tagsNormal = detectAnomalies(clueWithoutRepeat, mockContext, "2026-11-01");
    assert.ok(!tagsNormal.some((tag) => tag.code === "REPEAT_TARGET"));
  });

  await t.test("区域短期集中与同类连发判定", () => {
    const clue = {
      targetName: "合规便利店",
      region: "城东区",
      type: "许可证异常",
      amount: 1000,
      deadline: "2026-12-31",
      status: "IN_PROGRESS",
      riskLevel: "低",
    };
    const tags = detectAnomalies(clue, mockContext, "2026-11-01");
    assert.ok(tags.some((tag) => tag.code === "REGION_CONCENTRATED"));
    assert.ok(tags.some((tag) => tag.code === "TYPE_REPEATED"));
  });

  await t.test("涉案金额异常判定 (>=100,000 元)", () => {
    const clueBigAmount = {
      targetName: "合规便利店",
      region: "城北区",
      type: "价格异常",
      amount: 120000,
      deadline: "2026-12-31",
      status: "IN_PROGRESS",
      riskLevel: "中",
    };
    const tags = detectAnomalies(clueBigAmount, mockContext, "2026-11-01");
    assert.ok(tags.some((tag) => tag.code === "AMOUNT_ABNORMAL"));

    const clueSmallAmount = {
      ...clueBigAmount,
      amount: 99999,
    };
    const tagsSmall = detectAnomalies(clueSmallAmount, mockContext, "2026-11-01");
    assert.ok(!tagsSmall.some((tag) => tag.code === "AMOUNT_ABNORMAL"));
  });

  await t.test("办理超期预警与结案状态豁免", () => {
    const overdueClue = {
      targetName: "合规便利店",
      region: "城北区",
      type: "价格异常",
      amount: 500,
      deadline: "2026-10-31",
      status: "IN_PROGRESS",
      riskLevel: "中",
    };
    // 当前日期为 2026-11-01，已晚于 2026-10-31
    const tagsOverdue = detectAnomalies(overdueClue, mockContext, "2026-11-01");
    assert.ok(tagsOverdue.some((tag) => tag.code === "OVERDUE"));

    // 若已经结案（COMPLETED 或 CLOSED），即使日期晚于时限也不标记超期
    const completedClue = {
      ...overdueClue,
      status: "COMPLETED",
    };
    const tagsCompleted = detectAnomalies(completedClue, mockContext, "2026-11-01");
    assert.ok(!tagsCompleted.some((tag) => tag.code === "OVERDUE"));
  });

  await t.test("高风险未分派判定", () => {
    const highRiskUnassigned = {
      targetName: "合规便利店",
      region: "城北区",
      type: "价格异常",
      amount: 500,
      deadline: null,
      status: "PENDING_ASSIGN",
      riskLevel: "高",
    };
    const tags = detectAnomalies(highRiskUnassigned, mockContext, "2026-11-01");
    assert.ok(tags.some((tag) => tag.code === "HIGH_RISK_UNASSIGNED"));
  });
});
