#!/usr/bin/env node
/**
 * Draft the SDD specification chain before overnight implementation starts.
 *
 * The process creates a reviewable handoff branch. It never changes main and
 * never marks a draft as approved without an explicit approve command.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseAgentManifest } from "../lib/agent-contract.mjs";
import {
  classifyFailure,
  parseProviderChain,
  runAgentProcess,
  runWithRetry,
} from "./overnight.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKTREE_PARENT = path.join(ROOT, ".worktrees");
const MANIFEST_FILE = path.join(ROOT, ".agents", "agent-manifest.yml");
const STAGES = [
  { id: "clarification", output: "clarification.md" },
  { id: "requirements", output: "requirements.md" },
  { id: "design", output: "design.md" },
  { id: "tasks", output: "tasks.md" },
];
const DEFAULT_TIMEOUT_MS = Number(process.env.OVERNIGHT_TIMEOUT_MS || 45 * 60 * 1000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.OVERNIGHT_MAX_ATTEMPTS || 3);

function now() {
  return new Date().toISOString();
}

function safeFileName(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function runGit(args, cwd = ROOT, allowFailure = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  const output = (result.stdout || "") + (result.stderr || "");
  if (!allowFailure && result.status !== 0) {
    throw new Error("git " + args.join(" ") + " 失败: " + output.trim());
  }
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "", output };
}

export function resolveSpecPath(specPath) {
  if (!specPath || path.isAbsolute(specPath) || specPath.split(/[\\/]+/).includes("..")) {
    throw new Error("SPEC_PATH 必须是仓库内相对路径");
  }
  if (!specPath.startsWith("spec/")) {
    throw new Error("SPEC_PATH 必须指向 spec/ 下的规格目录");
  }
  const absolute = path.resolve(ROOT, specPath);
  const rootWithSep = ROOT + path.sep;
  if (!absolute.startsWith(rootWithSep)) throw new Error("SPEC_PATH 必须位于仓库内");
  return absolute;
}

function stateFileFor(specDir) {
  return path.join(specDir, ".sdd-bootstrap-state.json");
}

function writeJsonAtomic(file, value) {
  const temp = file + "." + process.pid + "." + crypto.randomUUID() + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(temp, file);
}

function saveState(file, state) {
  state.updatedAt = now();
  state.lastHeartbeat = state.updatedAt;
  writeJsonAtomic(file, state);
}

function loadState(file) {
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (state.version !== 1 || !state.specPath || !state.handoffBranch || !state.stages) {
      throw new Error("缺少必要字段");
    }
    return state;
  } catch (error) {
    throw new Error(".sdd-bootstrap-state.json 损坏，已停止: " + error.message);
  }
}

export function createState({ specPath, baseline, runId, handoffBranch, handoffWorktree }) {
  const stages = {};
  for (const stage of STAGES) {
    stages[stage.id] = {
      stage: stage.id,
      phase: "pending",
      commitSha: null,
      worktree: null,
      agent: null,
      model: null,
      attempts: 0,
      lastHeartbeat: now(),
    };
  }
  return {
    version: 1,
    workflow: "sdd-bootstrap",
    runId,
    specPath,
    baseline,
    handoffBranch,
    handoffWorktree,
    status: "running",
    phase: "clarification",
    currentStage: "clarification",
    stages,
    createdAt: now(),
    updatedAt: now(),
    lastHeartbeat: now(),
    host: os.hostname(),
    pid: process.pid,
  };
}

export function parseArgs(args) {
  const specPath = args[0];
  const mode = args[1] || "run";
  const rest = args.slice(2);
  let requirement = "";
  let requirementFile = "";
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--requirement") {
      requirement = rest[index + 1] || "";
      index += 1;
    } else if (arg === "--file") {
      requirementFile = rest[index + 1] || "";
      index += 1;
    } else if (!requirement) {
      requirement = arg;
    } else {
      requirement += " " + arg;
    }
  }
  if (!specPath) throw new Error("请显式传入 SPEC_PATH");
  if (!["run", "resume", "status", "approve"].includes(mode)) throw new Error("未知模式: " + mode);
  if (requirement && requirementFile) throw new Error("--requirement 与 --file 只能选择一个");
  return { specPath, mode, requirement, requirementFile };
}

function readRequirement({ requirement, requirementFile, specDir }) {
  if (requirementFile) {
    const file = path.resolve(ROOT, requirementFile);
    const rootWithSep = ROOT + path.sep;
    if (!file.startsWith(rootWithSep)) throw new Error("原始需求文件必须位于仓库内");
    requirement = fs.readFileSync(file, "utf8").trim();
  } else if (!requirement) {
    const existing = path.join(specDir, "raw-requirements.md");
    if (fs.existsSync(existing)) requirement = fs.readFileSync(existing, "utf8").trim();
  }
  if (!requirement) throw new Error("首次运行需要 --requirement、--file 或已有 raw-requirements.md");
  if (requirement.length < 5) throw new Error("原始需求过短，至少需要 5 个字符");
  return requirement;
}

function createHandoff(slug, baseline) {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/agent/worktree.mjs"), "new", slug, "--base", baseline], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, WORKTREE_PARENT },
  });
  if (result.status !== 0) {
    throw new Error("创建规格交接 worktree 失败: " + (result.stdout || "") + (result.stderr || ""));
  }
  return path.join(WORKTREE_PARENT, "clue-lens-" + slug);
}

function createStageWorktree(slug, base, parent) {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/agent/worktree.mjs"), "new", slug, "--base", base], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, WORKTREE_PARENT: parent },
  });
  if (result.status !== 0) {
    throw new Error("创建规格阶段 worktree 失败: " + (result.stdout || "") + (result.stderr || ""));
  }
  return { dir: path.join(parent, "clue-lens-" + slug), parent };
}

function dropWorktree(slug, parent) {
  spawnSync(process.execPath, [path.join(ROOT, "scripts/agent/worktree.mjs"), "drop", slug], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, WORKTREE_PARENT: parent },
  });
}

function commit(cwd, message) {
  runGit(["add", "-A"], cwd);
  runGit(["commit", "-m", message], cwd);
}

function writeRawRequirement(handoffDir, specPath, requirement) {
  const file = path.join(handoffDir, specPath, "raw-requirements.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "# 原始需求\n\n" + requirement + "\n", "utf8");
    commit(handoffDir, "docs(sdd): capture raw requirement");
  }
}

function stageRole() {
  const manifest = parseAgentManifest(fs.readFileSync(MANIFEST_FILE, "utf8"));
  const role = manifest.roles.find((item) => item.id === "spec-analyst");
  if (!role) throw new Error("manifest 中不存在 spec-analyst 角色");
  return role;
}

function changedFiles(base, cwd) {
  return runGit(["diff", "--name-only", base + "..HEAD"], cwd).stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stagePrompt(stage, specPath) {
  const featurePath = specPath.replace(/^spec\//, "");
  const common = "你是 SDD 规格分析角色。项目根目录的 AGENTS.md、ARCHITECTURE.md、rules/ 和 .agents/skills/WORKFLOW.md 是约束来源。当前规格目录是 spec/" + featurePath + "。原始需求可能只有一句话，必须把不确定性明确写入文档，不能擅自把猜测写成已确认事实。";
  const prompts = {
    clarification: common + "\n只生成 clarification.md。提炼目标、角色、范围、业务规则、异常、权限和待确认问题。不要生成 requirements.md、design.md 或 tasks.md。",
    requirements: common + "\n读取 raw-requirements.md 和 clarification.md，只生成 requirements.md。形成正式需求、页面/接口/权限/流程/非功能约束和 EARS 验收标准。保留无法确认的事项并标记为待人工确认。不要修改其他规格文件。",
    design: common + "\n读取 requirements.md，只生成 design.md。基于现有代码和架构形成可执行技术设计，明确文件、数据模型、接口、状态流转、异常、测试和安全边界。不要修改 requirements.md 或 tasks.md。",
    tasks: common + "\n读取 requirements.md 和 design.md，只生成 tasks.md。拆成可执行顶层任务。每行必须使用 - [ ] <数字或点号任务ID> <任务标题> 格式，并包含交付物、依赖和验收条件。不要修改其他规格文件，也不要实现代码。",
  };
  return prompts[stage] + "\n完成后运行可用的检查，提交 Git。不要推送远程，不要操作 main。";
}

function assertOutput(stage, worktree, specPath) {
  const file = path.join(worktree, specPath, stage.output);
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8").trim().length < 10) {
    throw new Error(stage.id + " 没有生成有效的 " + stage.output);
  }
  if (stage.id === "tasks") {
    const tasks = fs.readFileSync(file, "utf8").split(/\r?\n/)
      .filter((line) => /^- \[[ x?!R]\]\s+[A-Za-z0-9._-]+\s+.+/.test(line));
    if (tasks.length === 0) throw new Error("tasks.md 没有可执行的顶层任务");
  }
}

export function validateStageFiles(files, stage, specPath, handoffSlug) {
  const expected = specPath + "/" + stage.output;
  const evidencePrefix = "evidence/agent-runs/" + handoffSlug + "/";
  const violations = files.filter((file) => file !== expected && !file.startsWith(evidencePrefix));
  if (violations.length > 0) {
    throw new Error(stage.id + " 修改了未允许路径: " + violations.join(", "));
  }
}

function runSpecChecks(stageDir, logFile) {
  const checks = [
    ["git", ["diff", "--check"]],
    [process.execPath, [path.join(stageDir, "scripts/gates/check-manifest.mjs")]],
  ];
  for (const [command, args] of checks) {
    const result = spawnSync(command, args, { cwd: stageDir, encoding: "utf8" });
    fs.appendFileSync(logFile, "\n$ " + command + " " + args.join(" ") + "\n" + (result.stdout || "") + (result.stderr || ""));
    if (result.status !== 0) throw new Error("规格检查失败: " + args.join(" "));
  }
}

function resetStageWorktree(worktree, base) {
  runGit(["reset", "--hard", base], worktree);
  runGit(["clean", "-fd"], worktree);
}

function evidenceText({ state, stage, provider, model, commitSha, files }) {
  return "# SDD Bootstrap Evidence\n\n" +
    "- Run ID: \`" + state.runId + "\`\n" +
    "- Stage: \`" + stage.id + "\`\n" +
    "- Agent: \`" + provider + "\`\n" +
    "- Model: \`" + (model || "default") + "\`\n" +
    "- Commit: \`" + commitSha + "\`\n" +
    "- Decision: **PASS**\n\n" +
    "## Changed files\n\n" + files.map((file) => "- \`" + file + "\`").join("\n") + "\n\n" +
    "调度器已核对输出文件、允许路径、Git 提交和规格检查。该文件仍属于待人工确认的规格草稿证据。\n";
}

async function processStage({ state, stateFile, stage, specDir, handoffDir, handoffSlug }) {
  const stageState = state.stages[stage.id];
  stageState.phase = "running";
  state.phase = stage.id;
  state.currentStage = stage.id;
  state.status = "running";
  saveState(stateFile, state);

  const attemptOffset = stageState.attempts;
  const attempt = attemptOffset + 1;
  const slug = handoffSlug + "-" + stage.id + "-" + attempt;
  const stageWorktree = createStageWorktree(slug, state.handoffBranch, path.join(handoffDir, ".worktrees"));
  stageState.worktree = stageWorktree.dir;
  stageState.attempts = attempt;
  saveState(stateFile, state);

  const logFile = path.join(specDir, "bootstrap-logs", stage.id + "-" + attempt + ".log");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const chain = parseProviderChain(process.env.OVERNIGHT_SPEC_ANALYST_CHAIN, "codex,claude,codex");

  try {
    const result = await runWithRetry({
      chain,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      onAttempt: ({ attempt: currentAttempt, provider }) => {
        stageState.attempts = attemptOffset + currentAttempt;
        stageState.agent = provider.agent;
        stageState.model = provider.model;
        stageState.lastHeartbeat = now();
        saveState(stateFile, state);
        fs.appendFileSync(logFile, "\nAttempt " + currentAttempt + ": " + provider.agent + "/" + (provider.model || "default") + "\n");
      },
      runner: async ({ attempt: currentAttempt, provider }) => {
        const heartbeat = setInterval(() => {
          stageState.lastHeartbeat = now();
          saveState(stateFile, state);
        }, 30_000);
        heartbeat.unref?.();
        const processResult = await runAgentProcess({
          provider: provider.agent,
          model: provider.model,
          prompt: stagePrompt(stage.id, state.specPath),
          cwd: stageWorktree.dir,
          logFile,
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });
        clearInterval(heartbeat);
        stageState.lastHeartbeat = now();
        saveState(stateFile, state);
        if (!processResult.ok) {
          const failureType = classifyFailure(processResult);
          if (currentAttempt < DEFAULT_MAX_ATTEMPTS && failureType !== "state-corrupt") {
            try {
              resetStageWorktree(stageWorktree.dir, state.handoffBranch);
            } catch (error) {
              return { ...processResult, failureType: "worktree-conflict", error };
            }
          }
          return { ...processResult, failureType };
        }
        if (runGit(["status", "--porcelain"], stageWorktree.dir).stdout.trim()) {
          return { ok: false, failureType: "provider-error", stderr: "Agent 结束后存在未提交变更" };
        }
        return processResult;
      },
    });

    const head = runGit(["rev-parse", "HEAD"], stageWorktree.dir).stdout.trim();
    if (runGit(["rev-list", "--count", state.handoffBranch + "..HEAD"], stageWorktree.dir).stdout.trim() === "0") {
      throw new Error(stage.id + " Agent 没有提交变更");
    }
    const files = changedFiles(state.handoffBranch, stageWorktree.dir);
    validateStageFiles(files, stage, state.specPath, handoffSlug);
    assertOutput(stage, stageWorktree.dir, state.specPath);
    runSpecChecks(stageWorktree.dir, logFile);

    const role = stageRole();
    const allowedPrefixes = role.allowed_paths.filter((pattern) => pattern.endsWith("/")).map((pattern) => pattern.slice(0, -1));
    const forbidden = files.filter((file) => !allowedPrefixes.some((prefix) => file === prefix || file.startsWith(prefix + "/")));
    if (forbidden.length > 0) throw new Error(stage.id + " 超出 spec-analyst allowed_paths: " + forbidden.join(", "));

    const evidence = path.join("evidence", "agent-runs", handoffSlug, "spec-analyst-" + stage.id + ".md");
    fs.mkdirSync(path.dirname(path.join(stageWorktree.dir, evidence)), { recursive: true });
    fs.writeFileSync(path.join(stageWorktree.dir, evidence), evidenceText({
      state,
      stage,
      provider: result.provider.agent,
      model: result.provider.model,
      commitSha: head,
      files,
    }), "utf8");
    commit(stageWorktree.dir, "chore(sdd): record " + stage.id + " bootstrap evidence");

    runGit(["-C", handoffDir, "merge", "--ff-only", "agent/" + slug]);
    stageState.phase = "completed";
    stageState.commitSha = runGit(["rev-parse", "HEAD"], handoffDir).stdout.trim();
    stageState.worktree = null;
    saveState(stateFile, state);
    dropWorktree(slug, stageWorktree.parent);
  } catch (error) {
    stageState.phase = "blocked";
    stageState.worktree = stageWorktree.dir;
    state.status = "blocked";
    saveState(stateFile, state);
    throw error;
  }
}

function printHandoff(state) {
  console.log("规格草稿已生成，交接分支为 " + state.handoffBranch);
  console.log("请先审核 " + state.specPath + "/clarification.md、requirements.md、design.md 和 tasks.md。");
  console.log("确认后执行: scripts/spec-bootstrap.sh " + state.specPath + " approve");
  console.log("然后执行: OVERNIGHT_BASELINE=" + state.handoffBranch + " scripts/overnight.sh " + state.specPath + " run");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const specDir = resolveSpecPath(args.specPath);
  fs.mkdirSync(specDir, { recursive: true });
  const stateFile = stateFileFor(specDir);

  if (args.mode === "status") {
    if (!fs.existsSync(stateFile)) {
      console.log("尚未创建 SDD bootstrap 状态。");
      return;
    }
    console.log(JSON.stringify(loadState(stateFile), null, 2));
    return;
  }

  if (args.mode === "approve") {
    const state = loadState(stateFile);
    if (state.status !== "awaiting-human-gate") {
      throw new Error("当前状态不是 awaiting-human-gate: " + state.status);
    }
    state.status = "approved";
    state.phase = "handoff";
    state.approvedAt = now();
    saveState(stateFile, state);
    printHandoff(state);
    return;
  }

  let state;
  if (fs.existsSync(stateFile)) {
    state = loadState(stateFile);
    if (state.specPath !== args.specPath) throw new Error("状态中的 SPEC_PATH 与启动参数不一致");
    if (state.status === "awaiting-human-gate" || state.status === "approved") {
      printHandoff(state);
      return;
    }
  } else {
    const requirement = readRequirement({
      requirement: args.requirement,
      requirementFile: args.requirementFile,
      specDir,
    });
    const baseline = process.env.OVERNIGHT_BASELINE || "main";
    runGit(["rev-parse", "--verify", baseline]);
    const runId = "bootstrap-" + new Date().toISOString().replace(/[:.]/g, "-");
    const handoffSlug = "spec-bootstrap-" + safeFileName(runId);
    const handoffWorktree = createHandoff(handoffSlug, baseline);
    writeRawRequirement(handoffWorktree, args.specPath, requirement);
    state = createState({
      specPath: args.specPath,
      baseline,
      runId,
      handoffBranch: "agent/" + handoffSlug,
      handoffWorktree,
    });
    saveState(stateFile, state);
  }

  for (const stage of STAGES) {
    if (state.stages[stage.id].phase === "completed") continue;
    await processStage({
      state,
      stateFile,
      stage,
      specDir,
      handoffDir: state.handoffWorktree,
      handoffSlug: state.handoffBranch.replace(/^agent\//, ""),
    });
  }

  state.status = "awaiting-human-gate";
  state.phase = "human-review";
  state.currentStage = null;
  saveState(stateFile, state);
  printHandoff(state);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("❌ [SPEC-BOOTSTRAP] " + error.message);
    process.exitCode = 1;
  });
}

export { STAGES };
