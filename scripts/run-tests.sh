#!/usr/bin/env bash
# ==============================================================================
# scripts/run-tests.sh
# 全量单元测试、状态机集成测试与 MCP 契约测试门禁
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "=== [Tests] 正在执行全量单元测试与 RBAC 边界防卫集成测试 ==="
npm test

echo "=== [MCP Tests] 正在执行 MCP 协议契约与数据安全审计测试 ==="
npm run test:mcp

echo "✅ [Tests] 全量测试全部通过！"
