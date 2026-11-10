#!/usr/bin/env bash
# ==============================================================================
# scripts/agent/agent-run.sh
# 智能体角色隔离运行入口（委托跨平台 scripts/agent/agent-run.mjs）
# ==============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${DIR}/agent-run.mjs" "$@"
