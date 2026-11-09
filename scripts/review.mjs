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
const REPORT_FILE = path.join(ROOT, "evidence", "deterministic-review-report.md");
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
    if (isWindows) {
      child = spawnSync("bash", [fullPath, ...args], {
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

// 格式化当前时间 YYYY-MM-DD HH:mm:ss
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const formattedTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const reportContent = [
  "# 确定性机器前置审查报告 (clue-lens)",
  "",
  `- **审查时间**: ${formattedTime}`,
  `- **审查范围**: ${diffName}`,
  `- **检查清单**: \`${path.relative(ROOT, CHECKS_FILE)}\``,
  `- **总决议**: ${failures === 0 ? "✅ PASS (全部通过)" : "❌ FAIL (存在阻断问题)"}`,
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

fs.writeFileSync(REPORT_FILE, reportContent, "utf8");

console.log();
console.log(`=== 审查报告已生成: ${path.relative(ROOT, REPORT_FILE)} ===`);
if (failures > 0) {
  console.error(`❌ 确定性前置门禁失败，共发现 ${failures} 项未通过！`);
  process.exit(1);
}

console.log("✅ 所有确定性门禁检查项全部通过！");
process.exit(0);
