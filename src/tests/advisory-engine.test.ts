import test from "node:test";
import assert from "node:assert/strict";
import { generateAdvisory } from "../lib/advisory-engine";

test("双模辅助处置建议引擎测试 (advisory-engine.ts)", async (t) => {
  const sampleClue = {
    targetName: "越秀区老王便利店",
    region: "越秀区",
    type: "许可证异常",
    riskLevel: "高",
    amount: 52000,
  };

  await t.test("模式 1: 未开启 AI 时秒级返回内置专家知识库", async () => {
    const res = await generateAdvisory(sampleClue, { useAi: false });
    assert.strictEqual(res.source, "EXPERT_RULE");
    assert.ok(res.direction.includes("停业查封"));
    assert.ok(res.measures.includes("责令停业通知书"));
    assert.ok(res.legalBasis.includes("烟草专卖法"));
    assert.strictEqual(res.fallbackReason, undefined);
  });

  await t.test("模式 2: 开启 AI 但未提供 apiKey 时降级并给出明确提示", async () => {
    const res = await generateAdvisory(sampleClue, { useAi: true, apiKey: "" });
    assert.strictEqual(res.source, "EXPERT_RULE");
    assert.ok(res.fallbackReason?.includes("未检测到大模型密钥"));
  });

  await t.test("模式 3: 模拟 AI 接口成功输出结构化建议", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  direction: "立案查处与无证经营追溯",
                  measures: "1. 现场核验商户营业资质；2. 登记保存涉案烟草制品；3. 移交法规审理。",
                  legalBasis: "《烟草专卖法》第十六条",
                  focusPoints: ["是否存在无证批发", "供货上游链条"],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    try {
      const res = await generateAdvisory(sampleClue, {
        useAi: true,
        apiKey: "test-token",
        model: "mock-llm-v1",
      });
      assert.strictEqual(res.source, "AI_ENHANCED");
      assert.strictEqual(res.direction, "立案查处与无证经营追溯");
      assert.strictEqual(res.modelName, "mock-llm-v1");
      assert.strictEqual(res.focusPoints.length, 2);
      assert.strictEqual(res.focusPoints[0], "是否存在无证批发");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test("模式 4: 模拟 AI 接口 500 异常时优雅降级并附加原因", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("Internal Server Error", { status: 500 });

    try {
      const res = await generateAdvisory(sampleClue, {
        useAi: true,
        apiKey: "test-token",
      });
      assert.strictEqual(res.source, "EXPERT_RULE");
      assert.ok(res.fallbackReason?.includes("HTTP 500"));
      assert.ok(res.measures.length > 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
