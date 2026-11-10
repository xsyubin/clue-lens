#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-build.mjs
// Next.js 生产环境构建检查门禁
// ==============================================================================
import { ROOT, runNpmScript } from "../lib/exec.mjs";

process.chdir(ROOT);

console.log("=== [Build] 正在执行 Next.js 生产环境编译打包验证 ===");
if (!runNpmScript("build")) {
  console.error("❌ [Build] 生产环境构建失败！");
  process.exit(1);
}

console.log("✅ [Build] 生产环境构建成功！");
