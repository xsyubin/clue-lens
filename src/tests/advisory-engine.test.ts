import test from "node:test";
import assert from "node:assert/strict";
import { generateAdvisory, cleanAdvisoryText } from "../lib/advisory-engine";

test("双模辅助处置建议引擎测试 (advisory-engine.ts)", async (t) => {
  await t.test("文本清洗工具 cleanAdvisoryText 能彻底剔除换行 URL、嵌套括号与外链注脚", () => {
    const dirty1 =
      "对城南区开展核查。([samr.gov.cn](https://www.samr.gov.cn/art_3?utm_source=openai)) 依据[市场监管法条](https://gov.cn)依法处理。";
    const cleaned1 = cleanAdvisoryText(dirty1);
    assert.ok(!cleaned1.includes("https://"));
    assert.ok(!cleaned1.includes("samr.gov.cn"));
    assert.ok(!cleaned1.includes("utm_source"));
    assert.ok(cleaned1.includes("依据市场监管法条依法处理"));

    // 测试带换行与双括号的复杂脏引文（来自大模型真实输出）
    const dirty2 =
      "销售，不认定违法或涉嫌犯罪。([samr.gov.cn]\n(https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/jls/art/2023/art_3da9131ab041449d9af2af886ee33766.html?utm_source=openai))";
    const cleaned2 = cleanAdvisoryText(dirty2);
    assert.strictEqual(cleaned2, "销售，不认定违法或涉嫌犯罪。");

    // 测试未断行的长链接与句中引文
    const dirty3 =
      "依法处理。([samr.gov.cn]\n(https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_4882f33442244df5bd570219964612b7.html))\n3. 分类处置";
    const cleaned3 = cleanAdvisoryText(dirty3);
    assert.ok(!cleaned3.includes("http"));
    assert.ok(!cleaned3.includes("samr.gov.cn"));
    assert.ok(cleaned3.includes("依法处理。"));
    assert.ok(cleaned3.includes("3. 分类处置"));
  });
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
