#!/usr/bin/env bash
# Compatibility alias only.
# This file never calls a model and must not be described as AI review.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "[DEPRECATED] scripts/ai-review.sh 只是兼容别名；请使用 scripts/deterministic-review.sh。" >&2
exec "${ROOT}/scripts/deterministic-review.sh" "$@"
