#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/05-quality-gate.sh
# 场景五：【门禁定界】假单测闭眼合并 vs 确定性静态安全亮红阻断
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "05" "交付门禁与责任定界 —— 假单测闭眼合并 vs 确定性静态安全亮红阻断" "板块四：4.1~4.4 三层门禁、静态安全扫描与审查定界"

UNSAFE_ACTION="${ROOT_DIR}/src/app/actions/unsafe-mock-demo.ts"

# 清理兜底
cleanup() {
  if [ -f "$UNSAFE_ACTION" ]; then
    rm -f "$UNSAFE_ACTION"
  fi
}
trap cleanup EXIT

# ------------------------------------------------------------------------------
# 第 1 幕：红屏警报 —— 表面全绿、暗埋越权后门的裸奔代码
# ------------------------------------------------------------------------------
demo_act "1" "野生裸奔：单测通过但遗漏鉴权守卫的致命越权漏洞" "$RED"
demo_step "模拟 AI 生成了一个看似完美的线索归档 Server Action..."

cat << 'EOF' > "$UNSAFE_ACTION"
"use server";
// ❌ 致命漏洞：该 Action 没有任何用户会话鉴权！
// 攻击者只要知道 Action ID，可在未登录状态下任意调用，篡改核心监管数据！
export async function archiveClueWithoutAuth(clueId: string) {
  console.log("正在归档线索:", clueId);
  return { ok: true, message: "归档成功" };
}
EOF

echo -e "${RED}
[AI 提交的有毒代码片段 - 极其隐蔽]:
------------------------------------------------------------------------
\"use server\";
// 看似业务逻辑完备，伪单测轻松通过断言
export async function archiveClueWithoutAuth(clueId: string) {
  // 💣 架构红线失守：遗漏了 const session = await requireSession();
  // 外部任何匿名请求均可利用该接口篡改或擦除涉案监管线索！
}
------------------------------------------------------------------------${RESET}"
demo_fail "致命风险：人肉 Code Review 极难一眼发现遗漏，假单测一路绿灯，带病上生产！"

demo_pause

# ------------------------------------------------------------------------------
# 第 2 幕：绿屏反制 —— clue-lens 确定性静态安全扫描亮红阻断
# ------------------------------------------------------------------------------
demo_act "2" "佩戴 Harness：确定性静态门禁 AST 扫描，当场亮红扑灭" "$GREEN"
demo_step "运行 clue-lens 静态安全门禁，拦截无鉴权守卫的 Server Action..."
demo_run "node ${ROOT_DIR}/scripts/gates/check-security.mjs"
node "${ROOT_DIR}/scripts/gates/check-security.mjs" || true

echo ""
demo_step "门禁生效！退出码非 0，CI/CD 流水线与 pre-commit 成功拦截合并！"
demo_step "现在清理掉漏洞文件，重新运行安全门禁..."
rm -f "$UNSAFE_ACTION"

demo_run "node ${ROOT_DIR}/scripts/gates/check-security.mjs"
node "${ROOT_DIR}/scripts/gates/check-security.mjs"

echo ""
demo_step "展示 scripts/review.mjs 产出的确定性机器审查报告 (架构师终审依据)..."
demo_run "head -n 25 ${ROOT_DIR}/evidence/deterministic-review-report.md || true"
head -n 25 "${ROOT_DIR}/evidence/deterministic-review-report.md" || true

demo_pass "确定性机器门禁 100% 发现越权漏洞，并生成机器审查审计证据，架构师责任定界分明！"

demo_pause

# ------------------------------------------------------------------------------
# 第 3 幕：架构师对账卡与金句
# ------------------------------------------------------------------------------
demo_act "3" "架构师对账卡：质量门禁与交付定界方案对比" "$CYAN"
echo -e "${WHITE}
┌──────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 治理维度             │ 无 Harness (人肉抽查+伪单测) │ 有 Harness (确定性机器门禁)  │
├──────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 漏洞捕获时机         │ 上线后被攻击者打爆或审计通报 │ 提交前 0 毫秒由静态门禁掐断  │
│ 鉴权与越权拦截       │ 易遗漏 requireSession 守卫   │ AST 静态语法分析 100% 覆盖   │
│ 交付责任定界         │ 开发与 AI 互踢皮球，责任真空 │ 结构化审计卡，架构师签署交付 │
│ 测试可信度           │ 假 Mock 自嗨，覆盖率欺诈     │ 确定性门禁 + GWT 真实反向对账│
└──────────────────────┴──────────────────────────────┴──────────────────────────────┘${RESET}"

demo_quote "确定性门禁优先，绝不把安全托付给提示词叮嘱。能用静态扫描兜底的，绝不让人肉当查错机！"
