#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-types.mjs
// 全量 TypeScript 静态类型无死角检查与 ESLint 规范门禁
// ==============================================================================
import { ROOT, runNpmScript } from "../lib/exec.mjs";

process.chdir(ROOT);

console.log("=== [Type Check] 正在执行全量 TypeScript 静态类型无死角检查 ===");
if (!runNpmScript("typecheck")) {
  console.error("❌ [Type Check] TypeScript 类型检查未通过！");
  process.exit(1);
}

console.log("=== [Lint] 正在执行 ESLint 代码静态质量检查 ===");
if (!runNpmScript("lint")) {
  console.error("❌ [Type Check & Lint] ESLint 检查未通过！");
  process.exit(1);
}

console.log("✅ [Type Check & Lint] 静态类型与 Lint 检查全部通过！");
