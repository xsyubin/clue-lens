#!/usr/bin/env bash
# ==============================================================================
# scripts/gates/check-mcp.sh
# 触发 MCP 服务协议契约与 SQLite Schema 探查安全测试
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

node scripts/mcp/test-client.mjs
