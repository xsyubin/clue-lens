#!/usr/bin/env bash
# ==============================================================================
# scripts/agent/worktree.sh
# 智能体 Worktree 生命周期管理（委托执行跨平台 scripts/agent/worktree.mjs）
# ==============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${DIR}/worktree.mjs" "$@"
