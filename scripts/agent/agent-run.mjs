#!/usr/bin/env node
// ==============================================================================
// scripts/agent/agent-run.mjs
// 根据 .agents/agent-manifest.yml 创建隔离 worktree、执行角色命令、
// 运行 AI 护栏、校验声明 Checks、防卫改动边界并生成 Agent 审计凭证。
// （跨平台 Node.js ESM 版：manifest 解析复用 scripts/lib/agent-contract.mjs，
//   未知检查项一律 FAIL，绝不 fail-open）
// ==============================================================================
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseAgentManifest } from "../lib/agent-contract.mjs";
import { ROOT } from "../lib/exec.mjs";

const IS_WINDOWS = process.platform === "win32";
const MANIFEST = process.env.AGENT_MANIFEST_FILE || path.join(ROOT, ".agents", "agent-manifest.yml");

function usage() {
  console.error(`用法：node scripts/agent/agent-run.mjs --role ROLE --name NAME [选项]
  --role ROLE       manifest 中的角色 id (spec-analyst | fullstack-implementer | quality-reviewer)
  --name NAME       worktree 任务名 / run-id
  --base REF        worktree 基线，默认 HEAD
  --parent DIR      worktree 父目录
  --run-commands    执行 manifest 中声明的 commands 和 checks
  --command CMD     追加执行一条命令
  --cleanup         命令成功且工作区干净时清理 worktree
  --dry-run         只打印契约与门禁，不创建 worktree`);
}

function parseArgs(argv) {
  const opts = {
    role: "",
    name: "",
    base: "HEAD",
    parent: "",
    runCommands: false,
    extraCommand: "",
    cleanup: false,
    dryRun: false,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    const needValue = () => {
      if (i + 1 >= argv.length) {
        console.error(`${arg} 需要参数`);
        process.exit(2);
      }
      i += 1;
      return argv[i];
    };
    switch (arg) {
      case "--role": opts.role = needValue(); break;
      case "--name": opts.name = needValue(); break;
      case "--base": opts.base = needValue(); break;
      case "--parent": opts.parent = needValue(); break;
      case "--run-commands": opts.runCommands = true; break;
      case "--command": opts.extraCommand = needValue(); break;
      case "--cleanup": opts.cleanup = true; break;
      case "--dry-run": opts.dryRun = true; break;
      case "-h":
      case "--help":
        usage();
        process.exit(0);
      default:
        console.error(`未知参数：${arg}`);
        usage();
        process.exit(2);
    }
    i += 1;
  }
  return opts;
}

// 主工作区根目录（在 worktree 内执行时解析回主仓库）
function resolveMainRoot() {
  const res = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const commonDir = (res.stdout || "").trim();
  return commonDir ? path.resolve(commonDir, "..") : ROOT;
}

/**
 * 声明检查项解析器（单一映射，与 SUPPORTED_CHECKS 对齐）。
 * 未知检查项返回 null → 调用方必须按 FAIL 处理（fail-closed）。
 */
export function resolveCheck(name) {
  switch (name) {
    case "markdown-links":
      return { kind: "markdown-links" };
    case "spec-consistency":
      return { kind: "spec-consistency" };
    case "typecheck":
      return { kind: "npm", script: "typecheck" };
    case "check-security":
    case "static-security-check":
      return { kind: "node", script: "scripts/gates/check-security.mjs" };
    case "check-consistency":
      return { kind: "node", script: "scripts/gates/check-consistency.mjs" };
    case "check-secrets":
    case "secret-scan":
      return { kind: "node", script: "scripts/gates/check-secrets.mjs" };
    case "check-mcp":
      return { kind: "node", script: "scripts/gates/check-mcp.mjs" };
    case "review":
    case "deterministic-review":
      return { kind: "node", script: "scripts/review.mjs" };
    default:
      return null;
  }
}

