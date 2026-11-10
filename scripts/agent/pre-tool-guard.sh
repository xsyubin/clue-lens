#!/usr/bin/env bash
# ==============================================================================
# scripts/agent/pre-tool-guard.sh
# 统一 AI 安全护栏 (委托跨平台 scripts/agent/pre-tool-guard.mjs)
# ==============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "${DIR}/pre-tool-guard.mjs" "$@"
