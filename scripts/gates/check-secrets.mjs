#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-secrets.mjs
// 确定性密钥扫描：阻断高置信度私钥与云厂商 Token 泄露
// 说明：命令行旗标（如 --staged）不再被误当作文件名（修复旧版空转缺陷）
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { ROOT, run } from "../lib/exec.mjs";

process.chdir(ROOT);

const SECRET_PATTERN =
  /BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/;

// 显式指定文件列表时仅接受非旗标参数
const explicitFiles = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

let files = [...explicitFiles];
if (files.length === 0) {
  const lsRes = run(
    "git",
    ["ls-files", ":!node_modules", ":!.next", ":!data", ":!*.md", ":!.env.example"],
    { encoding: "utf8" },
  );
  if (lsRes.status === 0 && (lsRes.stdout || "").trim()) {
    files = lsRes.stdout.split(/\r?\n/).filter(Boolean);
  } else {
    files = [...walkFiles(path.join(ROOT, "src")), ...walkFiles(path.join(ROOT, "scripts"))].map(
      (f) => path.relative(ROOT, f),
    );
  }
}

if (files.length === 0) {
  console.log("✅ [SECRET] 没有可扫描的文件");
  process.exit(0);
}

const hits = [];
for (const file of files) {
  const full = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    console.warn(`⚠️ [SECRET] 跳过不存在或不可读的文件: ${file}`);
    continue;
  }
  const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (SECRET_PATTERN.test(line)) hits.push(`${file}:${idx + 1}:[REDACTED]`);
  });
}

if (hits.length > 0) {
  console.error("❌ [SECRET] 检测到高置信度密钥格式，已阻断提交：");
  for (const hit of hits) console.error(hit);
  process.exit(1);
}

console.log(`✅ [SECRET] 未发现高置信度密钥格式（已扫描 ${files.length} 个文件）`);