// manifest 声明路径的匹配语义与历史 sh 版一致：'.' 转义、'*' 通配、前缀匹配
function pathMatches(file, pattern) {
  const regex = new RegExp(`^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}`);
  return regex.test(file);
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.role || !args.name) {
    usage();
    process.exit(2);
  }

  // 1. 结构门禁：manifest 解析失败或契约非法立即阻断
  const gate = spawnSync(process.execPath, [path.join(ROOT, "scripts", "gates", "check-manifest.mjs")], {
    stdio: "inherit",
  });
  if (gate.status !== 0) process.exit(gate.status ?? 1);

  let manifest;
  try {
    manifest = parseAgentManifest(fs.readFileSync(MANIFEST, "utf8"));
  } catch (err) {
    console.error(`❌ [AGENT-RUN] ${err.message}`);
    process.exit(2);
  }
  const role = manifest.roles.find((r) => r.id === args.role);
  if (!role) {
    console.error(`角色不存在：${args.role}`);
    process.exit(2);
  }

  const parentDir = path.resolve(args.parent || process.env.WORKTREE_PARENT || path.join(resolveMainRoot(), ".worktrees"));

  console.log(`[AGENT-RUN] role=${role.id}`);
  console.log(`[AGENT-RUN] objective=${role.objective}`);
  console.log(`[AGENT-RUN] allowed_paths=[${role.allowed_paths.join(", ")}]`);
  console.log(`[AGENT-RUN] forbidden_paths=[${role.forbidden_paths.join(", ")}]`);
  console.log(`[AGENT-RUN] checks=[${role.checks.join(", ")}]`);
  console.log(`[AGENT-RUN] commands=[${role.commands.join(", ")}]`);

  if (args.dryRun) {
    console.log("[AGENT-RUN] dry-run：不会创建 worktree，也不会执行命令。");
    process.exit(0);
  }

  fs.mkdirSync(parentDir, { recursive: true });
  const worktree = path.join(parentDir, `clue-lens-${args.name}`);
  const newRes = spawnSync(process.execPath, [
    path.join(ROOT, "scripts", "agent", "worktree.mjs"),
    "new",
    args.name,
    "--base",
    args.base,
  ], {
    stdio: "inherit",
    env: { ...process.env, WORKTREE_PARENT: parentDir },
  });
  if (newRes.status !== 0) process.exit(newRes.status ?? 1);

  // ---------- 命令护栏与执行 ----------
  function guardCommand(cmd) {
    const guardScript = path.join(ROOT, "scripts", "agent", "pre-tool-guard.mjs");
    const res = spawnSync(process.execPath, [guardScript, cmd], { encoding: "utf8" });
    if (res.stderr) process.stderr.write(res.stderr);
    return res.status === 0;
  }

  function runCommand(cmd) {
    console.log(`[AGENT-RUN] 预审工具命令安全护栏：${cmd}`);
    if (!guardCommand(cmd)) {
      console.error("❌ [AGENT-RUN] 命令被 AI 运行期护栏拦截！");
      return false;
    }
    console.log(`[AGENT-RUN] 执行命令：${cmd}`);
    const res = IS_WINDOWS
      ? spawnSync(cmd, { cwd: worktree, stdio: "inherit", shell: true })
      : spawnSync("bash", ["-lc", cmd], { cwd: worktree, stdio: "inherit" });
    return res.status === 0;
  }

  // ---------- 检查项执行 ----------
  function checkMarkdownLinks() {
    const targets = [
      "spec/clue-lens/requirements.md",
      "spec/clue-lens/design.md",
      "spec/clue-lens/tasks.md",
      "README.md",
      "ARCHITECTURE.md",
    ];
    let ok = true;
    for (const file of targets) {
      const fullPath = path.join(worktree, file);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf8");
      const linkRegex = /\[.*?\]\((?!https?:\/\/|mailto:|#)(.*?)\)/g;
      let m;
      while ((m = linkRegex.exec(content)) !== null) {
        const linkTarget = m[1].split("#")[0].trim();
        if (!linkTarget) continue;
        let resolved;
        if (linkTarget.startsWith("file://")) {
          try {
            resolved = new URL(linkTarget).pathname;
          } catch {
            resolved = linkTarget.replace(/^file:\/\//, "");
          }
        } else {
          resolved = path.resolve(path.dirname(fullPath), linkTarget);
        }
        if (!fs.existsSync(resolved)) {
          console.error(`❌ [MARKDOWN-LINKS] 发现死链: ${file} -> ${linkTarget}`);
          ok = false;
        }
      }
    }
    return ok;
  }

  function runResolvedCheck(resolved) {
    switch (resolved.kind) {
      case "markdown-links":
        return checkMarkdownLinks();
      case "spec-consistency":
        return ["requirements.md", "design.md", "tasks.md"].every((f) =>
          fs.existsSync(path.join(worktree, "spec", "clue-lens", f)),
        );
      case "npm": {
        const res = IS_WINDOWS
          ? spawnSync("npm", ["run", resolved.script], { cwd: worktree, stdio: "inherit", shell: true })
          : spawnSync("npm", ["run", resolved.script], { cwd: worktree, stdio: "inherit" });
        return res.status === 0;
      }
      case "node": {
        const res = spawnSync(process.execPath, [path.join(worktree, resolved.script)], {
          cwd: worktree,
          stdio: "inherit",
        });
        return res.status === 0;
      }
      default:
        return false;
    }
  }

  const checkResults = [];
  let checkFailures = 0;
  function runSingleCheck(name) {
    console.log(`>>> [AGENT-CHECK] 正在执行声明检查: ${name}`);
    const resolved = resolveCheck(name);
    let passed;
    if (!resolved) {
      console.error(`❌ [AGENT-CHECK] 未知或未配置的检查项: ${name}`);
      passed = false;
    } else {
      passed = runResolvedCheck(resolved);
    }
    checkResults.push({ name, status: passed ? "PASS" : "FAIL", note: passed ? "通过" : "未通过" });
    if (!passed) {
      console.error(`❌ [AGENT-CHECK] 检查项失败: ${name}`);
      checkFailures += 1;
    }
    return passed;
  }

  const commandResults = [];
  if (args.runCommands) {
    // 1. 执行角色声明的命令
    for (const cmd of role.commands) {
      if (runCommand(cmd)) {
        commandResults.push({ cmd, status: "SUCCESS" });
      } else {
        commandResults.push({ cmd, status: "FAILED" });
        console.error(`❌ [AGENT-RUN] 命令执行失败: ${cmd}`);
        process.exit(1);
      }
    }
    // 2. 真实驱动执行角色声明的 checks
    for (const chk of role.checks) runSingleCheck(chk);
  }

  if (args.extraCommand) {
    if (!runCommand(args.extraCommand)) process.exit(1);
  }

  // ---------- 改动边界防卫 ----------
  const statusRes = spawnSync("git", ["-C", worktree, "status", "--porcelain=v1"], { encoding: "utf8" });
  const changedFiles = (statusRes.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  let violations = 0;
  for (const file of changedFiles) {
    const allowedMatch = role.allowed_paths.some((p) => pathMatches(file, p));
    for (const p of role.forbidden_paths) {
      if (pathMatches(file, p)) {
        console.error(`❌ [AGENT-RUN] 命中 forbidden_paths：${file}`);
        violations += 1;
      }
    }
    if (!allowedMatch) {
      console.error(`❌ [AGENT-RUN] 改动超出 allowed_paths：${file}`);
      violations += 1;
    }
  }

  // ---------- 角色执行审计凭证 (evidence/agent-runs/<name>/<role>.md) ----------
  const evidenceDir = path.join(ROOT, "evidence", "agent-runs", args.name);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `${role.id}.md`);

  const checkRows = checkResults.length
    ? checkResults.map((r) => `| \`${r.name}\` | ${r.status === "PASS" ? "🟢 PASS" : "🔴 FAIL"} | ${r.note} |`)
    : ["| - | ⚪ SKIP | 未触发 --run-commands |"];
  const commandLines = commandResults.length
    ? commandResults.map((r) => `- [${r.status}] \`${r.cmd}\``)
    : ["（无命令执行或未传入 --run-commands）"];
  const changedLines = changedFiles.length ? changedFiles.map((f) => `- \`${f}\``) : ["（工作区干净，无未暂存/未提交变更）"];
  const compliant = violations === 0 && checkFailures === 0;

  const evidence = `# Agent 角色执行审计凭据 (${role.id})

- **运行 ID (Run Name)**: \`${args.name}\`
- **角色 ID**: \`${role.id}\`
- **角色目标**: ${role.objective}
- **执行时间**: ${formatTimestamp(new Date())}
- **隔离工作区**: \`${worktree}\`
- **门禁判定**: ${compliant ? "🟢 合规通过" : "🔴 违规拦截"}

## 声明检查项验证结果 (Checks)

| 检查项 | 状态 | 详情 |
|---|---|---|
${checkRows.join("\n")}

## 命令执行日志 (Commands)

${commandLines.join("\n")}

## 工作区文件变更清单

${changedLines.join("\n")}
`;
  fs.writeFileSync(evidenceFile, evidence, "utf8");
  console.log(`📜 [AGENT-RUN] 审计凭证已生成: ${evidenceFile}`);

  if (args.cleanup) {
    const dropRes = spawnSync(process.execPath, [path.join(ROOT, "scripts", "agent", "worktree.mjs"), "drop", args.name], {
      stdio: "inherit",
      env: { ...process.env, WORKTREE_PARENT: parentDir },
    });
    if (dropRes.status !== 0) process.exit(dropRes.status ?? 1);
  } else {
    console.log(`[AGENT-RUN] 运行完成，worktree 保留：${worktree}`);
  }

  if (!compliant) {
    console.error(`❌ [AGENT-RUN] 角色审计未通过（违规变更: ${violations}, 失败检查: ${checkFailures}）！`);
    process.exit(1);
  }
}

// 仅在直接执行时启动 main（作为模块导入时仅供测试复用 resolveCheck）
if (process.argv[1] && process.argv[1].endsWith("agent-run.mjs")) {
  main();
}
