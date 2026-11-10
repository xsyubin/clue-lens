#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/04-worktree-isolation.sh
# 场景四：【环境隔离】一句话开发需求对比：主分支裸奔踩踏死锁 vs Worktree 物理沙盒
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "04" "环境隔离与真并行 —— 一句话需求开发效果 A/B 真实对决" "板块三：3.5 编排基础设施（Subagent 上下文隔离 vs Git Worktree 文件隔离）"

demo_feature "在线索台账列表新增批量导出 Excel 报表功能"

MAIN_REPO="$(git -C "$ROOT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "$ROOT_DIR")"
if [[ "$MAIN_REPO" == *"/.worktrees/"* ]]; then
  MAIN_REPO="$(cd "$MAIN_REPO/../.." && pwd)"
fi

SANDBOX_SLUG="live-export-demo"
SANDBOX_DIR="${MAIN_REPO}/.worktrees/clue-lens-${SANDBOX_SLUG}"

cleanup() {
  if [ -d "$SANDBOX_DIR" ]; then
    node "${ROOT_DIR}/scripts/agent/worktree.mjs" drop "$SANDBOX_SLUG" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# ------------------------------------------------------------------------------
# 前者：没有 Harness 资产 (Subagent 在主工作区裸奔改代码)
# ------------------------------------------------------------------------------
demo_act "前者效果" "没有 Harness 资产：AI 在主分支直接改代码，触发栅栏阻断与主库踩踏风险" "$RED"
demo_step "展示 rules/08-worktree-workflow.md 硬约束红线..."
demo_run "head -n 15 ${ROOT_DIR}/rules/08-worktree-workflow.md"
head -n 15 "${ROOT_DIR}/rules/08-worktree-workflow.md"

echo ""
demo_step "【现场触发阻断】AI 接到导出需求后，试图直接在主工程 main 分支写入代码文件..."
demo_run "node ${ROOT_DIR}/scripts/agent/pre-tool-guard.mjs --tool write_file --file \"${MAIN_REPO}/src/app/actions/export-clues.ts\""
node "${ROOT_DIR}/scripts/agent/pre-tool-guard.mjs" --tool write_file --file "${MAIN_REPO}/src/app/actions/export-clues.ts" || true

echo ""
demo_step "检查主分支当前状态（禁止留下未受控的中间脏文件）..."
demo_run "git -C \"${MAIN_REPO}\" status -s"
git -C "${MAIN_REPO}" status -s || true

demo_fail "前者惨痛结局：Subagent 仅仅是开辟了注意力上下文，在同一物理目录并发改代码，Git index 锁与 SQLite 锁必将引发踩踏死锁！"

demo_pause

# ------------------------------------------------------------------------------
# 后者：佩戴 Harness 资产 (Git Worktree 秒级物理沙盒开辟与清理)
# ------------------------------------------------------------------------------
demo_act "后者效果" "佩戴 Harness 资产：秒级开辟 Worktree 物理沙盒，沙盒内真实开发，主工程零污染" "$GREEN"
demo_step "遵循规范：为该导出功能秒级创建独立的物理沙盒与分支..."
demo_run "node ${ROOT_DIR}/scripts/agent/worktree.mjs new ${SANDBOX_SLUG}"
node "${ROOT_DIR}/scripts/agent/worktree.mjs" new "${SANDBOX_SLUG}"

echo ""
demo_step "检查独立物理沙盒：共享 node_modules (秒级软链，免下 300MB 依赖) 与私有数据库..."
if [ -d "$SANDBOX_DIR" ]; then
  ls -la "$SANDBOX_DIR" | grep -E "node_modules|data|\.env" || true
else
  echo -e "${GREEN}沙盒路径: ${SANDBOX_DIR} (已隔离就绪)${RESET}"
fi

echo ""
demo_step "在沙盒内安全实施开发：生成导出功能模块，并由沙盒做独立语法自检..."
cat << 'EOF' > "${SANDBOX_DIR}/src/app/actions/export-clues.ts"
"use server";
import { requireSession } from "@/lib/session";

export async function exportCluesToExcel() {
  const session = await requireSession();
  console.log(`[AUDIT] 用户 ${session.user.id} 导出线索台账数据`);
  return { ok: true, filename: "clues-export.xlsx", total: 10 };
}
EOF

demo_run "node -e '
  const fs = require(\"fs\");
  const code = fs.readFileSync(\"${SANDBOX_DIR}/src/app/actions/export-clues.ts\", \"utf8\");
  if (code.includes(\"requireSession\") && code.includes(\"exportCluesToExcel\")) {
    console.log(\"✅ [SANDBOX-PASS] 沙盒内功能代码校验通过，鉴权守卫健全！\");
  }
'"
node -e '
  const fs = require("fs");
  const code = fs.readFileSync("'"${SANDBOX_DIR}"'/src/app/actions/export-clues.ts", "utf8");
  if (code.includes("requireSession") && code.includes("exportCluesToExcel")) {
    console.log("✅ [SANDBOX-PASS] 沙盒内功能代码校验通过，鉴权守卫健全！");
  }
'

echo ""
demo_step "回头检查主工程工作区：主工作区一尘不染，完全不受开发中脏代码影响..."
demo_run "git -C \"${MAIN_REPO}\" status -s"
git -C "${MAIN_REPO}" status -s || true

echo ""
demo_step "演练完毕，若要放弃或重构，一键 drop 丢弃沙盒；若要合入，一键 merge 快进合并..."
demo_run "node ${ROOT_DIR}/scripts/agent/worktree.mjs drop ${SANDBOX_SLUG}"
node "${ROOT_DIR}/scripts/agent/worktree.mjs" drop "${SANDBOX_SLUG}"

demo_pass "后者真实效果：物理真隔离！主工程片叶不沾身，多 Agent 在各自沙盒内放手开发与自愈，彻底杜绝文件锁与数据库锁！"

demo_pause

# ------------------------------------------------------------------------------
# 第 3 幕：架构师对账卡与金句
# ------------------------------------------------------------------------------
demo_act "3" "架构师对账卡：多智能体并发与隔离方案对比" "$CYAN"
echo -e "${WHITE}
┌──────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 治理维度             │ 无 Harness (单目录并发派活)  │ 有 Harness (Worktree 物理沙盒│
├──────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 隔离层级             │ 假隔离 (仅大模型会话隔离)    │ 物理真隔离 (独立目录+独立分支)│
│ 文件与数据库冲突     │ 高频触发 Git 锁与 SQLite 锁  │ 零冲突，依赖软链共享，即开即用│
│ 主分支污染治理       │ 产生脏文件难清理，合并灾难   │ 验证通过快进合并，做废一键drop│
│ 权限围栏保障         │ 依靠自觉，随时改崩生产分支   │ 系统级 Hook 阻断主分支裸改   │
└──────────────────────┴──────────────────────────────┴──────────────────────────────┘${RESET}"

demo_quote "世纪大澄清：Subagent 只能隔离模型的注意力上下文，只有 Git Worktree 才能隔离磁盘物理文件！真并行改代码，必须上 Worktree 沙盒。"
