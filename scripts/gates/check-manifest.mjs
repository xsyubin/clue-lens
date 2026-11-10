#!/usr/bin/env node
// ==============================================================================
// scripts/gates/check-manifest.mjs
// 校验 .agents/agent-manifest.yml 的受控子集（跨平台 Node.js ESM 版）。
// 解析与检查项契约复用 scripts/lib/agent-contract.mjs 单一事实源，
// 任何解析失败立即报错阻断，防止契约静默漂移与 fail-open 空转。
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAgentManifest, validateAgentManifest } from "../lib/agent-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = process.env.AGENT_MANIFEST_FILE || path.join(ROOT, ".agents", "agent-manifest.yml");

let failures = 0;
const fail = (msg) => {
  console.error(`❌ [AGENT-MANIFEST] ${msg}`);
  failures += 1;
};
const pass = (msg) => console.log(`✅ [AGENT-MANIFEST] ${msg}`);

if (!fs.existsSync(MANIFEST)) {
  fail(`文件不存在：${MANIFEST}`);
  process.exit(1);
}

let manifest;
try {
  manifest = parseAgentManifest(fs.readFileSync(MANIFEST, "utf8"));
} catch (err) {
  fail(err.message);
  process.exit(1);
}

for (const problem of validateAgentManifest(manifest)) fail(problem);

if (failures > 0) {
  console.error(`❌ [AGENT-MANIFEST] 校验失败，共 ${failures} 处错误。`);
  process.exit(1);
}

pass(`结构校验通过：${MANIFEST}`);
