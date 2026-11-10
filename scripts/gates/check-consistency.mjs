#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-consistency.mjs
// 全栈工程一致性与规范完整性校验门禁（跨平台 Node.js ESM 版）
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(ROOT);

let failures = 0;

function checkFileExists(filePath) {
  if (!fs.existsSync(path.join(ROOT, filePath))) {
    console.error(`❌ [MISSING] 未找到必需文件: ${filePath}`);
    failures += 1;
  } else {
    console.log(`✅ [FOUND] ${filePath}`);
  }
}

function checkContentContains(filePath, pattern, desc) {
  const full = path.join(ROOT, filePath);
  const content = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
  if (!content.includes(pattern)) {
    console.error(`❌ [MISMATCH] ${filePath} 缺少关键定义: ${desc} (pattern: ${pattern})`);
    failures += 1;
  } else {
    console.log(`✅ [MATCH] ${desc} in ${filePath}`);
  }
}

function checkForbiddenPattern(filePath, pattern, desc) {
  const full = path.join(ROOT, filePath);
  const content = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
  if (content.includes(pattern)) {
    console.error(`❌ [VIOLATION] ${filePath} 发现违规残留: ${desc} (pattern: ${pattern})`);
    failures += 1;
  } else {
    console.log(`✅ [CLEAN] 无违规残留: ${desc}`);
  }
}

console.log("=== [Consistency Check] 开始执行工程命名与核心一致性校验 ===");

console.log("--- 1. 核心规范与架构文档存在性检查 ---");
for (const f of [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "rules/01-project-architecture.md",
  "rules/02-database-design.md",
  "rules/03-drizzle-convention.md",
  "rules/04-server-actions-convention.md",
  "rules/05-coding-style.md",
  "rules/06-test-and-quality-convention.md",
  "rules/07-security-and-auth.md",
  "rules/08-worktree-workflow.md",
  "spec/README.md",
  "spec/clue-lens/requirements.md",
  "spec/clue-lens/design.md",
  "spec/clue-lens/tasks.md",
]) {
  checkFileExists(f);
}

console.log("--- 2. 基础配置与核心代码文件检查 ---");
for (const f of [
  "package.json",
  "components.json",
  "drizzle.config.ts",
  "next.config.ts",
  "postcss.config.mjs",
  "scripts/review.mjs",
  "scripts/review-checks.list",
  "src/app/globals.css",
  "src/db/index.ts",
  "src/db/schema.ts",
  "src/lib/auth.ts",
  "src/lib/auth-client.ts",
  "src/lib/session.ts",
  "src/lib/validations.ts",
  "src/lib/utils.ts",
]) {
  checkFileExists(f);
}

console.log("--- 3. 数据库核心表名定义检查 (src/db/schema.ts) ---");
checkContentContains("src/db/schema.ts", 'sqliteTable("user"', "用户表 user");
checkContentContains("src/db/schema.ts", 'sqliteTable("session"', "会话表 session");
checkContentContains("src/db/schema.ts", 'sqliteTable("account"', "账号表 account");
checkContentContains("src/db/schema.ts", 'sqliteTable("verification"', "验证表 verification");
checkContentContains("src/db/schema.ts", "clues = sqliteTable", "线索表 clues");
checkContentContains("src/db/schema.ts", "clueMcpAuditLog = sqliteTable", "MCP审计表 clue_mcp_audit_log");

console.log("--- 4. Tailwind v4 与全局样式规范检查 ---");
checkContentContains("src/app/globals.css", '@import "tailwindcss";', "Tailwind v4 原生导入");
checkForbiddenPattern("src/app/globals.css", "@tailwind base;", "旧版 Tailwind v3 指令");

console.log("--- 5. 架构文档一致性检查 ---");
checkContentContains("ARCHITECTURE.md", "当前代码的导航地图", "ARCHITECTURE.md 定位声明");
checkContentContains("AGENTS.md", "架构底线与安全红线", "AGENTS.md 约束声明");

console.log("--- 6. MCP 智能体服务与配置检查 ---");
checkFileExists(".mcp.json");
checkFileExists("scripts/mcp/server.mjs");
checkFileExists("scripts/mcp/test-client.mjs");
checkFileExists("src/mcp/index.ts");
checkFileExists("src/mcp/schema-inspector.ts");
checkContentContains("scripts/mcp/server.mjs", "inspect_db_schema", "MCP 工具 inspect_db_schema");
checkContentContains(".mcp.json", "clue-mcp-server", "MCP 服务配置 clue-mcp-server");

console.log("--- 7. SDD 技能库与智能体契约检查 (.agents) ---");
checkFileExists(".agents/agent-manifest.yml");
checkFileExists(".agents/hooks.json");
checkFileExists(".claude/settings.json");
checkFileExists(".agents/skills/WORKFLOW.md");
checkFileExists(".agents/skills/spec-clarification/SKILL.md");
checkFileExists(".agents/skills/spec-requirements/SKILL.md");
checkFileExists(".agents/skills/spec-design/SKILL.md");
checkFileExists(".agents/skills/spec-tasks/SKILL.md");
checkFileExists(".agents/skills/spec-impl/SKILL.md");
checkFileExists(".agents/skills/spec-review/SKILL.md");
checkFileExists("scripts/lib/exec.mjs");
checkFileExists("scripts/lib/agent-contract.mjs");
checkFileExists("scripts/gates/check-manifest.mjs");
checkFileExists("scripts/agent/agent-run.mjs");
checkFileExists("scripts/agent/worktree.mjs");
checkFileExists("scripts/agent/pre-tool-guard.mjs");
checkContentContains(".claude/settings.json", "pre-tool-guard.mjs", "Claude Code PreToolUse Hook 配置");

console.log("--- 8. Shell 脚本禁令检查 (scripts/ 下不允许 .sh) ---");
function findShFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findShFiles(full));
    else if (entry.name.endsWith(".sh")) out.push(full);
  }
  return out;
}
const shFiles = findShFiles(path.join(ROOT, "scripts"));
if (shFiles.length > 0) {
  for (const f of shFiles) {
    console.error(`❌ [VIOLATION] scripts/ 下禁止新增 shell 脚本（请使用 Node.js ESM）: ${path.relative(ROOT, f)}`);
    failures += 1;
  }
} else {
  console.log("✅ [CLEAN] scripts/ 下无 shell 脚本，工具链全 Node.js ESM 化");
}

console.log("==================================================================");
if (failures > 0) {
  console.error(`❌ 一致性校验未通过，共发现 ${failures} 处不一致！`);
  process.exit(1);
}

console.log("✅ 恭喜！工程命名与规范一致性校验 100% 通过！");
