#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/05-quality-gate.sh
# 场景五：【门禁定界】一句话开发需求对比：表面假单测全绿 vs 确定性静态安全亮红阻断
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "05" "交付门禁与责任定界 —— 一句话需求开发效果 A/B 真实对决" "板块四：4.1~4.4 三层门禁、静态安全扫描与审查定界"

demo_feature "为专卖监管系统开发一个线索快速归档的 Server Action (archiveClue)"

UNSAFE_ACTION="${ROOT_DIR}/src/app/actions/unsafe-archive.tmp.ts"
SAFE_ACTION="${ROOT_DIR}/src/app/actions/safe-archive.tmp.ts"

cleanup() {
  rm -f "$UNSAFE_ACTION" "$SAFE_ACTION"
}
trap cleanup EXIT

# ------------------------------------------------------------------------------
# 前者：没有 Harness 资产 (AI 生成缺少会话鉴权的 Action，伪单测闭眼全绿)
# ------------------------------------------------------------------------------
demo_act "前者效果" "没有 Harness 资产：单测断言全部绿灯，但暗埋致命越权后门" "$RED"
demo_step "AI 产出一个看似业务完备的 Server Action..."

cat << 'EOF' > "$UNSAFE_ACTION"
"use server";
// ❌ 致命越权漏洞：没有任何用户身份验证与会话检查！
// 外部任何匿名攻击者只要拿到 Action ID，即可无门槛调用，擦除/篡改监管案由！
export async function archiveClueWithoutAuth(clueId: string) {
  console.log("正在归档线索:", clueId);
  return { ok: true, message: "归档成功" };
}
EOF

echo -e "${RED}
[前者 AI 产出的代码片段 (缺少鉴权守卫)]:
------------------------------------------------------------------------
\"use server\";
export async function archiveClueWithoutAuth(clueId: string) {
  // 💣 架构红线失守：遗漏了 const session = await requireSession();
  console.log(\"正在归档线索:\", clueId);
  return { ok: true, message: \"归档成功\" };
}
------------------------------------------------------------------------${RESET}"

demo_step "运行常规单元测试或业务断言..."
demo_run "node -e '
  // 模拟单测执行：只测试入参返回
  const result = { ok: true, message: \"归档成功\" };
  console.log(\"🧪 [UNIT TEST]: expect(result.ok).toBe(true) -> PASS\");
  console.log(\"🧪 [UNIT TEST]: expect(result.message).toBe(\\\"归档成功\\\") -> PASS\");
  console.log(\"✅ 假单测全部绿灯通过！\");
'"
node -e '
  const result = { ok: true, message: "归档成功" };
  console.log("🧪 [UNIT TEST]: expect(result.ok).toBe(true) -> PASS");
  console.log("🧪 [UNIT TEST]: expect(result.message).toBe(\"归档成功\") -> PASS");
  console.log("✅ 假单测全部绿灯通过！");
'

echo ""
demo_step "【现场启动静态安全门禁】运行 check-security.mjs 进行 AST 架构红线扫描..."
demo_run "node ${ROOT_DIR}/scripts/gates/check-security.mjs"
node "${ROOT_DIR}/scripts/gates/check-security.mjs" || true

echo ""
demo_fail "前者惨痛结局：表面单测一路绿灯闭眼放行，致命越权后门带病上线，任何人无需登录即可任意归档销毁监管线索！"

demo_pause

# ------------------------------------------------------------------------------
# 后者：佩戴 Harness 资产 (确定性静态安全门禁 + 补齐鉴权 + 终审报告)
# ------------------------------------------------------------------------------
demo_act "后者效果" "佩戴 Harness 资产：静态门禁硬约束，补齐鉴权与 Zod 守卫，生成交付定界报告" "$GREEN"
demo_step "遵循架构规范，生成具备会话鉴权与 Zod 校验的合规 Action..."

rm -f "$UNSAFE_ACTION"

cat << 'EOF' > "$SAFE_ACTION"
"use server";
import { requireSession } from "@/lib/session";
import { z } from "zod";

const archiveSchema = z.object({
  clueId: z.string().min(1, "线索编号不能为空"),
});

export async function archiveClue(rawInput: unknown) {
  // 🛡️ 架构红线守卫 1: 会话鉴权门禁
  const session = await requireSession();

  // 🛡️ 架构红线守卫 2: Zod 严格校验
  const parsed = archiveSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  // 🛡️ 架构红线守卫 3: 操作审计日志
  console.log(`[AUDIT] 经办民警 ${session.user.id} 归档线索 ${parsed.data.clueId}`);
  return { ok: true, message: "归档完成" };
}
EOF

echo -e "${GREEN}
[后者合规代码 (src/app/actions/safe-archive.tmp.ts)]:
------------------------------------------------------------------------
\"use server\";
import { requireSession } from \"@/lib/session\";
import { z } from \"zod\";

export async function archiveClue(rawInput: unknown) {
  const session = await requireSession(); // 🛡️ 会话鉴权守卫
  const parsed = archiveSchema.safeParse(rawInput); // 🛡️ Zod 校验守卫
  ...
}
------------------------------------------------------------------------${RESET}"

demo_step "再次运行 clue-lens 全栈静态安全门禁..."
demo_run "node ${ROOT_DIR}/scripts/gates/check-security.mjs"
node "${ROOT_DIR}/scripts/gates/check-security.mjs"

echo ""
demo_step "展示 scripts/review.mjs 产出的确定性机器审查报告 (架构师终审定界证据)..."
demo_run "head -n 25 ${ROOT_DIR}/evidence/deterministic-review-report.md || true"
head -n 25 "${ROOT_DIR}/evidence/deterministic-review-report.md" || true

demo_pass "后者真实效果：静态门禁 AST 扫描 100% 扑灭暗病，倒逼补齐鉴权与 Zod 守卫，提供确定性交付定界凭据！"

demo_pause

# ------------------------------------------------------------------------------
# 第 3 幕：架构师对账卡与金句
# ------------------------------------------------------------------------------
demo_act "3" "架构师对账卡：交付门禁与质量保障机制对比" "$CYAN"
echo -e "${WHITE}
┌──────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 治理维度             │ 无 Harness (依赖单测与人肉CR)│ 有 Harness (确定性静态三层门禁│
├──────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 漏洞捕获能力         │ 测逻辑不测权限，假单测全绿  │ AST 扫描 100% 拦截无鉴权接口 │
│ 审查主观性           │ 人肉 CR 疲劳漏审，容易被蒙蔽 │ 机器门禁无死角，红线绝对不妥协│
│ 归档与追责依据       │ 无存证，事故后扯皮推诿       │ 自动化产出《架构审计卡》留痕 │
│ CI/CD 集成门禁       │ 退出码不敏感，常被带病合并   │ 阻断项非 0 退出，流水线直接拒止│
└──────────────────────┴──────────────────────────────┴──────────────────────────────┘${RESET}"

demo_quote "单测只能证明代码按写的人的逻辑跑通了，证明不了代码没有埋下安全炸弹！确定性静态门禁才是架构师的保命锁。"
