#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/04-worktree-isolation.sh
# 场景四：【环境隔离】main 分支踩踏死锁 vs Worktree 物理沙盒
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "04" "环境隔离与真并行 —— main 分支并发踩踏死锁 vs Worktree 物理沙盒" "板块三：3.5 编排基础设施（Subagent 上下文隔离 vs Git Worktree 文件隔离）"

# ------------------------------------------------------------------------------
# 第 1 幕：红屏警报 —— 单目录并发的踩踏地狱与锁死崩溃
# ------------------------------------------------------------------------------
demo_act "1" "野生裸奔：多 Agent 在同一目录并发改代码的死锁惨剧" "$RED"
demo_step "多开发人员或多个 Subagent 同时在 main 分支的主工作区并发开发..."

demo_simulate "Agent A 正在修改 src/db/schema.ts ..."
demo_simulate "Agent B 随后也修改了 src/db/schema.ts 并尝试保存 ..."
sleep 0.8

echo -e "${RED}
[终端致命报错回显]:
------------------------------------------------------------------------
❌ 惨剧 1 [代码覆盖]：Agent B 覆盖了 Agent A 的迁移字段，无声无息丢失改动！
❌ 惨剧 2 [Git 锁死]：fatal: Unable to create '.git/index.lock': File exists.
❌ 惨剧 3 [数据库独占锁死]：SQLITE_BUSY: database is locked (本地 SQLite 并发冲突)！
❌ 惨剧 4 [分支污染]：修改失败后，主目录遗留 20 多个未追踪的脏文件，无法清理！
------------------------------------------------------------------------${RESET}"
demo_fail "致命真相：Subagent 仅仅是给大模型多开了一个上下文窗口，磁盘文件依然在裸奔互踩！"

demo_pause

# ------------------------------------------------------------------------------
# 第 2 幕：绿屏反制 —— clue-lens 主工作区防写围栏 + Worktree 物理沙盒
# ------------------------------------------------------------------------------
demo_act "2" "佩戴 Harness：Worktree 隔离围栏拒止 + 秒级物理沙盒开辟" "$GREEN"
demo_step "展示 rules/08-worktree-workflow.md 架构红线规范..."
demo_run "head -n 20 ${ROOT_DIR}/rules/08-worktree-workflow.md"
head -n 20 "${ROOT_DIR}/rules/08-worktree-workflow.md"

echo ""
demo_step "现场让 Agent 尝试在主工作区 main 分支上直接写入代码..."
demo_run "node ${ROOT_DIR}/scripts/agent/pre-tool-guard.mjs --tool write_file --file \"${ROOT_DIR}/src/app/actions/unsafe-test.ts\""
node "${ROOT_DIR}/scripts/agent/pre-tool-guard.mjs" --tool write_file --file "${ROOT_DIR}/src/app/actions/unsafe-test.ts" || true

echo ""
demo_step "执行正规 Worktree 沙盒创建命令 (1 秒开辟独立分支与目录)..."
demo_run "node ${ROOT_DIR}/scripts/agent/worktree.mjs new demo-sandbox"
node "${ROOT_DIR}/scripts/agent/worktree.mjs" new demo-sandbox

echo ""
demo_step "检查刚创建的独立沙盒目录，验证依赖已通过符号软链共享..."
MAIN_REPO="$(git -C "$ROOT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "$ROOT_DIR")"
# 若当前在 worktree 内，主目录为其父级上一层
if [[ "$MAIN_REPO" == *"/.worktrees/"* ]]; then
  MAIN_REPO="$(cd "$MAIN_REPO/../.." && pwd)"
fi
SANDBOX_DIR="${MAIN_REPO}/.worktrees/clue-lens-demo-sandbox"
if [ -d "$SANDBOX_DIR" ]; then
  ls -la "$SANDBOX_DIR" | grep -E "node_modules|data|\.env" || true
else
  echo -e "${GREEN}沙盒路径: ${SANDBOX_DIR} (已隔离)${RESET}"
fi

echo ""
demo_step "演练完毕，执行 drop 命令一键丢弃沙盒，主分支片叶不沾身..."
demo_run "node ${ROOT_DIR}/scripts/agent/worktree.mjs drop demo-sandbox"
node "${ROOT_DIR}/scripts/agent/worktree.mjs" drop demo-sandbox

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
