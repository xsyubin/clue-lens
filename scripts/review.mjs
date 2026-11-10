#!/usr/bin/env node
// ==============================================================================
// scripts/review.mjs
// 跨平台确定性机器审查总控门禁 (Node.js ESM)
// 驱动 scripts/review-checks.list 并生成审计报告
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const isWindows = process.platform === "win32";
const REPORT_FILE = process.env.DETERMINISTIC_REVIEW_REPORT_FILE || path.join(ROOT, "evidence", "deterministic-review-report.md");
const CHECKS_FILE = process.env.DETERMINISTIC_REVIEW_CHECKS_FILE || path.join(ROOT, "scripts", "review-checks.list");

fs.mkdirSync(path.join(ROOT, "evidence"), { recursive: true });

if (!fs.existsSync(CHECKS_FILE)) {
  console.error(`[PRE-REVIEW] 检查清单不存在：${CHECKS_FILE}`);
  process.exit(2);
}

const args = process.argv.slice(2);
const isStaged = args.includes("--staged") || args.includes("--cached");
const diffName = isStaged ? "Git Staged (暂存区变更)" : "本地完整工作区";

console.log("=== [Deterministic Review] 开始执行确定性前置门禁 ===");
console.log(`审查范围: ${diffName}`);
console.log(`配置文件: ${path.relative(ROOT, CHECKS_FILE)}`);
console.log("--------------------------------------------------");

const lines = fs.readFileSync(CHECKS_FILE, "utf8").split(/\r?\n/);
let failures = 0;
const results = [];

for (const rawLine of lines) {
  const check = rawLine.trim();
  if (!check || check.startsWith("#")) continue;

  const fullPath = path.resolve(ROOT, check);
  if (!fs.existsSync(fullPath)) {
    results.push({ status: "FAIL", check, note: "脚本不存在" });
    failures++;
    console.error(`❌ [MISSING] 未找到检查脚本: ${check}`);
    continue;
  }

  console.log(`>>> 执行检查: ${check}`);

  let child;
  if (check.endsWith(".mjs") || check.endsWith(".js")) {
    child = spawnSync(process.execPath, [fullPath, ...args], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
  } else if (check.endsWith(".sh")) {
    // Windows 下不猜测 bash 解释器（可能误连 WSL bash），直接 fail-loud 提示迁移
    if (isWindows) {
      console.error(`❌ [UNSUPPORTED] Windows 不支持 shell 检查项，请改用 Node.js ESM (.mjs) 脚本: ${check}`);
      results.push({ status: "FAIL", check, note: "Windows 不支持 shell 检查项" });
      failures++;
      continue;
    }
    child = spawnSync(fullPath, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
  } else {
    child = spawnSync(fullPath, args, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
  }

  const exitCode = child.status ?? (child.error ? 1 : 0);
  if (exitCode === 0) {
    results.push({ status: "PASS", check, note: "正常通过" });
  } else {
    results.push({ status: "FAIL", check, note: `exit=${exitCode}` });
    failures++;
  }
  console.log("--------------------------------------------------");
}

const reportContent = [
  "# 确定性机器前置审查报告 (clue-lens)",
  "",
  `- **检查清单**: \`${path.relative(ROOT, CHECKS_FILE)}\``,
  `- **总决议**: ${failures === 0 ? "✅ PASS (全部通过)" : "❌ FAIL (存在阻断问题)"}`,
  `- **门禁状态**: ${failures === 0 ? `全部 ${results.length}/${results.length} 项门禁通过` : `${failures} 项未通过`}`,
  "",
  "| 检查项 | 状态 | 详情 / 备注 |",
  "|---|---|---|",
  ...results.map((r) =>
    r.status === "PASS"
      ? `| \`${r.check}\` | 🟢 PASS | ${r.note} |`
      : `| \`${r.check}\` | 🔴 FAIL | ${r.note} |`
  ),
  "",
].join("\n");

const existingContent = fs.existsSync(REPORT_FILE) ? fs.readFileSync(REPORT_FILE, "utf8") : "";
if (existingContent.trim() !== reportContent.trim()) {
  fs.writeFileSync(REPORT_FILE, reportContent, "utf8");
  console.log();
  console.log(`=== 审查报告已更新: ${path.relative(ROOT, REPORT_FILE)} ===`);
} else {
  console.log();
  console.log(`=== 审查报告内容无变化，保持幂等: ${path.relative(ROOT, REPORT_FILE)} ===`);
}
if (failures > 0) {
  console.error(`❌ 确定性前置门禁失败，共发现 ${failures} 项未通过！`);
  process.exit(1);
}

console.log("✅ 所有确定性门禁检查项全部通过！");
process.exit(0);
