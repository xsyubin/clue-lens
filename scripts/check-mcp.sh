#!/usr/bin/env bash
# ==============================================================================
# scripts/check-mcp.sh
# 触发 MCP 服务协议与 SQLite Schema 探查测试
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

node scripts/test-mcp.mjs
