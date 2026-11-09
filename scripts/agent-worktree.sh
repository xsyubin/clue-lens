#!/usr/bin/env bash
# ==============================================================================
# scripts/agent-worktree.sh
# 智能体改代码的 worktree 完整生命周期管理：
# 开分支 (new) -> 在 worktree 里改和测 -> 门禁验证与快进合并 (merge) / 放弃 (drop)
#
# 约束规范见 rules/08-worktree-workflow.md
#
# 用法：
#   ./scripts/agent-worktree.sh new <slug>     从 main 开 agent/<slug>，建 .worktrees/<slug> 并软链依赖与沙盒环境
#   ./scripts/agent-worktree.sh merge <slug>   在 worktree 中跑全量确定性门禁，全绿后快进合并到 main 并清理
#   ./scripts/agent-worktree.sh drop <slug>    放弃改动：强制移除 worktree 与分支（不合并）
# ==============================================================================
set -euo pipefail

usage() {
  cat <<'EOF' >&2
用法：
  scripts/agent-worktree.sh new <slug>     创建隔离 worktree 并初始化依赖沙盒
  scripts/agent-worktree.sh merge <slug>   验证通过后快进合并到 main 并清理
  scripts/agent-worktree.sh drop <slug>    放弃改动：清理 worktree 与分支
EOF
  exit 2
}

[ $# -eq 2 ] || usage
cmd="$1"
slug="$2"

case "$slug" in
  ""|*/*|.*)
    echo "❌ [WORKTREE] slug 只能是单段名字（不含 / 且不以 . 开头）：$slug" >&2
    exit 2
    ;;
esac

# 查找主工作区根目录（公共 .git 所在目录的上一级）
MAIN_ROOT="$(cd "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || git rev-parse --git-dir)/.." && pwd)"
WT="${WORKTREE_PARENT:-$MAIN_ROOT/../.worktrees}/clue-lens-$slug"
BRANCH="agent/$slug"

case "$cmd" in
  new)
    if [ -e "$WT" ]; then
      echo "❌ [WORKTREE] 目标目录已存在：$WT" >&2
      exit 1
    fi
    if git -C "$MAIN_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
      echo "❌ [WORKTREE] 分支已存在：$BRANCH，请更换 slug 或先执行 drop。" >&2
      exit 1
    fi

    echo "🌱 [WORKTREE] 正在从 main 创建隔离工作树: $BRANCH -> $WT ..."
    mkdir -p "$(dirname "$WT")"
    git -C "$MAIN_ROOT" worktree add -b "$BRANCH" "$WT" main

    # 1. 软链 node_modules (共享数百兆依赖，免去在新 worktree 重装)
    if [ -d "$MAIN_ROOT/node_modules" ]; then
      ln -s "$MAIN_ROOT/node_modules" "$WT/node_modules"
      echo "🔗 [WORKTREE] 已软链共享 node_modules"
    fi

    # 2. 复制环境变量配置
    if [ -f "$MAIN_ROOT/.env" ]; then
      cp "$MAIN_ROOT/.env" "$WT/.env"
      echo "📋 [WORKTREE] 已复制 .env 配置"
    elif [ -f "$MAIN_ROOT/.env.example" ]; then
      cp "$MAIN_ROOT/.env.example" "$WT/.env"
      echo "📋 [WORKTREE] 已从 .env.example 生成 .env"
    fi

    # 3. 复制沙盒 SQLite 数据库（隔离读写，物理规避 database is locked 锁冲突）
    mkdir -p "$WT/data"
    if [ -f "$MAIN_ROOT/data/app.db" ]; then
      cp "$MAIN_ROOT/data/app.db" "$WT/data/app.db"
      echo "📦 [WORKTREE] 已克隆私有沙盒数据库 data/app.db"
    fi

    echo
    echo "=================================================================="
    echo "✅ [WORKTREE] 隔离沙盒创建就绪！"
    echo "  - 工作目录: $WT"
    echo "  - 隔离分支: $BRANCH"
    echo "=================================================================="
    echo "👉 关键提示："
    echo "  1. 之后的代码读写、修改与测试验证，必须全部在 $WT 路径下进行；"
    echo "  2. 严禁改动 $MAIN_ROOT 主工作区文件；"
    echo "  3. 测试全绿后，执行: ./scripts/agent-worktree.sh merge $slug"
    ;;

  merge)
    if [ ! -d "$WT" ]; then
      echo "❌ [WORKTREE] 不存在该 worktree 目录：$WT" >&2
      exit 1
    fi

    # 1. 检查 worktree 是否有未提交的改动
    if [ -n "$(git -C "$WT" status --porcelain)" ]; then
      echo "❌ [WORKTREE] worktree 里还有未提交的改动，必须先在 worktree 提交：" >&2
      git -C "$WT" status --short >&2
      exit 1
    fi

    # 2. 检查主工作区当前是否在 main
    current_main_branch="$(git -C "$MAIN_ROOT" symbolic-ref --short HEAD 2>/dev/null || echo "")"
    if [ "$current_main_branch" != "main" ]; then
      echo "❌ [WORKTREE] 主工作区当前不在 main 分支（当前为: ${current_main_branch:-detached}），拒绝合并" >&2
      exit 1
    fi

    # 3. 检查 main 在此期间是否前进过（必须先变基重跑验证）
    if ! git -C "$WT" merge-base --is-ancestor main HEAD; then
      echo "⚠️ [WORKTREE] main 分支在此期间已前进，正在自动将 $BRANCH 变基到最新 main ..."
      git -C "$WT" rebase main
      echo "🛑 [WORKTREE] 分支已变基成功！因代码基线发生变化，请在 $WT 中重新运行测试和审查门禁，全部通过后再执行 merge。" >&2
      exit 3
    fi

    # 4. 执行确定性前置审查
    echo "🔍 [WORKTREE] 正在执行合并前确定性审查门禁..."
    if [ -x "$WT/scripts/review.sh" ]; then
      (cd "$WT" && ./scripts/review.sh) || {
        echo "❌ [WORKTREE] 审查门禁未通过，已阻断合并！请在 $WT 中排查修复。" >&2
        exit 1
      }
    fi

    # 5. 快进合并并清理
    echo "🚀 [WORKTREE] 正在快进合并到 main ..."
    git -C "$MAIN_ROOT" merge --ff-only "$BRANCH"
    git -C "$MAIN_ROOT" worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
    git -C "$MAIN_ROOT" branch -d "$BRANCH"
    echo "✅ [WORKTREE] 已成功快进合并到 main，并清理了工作树与分支 ${BRANCH}！"
    ;;

  drop)
    echo "🗑️ [WORKTREE] 正在清理丢弃 worktree 与分支..."
    git -C "$MAIN_ROOT" worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
    git -C "$MAIN_ROOT" branch -D "$BRANCH" 2>/dev/null || true
    echo "✅ [WORKTREE] 已丢弃 ${WT} 与分支 ${BRANCH}。"
    ;;

  *)
    usage
    ;;
esac
