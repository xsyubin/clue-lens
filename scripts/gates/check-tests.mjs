#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-tests.mjs
// 全量单元测试、状态机集成测试与 MCP 契约测试门禁
// ==============================================================================
import { ROOT, runNpmScript } from "../lib/exec.mjs";

process.chdir(ROOT);

console.log("=== [Tests] 正在执行全量单元测试与 RBAC 边界防卫集成测试 ===");
if (!runNpmScript("test")) {
  console.error("❌ [Tests] 单元测试未通过！");
  process.exit(1);
}

console.log("=== [MCP Tests] 正在执行 MCP 协议契约与数据安全审计测试 ===");
if (!runNpmScript("test:mcp")) {
  console.error("❌ [Tests] MCP 契约测试未通过！");
  process.exit(1);
}

console.log("✅ [Tests] 全量测试全部通过！");
