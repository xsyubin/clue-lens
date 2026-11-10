#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/02-sdd-clarification.sh
# 场景二：【意图契约】一句话需求开发对比：讨好型脑补放行 vs SDD 状态机守卫
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "02" "意图契约与反向排雷 —— 一句话需求开发效果 A/B 真实对决" "板块二：2.2 说清规格（为什么不能直接丢需求、可判定性与 GWT）"

demo_feature "在线索办结流转时，根据涉案金额自动计算处罚分值并扣减积分"

# ------------------------------------------------------------------------------
# 前者：没有 Harness 资产 (直接丢需求，AI 讨好型脑补代码)
# ------------------------------------------------------------------------------
demo_act "前者效果" "没有 Harness 资产：AI 讨好型顺从，负数金额与跳跃状态全放行" "$RED"
demo_step "模拟没有 SDD 规格时，AI 凭空生成的业务处理函数..."

demo_run "node -e '
  // 前者 AI 生成的代码：没有输入防卫，没有状态机守卫
  function completeClueWithoutSpec(clue, penaltyAmount) {
    // ❌ 漏洞 1: 缺少金额正数防卫，负数也能算分
    // ❌ 漏洞 2: 缺少当前状态校验，新线索未经复核直接办结
    const scoreDeduct = Math.floor(penaltyAmount / 100);
    clue.status = \"COMPLETED\";
    clue.score = (clue.score || 100) - scoreDeduct;
    return { ok: true, clue };
  }

  // 现场用生产脏数据进行真实调用测试：
  const testClue = { id: \"CLUE-001\", status: \"NEW\", score: 100 };
  const dirtyAmount = -50000; // 💣 恶意/异常负数涉案金额

  const result = completeClueWithoutSpec(testClue, dirtyAmount);
  console.log(\"⚠️ [前者执行输出结果]:\", JSON.stringify(result));

  if (result.ok && result.clue.score > 100) {
    console.error(\"💥 [业务逻辑暴击]：负数涉案金额居然导致积分不降反增变成 \" + result.clue.score + \" 分！且从 NEW 直接跳变 COMPLETED！\");
  }
'"
node -e '
  function completeClueWithoutSpec(clue, penaltyAmount) {
    const scoreDeduct = Math.floor(penaltyAmount / 100);
    clue.status = "COMPLETED";
    clue.score = (clue.score || 100) - scoreDeduct;
    return { ok: true, clue };
  }

  const testClue = { id: "CLUE-001", status: "NEW", score: 100 };
  const dirtyAmount = -50000;

  const result = completeClueWithoutSpec(testClue, dirtyAmount);
  console.log("⚠️ [前者执行输出结果]:", JSON.stringify(result));

  if (result.ok && result.clue.score > 100) {
    console.error("💥 [业务逻辑暴击]：负数涉案金额居然导致积分不降反增变成 " + result.clue.score + " 分！且从 NEW 直接跳变 COMPLETED！");
  }
'

demo_fail "前者开发效果：大模型悄悄脑补规则，负数金额导致积分倒涨，状态机瞬间撕裂！"

demo_pause

# ------------------------------------------------------------------------------
# 后者：佩戴 Harness 资产 (SDD requirements.md 状态机与 EARS 契约)
# ------------------------------------------------------------------------------
demo_act "后者效果" "佩戴 Harness 战甲：严格依照 SDD 状态机守卫与 Zod 防卫契约开发" "$GREEN"
demo_step "展示 SDD 规格资产中已固化的专卖线索状态机流转守卫..."
demo_run "grep -E -A 8 '线索状态机定义与跃迁合法性' ${ROOT_DIR}/spec/clue-lens/requirements.md || true"
grep -E -A 8 '线索状态机定义与跃迁合法性' "${ROOT_DIR}/spec/clue-lens/requirements.md" || true

echo ""
demo_step "现场运行严格依照 SDD 规格生成的防卫代码，传入相同的异常脏数据..."
demo_run "node -e '
  const { z } = require(\"zod\");

  // 后者依循 SDD 规格生成的函数：双重守卫
  function completeClueWithSDD(clue, penaltyAmount) {
    // 🛡️ 守卫 1: Zod 涉案金额严格防卫（必须为正整数）
    const amountSchema = z.number().positive({ message: \"涉案金额必须为正数\" });
    const parseRes = amountSchema.safeParse(penaltyAmount);
    if (!parseRes.success) {
      return { ok: false, error: \"输入防卫拦截: \" + parseRes.error.issues[0]?.message };
    }

    // 🛡️ 守卫 2: 状态机前置守卫（必须为 PENDING_REVIEW 待复核状态方可办结）
    if (clue.status !== \"PENDING_REVIEW\") {
      return { ok: false, error: \"状态机守卫拦截: 只有待复核线索可办理办结，当前状态: \" + clue.status };
    }

    const scoreDeduct = Math.floor(penaltyAmount / 100);
    clue.status = \"COMPLETED\";
    clue.score = Math.max(0, (clue.score || 100) - scoreDeduct);
    return { ok: true, clue };
  }

  // 相同脏数据真实运行验证：
  const testClue = { id: \"CLUE-001\", status: \"NEW\", score: 100 };
  const dirtyAmount = -50000;

  const res1 = completeClueWithSDD(testClue, dirtyAmount);
  console.log(\"🛡️ [后者执行输出结果 - 金额校验]:\", JSON.stringify(res1));

  const res2 = completeClueWithSDD(testClue, 50000);
  console.log(\"🛡️ [后者执行输出结果 - 状态机校验]:\", JSON.stringify(res2));
'"
node -e '
  const { z } = require("zod");

  function completeClueWithSDD(clue, penaltyAmount) {
    const amountSchema = z.number().positive({ message: "涉案金额必须为正数" });
    const parseRes = amountSchema.safeParse(penaltyAmount);
    if (!parseRes.success) {
      return { ok: false, error: "输入防卫拦截: " + parseRes.error.issues[0]?.message };
    }

    if (clue.status !== "PENDING_REVIEW") {
      return { ok: false, error: "状态机守卫拦截: 只有待复核线索可办理办结，当前状态: " + clue.status };
    }

    const scoreDeduct = Math.floor(penaltyAmount / 100);
    clue.status = "COMPLETED";
    clue.score = Math.max(0, (clue.score || 100) - scoreDeduct);
    return { ok: true, clue };
  }

  const testClue = { id: "CLUE-001", status: "NEW", score: 100 };
  const dirtyAmount = -50000;

  const res1 = completeClueWithSDD(testClue, dirtyAmount);
  console.log("🛡️ [后者执行输出结果 - 金额校验]:", JSON.stringify(res1));

  const res2 = completeClueWithSDD(testClue, 50000);
  console.log("🛡️ [后者执行输出结果 - 状态机校验]:", JSON.stringify(res2));
'

demo_pass "后者开发效果：Zod 与状态机双重严密守卫，脏数据与非法跃迁被 100% 当场阻断！"

demo_pause

# ------------------------------------------------------------------------------
# 第 3 幕：架构师对账卡与金句
# ------------------------------------------------------------------------------
demo_act "对比总结" "架构师对账卡：需求口径模糊 vs SDD 规格驱动开发效果对比" "$CYAN"
echo -e "${WHITE}
┌──────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 对比维度             │ 前者效果 (口语丢需求裸写)    │ 后者效果 (有 SDD 规格契约)   │
├──────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 业务边界防卫         │ 负数金额放行，逻辑严重错乱   │ Zod safeParse 正数校验防御   │
│ 状态机完整性         │ 从 NEW 强行跳跃办结(状态撕裂)│ 强制校验前置状态(PENDING_REV)│
│ 测试与判定有效性     │ 假 Mock 自嗨，业务逻辑穿透   │ 机器可判定 GWT 契约反向对账  │
│ 线上系统稳定性       │ 业务漏洞百出，数据严重污染   │ 状态流转严丝合缝，零脏数据   │
└──────────────────────┴──────────────────────────────┴──────────────────────────────┘${RESET}"

demo_quote "代码只是规格编译的下游。直接丢需求，等于把架构决策权外包给了大模型的脑补！"
