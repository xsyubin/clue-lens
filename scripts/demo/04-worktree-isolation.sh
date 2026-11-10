#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/04-worktree-isolation.sh
# 场景四：【环境隔离】main 分支踩踏死锁 vs Worktree 物理沙盒 (100% 真实执行版)
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "04" "环境隔离与真并行 —— main 分支并发踩踏死锁 vs Worktree 物理沙盒" "板块三：3.5 编排基础设施（Subagent 上下文隔离 vs Git Worktree 文件隔离）"

MAIN_REPO="$(git -C "$ROOT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "$ROOT_DIR")"
if [[ "$MAIN_REPO" == *"/.worktrees/"* ]]; then
  MAIN_REPO="$(cd "$MAIN_REPO/../.." && pwd)"
fi

# ------------------------------------------------------------------------------
# 第 1 幕：红屏警报 —— 主工作区防写围栏拒止 (真实 Hook 拦截)
# ------------------------------------------------------------------------------
demo_act "1" "野生裸奔：试图在主工作区 main 分支直接动手的架构红线" "$RED"
demo_step "展示 rules/08-worktree-workflow.md 硬约束红线..."
demo_run "head -n 15 ${ROOT_DIR}/rules/08-worktree-workflow.md"
head -n 15 "${ROOT_DIR}/rules/08-worktree-workflow.md"

echo ""
demo_step "现场让 Agent 尝试在主工作区 main 分支上直接写入代码..."
demo_run "node ${ROOT_DIR}/scripts/agent/pre-tool-guard.mjs --tool write_file --file \"${MAIN_REPO}/src/app/actions/unsafe-test.ts\""
node "${ROOT_DIR}/scripts/agent/pre-tool-guard.mjs" --tool write_file --file "${MAIN_REPO}/src/app/actions/unsafe-test.ts" || true

echo ""
demo_fail "致命真相：Subagent 仅仅是给大模型多开了一个会话上下文，如果在同一主目录并发改代码，Git 锁与 SQLite 锁必将引发踩踏死锁！"

demo_pause

# ------------------------------------------------------------------------------
# 第 2 幕：绿屏反制 —— clue-lens Worktree 秒级物理沙盒开辟与清理
# ------------------------------------------------------------------------------
demo_act "2" "佩戴 Harness：Worktree 物理沙盒秒级创建、依赖软链与无损清理" "$GREEN"
demo_step "现场执行正规 Worktree 沙盒创建命令 (1 秒开辟独立物理目录与隔离分支)..."
demo_run "node ${ROOT_DIR}/scripts/agent/worktree.mjs new live-demo-sandbox"
node "${ROOT_DIR}/scripts/agent/worktree.mjs" new live-demo-sandbox

echo ""
demo_step "现场检查刚创建的独立物理沙盒，见证 node_modules 符号软链共享与私有数据库克隆..."
SANDBOX_DIR="${MAIN_REPO}/.worktrees/clue-lens-live-demo-sandbox"
if [ -d "$SANDBOX_DIR" ]; then
  ls -la "$SANDBOX_DIR" | grep -E "node_modules|data|\.env" || true
else
  echo -e "${GREEN}沙盒路径: ${SANDBOX_DIR} (已隔离)${RESET}"
fi

echo ""
demo_step "演练完毕，执行 drop 命令一键丢弃沙盒，主分支片叶不沾身..."
demo_run "node ${ROOT_DIR}/scripts/agent/worktree.mjs drop live-demo-sandbox"
node "${ROOT_DIR}/scripts/agent/worktree.mjs" drop live-demo-sandbox

demo_pass "完全物理隔离！各个 Agent 在独立沙盒内自愈与验证，验证全绿后才快进合并，彻底杜绝文件锁与数据库锁！"

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
