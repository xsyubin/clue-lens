#!/usr/bin/env bash
# ==============================================================================
# scripts/review.sh
# 确定性机器审查总控门禁（委托执行跨平台 scripts/review.mjs）
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "${ROOT}/scripts/review.mjs" "$@"
