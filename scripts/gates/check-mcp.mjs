#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-mcp.mjs
// 触发 MCP 服务协议契约与 SQLite Schema 探查安全测试
// ==============================================================================
import path from "node:path";
import { ROOT, run } from "../lib/exec.mjs";

process.chdir(ROOT);

const res = run(process.execPath, [path.join(ROOT, "scripts", "mcp", "test-client.mjs")], {
  stdio: "inherit",
});
process.exit(res.status ?? 1);
