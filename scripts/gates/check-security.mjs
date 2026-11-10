#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-security.mjs
// 全栈静态安全与架构红线门禁（跨平台 Node.js ESM 版）
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(ROOT);

let failures = 0;
const fail = (msg) => {
  console.error(`❌ [STATIC] ${msg}`);
  failures += 1;
};
const pass = (msg) => console.log(`✅ [STATIC] ${msg}`);

function readIfExists(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

console.log("=== [Static Security Check] 开始执行全栈静态安全与红线检查 ===");

// 1 & 2. 检查 Server Actions 是否声明 "use server" 且包含会话鉴权门禁
const actionsDir = path.join(ROOT, "src", "app", "actions");
if (fs.existsSync(actionsDir)) {
  const actionFiles = fs
    .readdirSync(actionsDir)
    .filter((f) => f.endsWith(".ts"))
    .sort();
  for (const f of actionFiles) {
    const rel = path.join("src/app/actions", f);
    const content = readIfExists(rel) ?? "";
    if (!content.includes('"use server"')) {
      fail(`Server Action 文件缺少 'use server' 指令: ${rel}`);
    } else {
      pass(`Server Action 指令合规: ${rel}`);
    }
    if (!content.includes("requireSession")) {
      fail(`Server Action 缺少 requireSession 鉴权门禁: ${rel}`);
    } else {
      pass(`Server Action 鉴权守卫合规: ${rel}`);
    }
  }
}

// 3. 检查 next.config.ts 是否配置了 better-sqlite3 为 serverExternalPackages
if (/serverExternalPackages.*better-sqlite3/.test(readIfExists("next.config.ts") ?? "")) {
  pass("next.config.ts 已正确配置 better-sqlite3 外部模块排除");
} else {
  fail("next.config.ts 缺少 better-sqlite3 的 serverExternalPackages 配置");
}

// 4. 检查 SQLite 初始化脚本是否开启 WAL 模式与外键约束
const initDb = readIfExists("scripts/ops/init-db.mjs") ?? "";
if (initDb.includes("journal_mode = WAL") && initDb.includes("foreign_keys = ON")) {
  pass("SQLite 数据库初始化 WAL 模式与外键级联检查通过");
} else {
  fail("scripts/ops/init-db.mjs 缺少 WAL 模式或外键级联强制配置");
}

// 5. 检查 Better Auth 是否注册了 nextCookies 插件
if ((readIfExists("src/lib/auth.ts") ?? "").includes("nextCookies")) {
  pass("Better Auth 已正确引入 nextCookies 插件");
} else {
  fail("src/lib/auth.ts 缺少 nextCookies 插件，可能导致 Cookie 写入失败");
}

console.log("==================================================================");
if (failures > 0) {
  console.error(`❌ 静态安全红线校验未通过，发现 ${failures} 处阻断项！`);
  process.exit(1);
}

console.log("✅ 恭喜！所有静态安全与架构红线检查全部通过！");
