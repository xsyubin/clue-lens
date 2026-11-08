#!/usr/bin/env bash
# ==============================================================================
# scripts/run-build.sh
# Next.js 生产环境构建检查门禁
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "=== [Build] 正在执行 Next.js 生产环境编译打包验证 ==="
npm run build
echo "✅ [Build] 生产环境构建成功！"
