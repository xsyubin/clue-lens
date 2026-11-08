#!/usr/bin/env bash
# ==============================================================================
# scripts/check-type.sh
# 全量 TypeScript 静态类型无死角检查门禁
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "=== [Type Check] 正在执行全量 TypeScript 静态类型无死角检查 ==="
npm run typecheck

echo "=== [Lint] 正在执行 ESLint 代码静态质量检查 ==="
npm run lint

echo "✅ [Type Check & Lint] 静态类型与 Lint 检查全部通过！"
