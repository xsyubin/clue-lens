#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-build.mjs
// Next.js 生产环境构建检查门禁 (隔离 distDir，不污染/清空开发服 .next)
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { ROOT, runNpmScript } from "../lib/exec.mjs";

process.chdir(ROOT);

console.log("=== [Build] 正在执行 Next.js 生产环境编译打包验证 (隔离构建沙盒) ===");
const gateDistDir = path.join(ROOT, ".next-build-gate");

try {
  const success = runNpmScript("build", {
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-build-gate",
    },
  });

  if (!success) {
    console.error("❌ [Build] 生产环境构建失败！");
    process.exit(1);
  }

  console.log("✅ [Build] 生产环境构建成功！");
} finally {
  // 构建验证完成后清理临时构建产物，保持工作区干净
  if (fs.existsSync(gateDistDir)) {
    try {
      fs.rmSync(gateDistDir, { recursive: true, force: true });
    } catch {
      // 忽略清理失败
    }
  }
}
