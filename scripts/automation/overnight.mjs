#!/usr/bin/env node
/**
 * Unattended SDD orchestrator.
 *
 * The shell entrypoint validates SPEC_PATH and delegates here. This module owns
 * durable state, locking, worktree lifecycle, provider fallback, evidence, and
 * the integration branch. main is never checked out or modified by this loop.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseAgentManifest } from "../lib/agent-contract.mjs";
import { resolveCheck } from "../agent/agent-run.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKTREE_PARENT = path.join(ROOT, ".worktrees");
const MANIFEST_FILE = path.join(ROOT, ".agents", "agent-manifest.yml");
const DEFAULT_TIMEOUT_MS = Number(process.env.OVERNIGHT_TIMEOUT_MS || 45 * 60 * 1000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.OVERNIGHT_MAX_ATTEMPTS || 3);
const DEFAULT_RETRY_BASE_MS = Number(process.env.OVERNIGHT_RETRY_BASE_MS || 10_000);
const DEFAULT_RATE_LIMIT_RETRIES = Number(process.env.OVERNIGHT_RATE_LIMIT_RETRIES || 3);
const DEFAULT_RATE_LIMIT_BASE_MS = Number(process.env.OVERNIGHT_RATE_LIMIT_BASE_MS || 60_000);
const MAX_CAPTURED_OUTPUT_BYTES = Number(process.env.OVERNIGHT_MAX_CAPTURED_OUTPUT_BYTES || 64 * 1024);
const EXIT_BLOCKED = 78;
const ROLE_DEFAULT_CHAINS = {
  "spec-analyst": "codex,claude,codex",
  "fullstack-implementer": "codex,claude,codex",
  "quality-reviewer": "claude,codex,claude",
};

export function resolveSpecDir(specPath = process.env.SPEC_PATH, root = ROOT) {
  if (!specPath || !specPath.trim()) {
    throw new Error("SPEC_PATH 未设置。请在启动 overnight.sh 时显式传入规格目录，例如 spec/clue-lens");
  }
  if (path.isAbsolute(specPath) || specPath.split(/[\\/]+/).includes("..")) {
    throw new Error(`SPEC_PATH 必须是仓库内相对路径: ${specPath}`);
  }
  const specDir = path.resolve(root, specPath);
  const rootWithSep = `${path.resolve(root)}${path.sep}`;
  if (!specDir.startsWith(rootWithSep) || !fs.existsSync(specDir) || !fs.statSync(specDir).isDirectory()) {
    throw new Error(`规格目录不存在或不在仓库内: ${specPath}`);
  }
  return specDir;
}

function verifyBootstrapApproval(specDir) {
  const bootstrapStateFile = path.join(specDir, ".sdd-bootstrap-state.json");
  if (!fs.existsSync(bootstrapStateFile)) return;
  let bootstrapState;
  try {
    bootstrapState = JSON.parse(fs.readFileSync(bootstrapStateFile, "utf8"));
  } catch (error) {
    throw new Error(".sdd-bootstrap-state.json 损坏，无法进入实现阶段: " + error.message);
  }
  if (bootstrapState.status !== "approved") {
    throw new Error("规格草稿尚未通过人工确认，当前状态为 " + bootstrapState.status +
      "。请先运行 spec-bootstrap.sh " + bootstrapState.specPath + " approve");
  }
}

function now() {
  return new Date().toISOString();
}

function runGit(args, cwd = ROOT, allowFailure = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} 失败: ${output.trim()}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "", output };
}

function safeFileName(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function parseTasks(content) {
  const tasks = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^- \[([ x?!R])\]\s+([A-Za-z0-9._-]+)\s*(.*)$/);
    if (!match) continue;
    tasks.push({
      id: match[2],
      mark: match[1],
      title: match[3].trim(),
      line: index + 1,
    });
  }
  return tasks;
}

export function readTasks(file) {
  if (!fs.existsSync(file)) throw new Error(`找不到任务清单: ${file}`);
  const content = fs.readFileSync(file, "utf8");
  const tasks = parseTasks(content);
  if (tasks.length === 0) throw new Error(`任务清单没有可解析的顶层任务: ${file}`);
  return { content, tasks };
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
}

export function validateState(state) {
  const required = ["version", "runId", "specPath", "baseline", "integrationBranch", "status", "phase", "tasks", "updatedAt"];
  for (const key of required) {
    if (!(key in state)) throw new Error(`automation-state.json 缺少字段: ${key}`);
  }
  if (state.version !== 1 || typeof state.tasks !== "object" || !state.tasks) {
    throw new Error("automation-state.json 版本或 tasks 结构非法");
  }
  for (const [taskId, task] of Object.entries(state.tasks)) {
    for (const key of ["taskId", "phase", "commitSha", "worktree", "agent", "model", "attempts", "lastHeartbeat"]) {
      if (!(key in task)) throw new Error(`automation-state.json 任务 ${taskId} 缺少字段: ${key}`);
    }
  }
  return state;
}

export function loadState(file) {
  try {
    return validateState(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (error) {
    throw new Error(`automation-state.json 损坏，已停止以避免覆盖现场: ${error.message}`);
  }
}

export function saveState(file, state) {
  state.updatedAt = now();
  state.lastHeartbeat = state.updatedAt;
  validateState(state);
  writeJsonAtomic(file, state);
}

export function createState({ specPath, baseline, integrationBranch, runId, tasks }) {
  const taskState = {};
  for (const task of tasks) {
    taskState[task.id] = {
      taskId: task.id,
      title: task.title,
      status: task.mark,
      phase: task.mark === "x" ? "completed" : "pending",
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
    runId,
    specPath,
    baseline,
    integrationBranch,
    status: "running",
    phase: "fullstack-implementer",
    currentTaskId: null,
    tasks: taskState,
    updatedAt: now(),
    lastHeartbeat: now(),
    host: os.hostname(),
    pid: process.pid,
  };
}

export function acquireLock(lockFile, metadata = {}) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  if (fs.existsSync(lockFile)) {
    let previous = null;
    try {
      previous = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    } catch {
      throw new Error(`锁文件损坏，拒绝并发启动: ${lockFile}`);
    }
    if (previous?.pid) {
      try {
        process.kill(previous.pid, 0);
        throw new Error(`已有调度器运行中，PID=${previous.pid}，拒绝并发启动`);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    fs.unlinkSync(lockFile);
  }
  const fd = fs.openSync(lockFile, "wx");
  fs.writeFileSync(fd, `${JSON.stringify({ pid: process.pid, startedAt: now(), ...metadata }, null, 2)}\n`);
  fs.closeSync(fd);
  let released = false;
  return () => {
    if (!released) {
      released = true;
      try { fs.unlinkSync(lockFile); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  };
}

export function classifyFailure(result) {
  if (result?.timedOut || result?.signal === "SIGTERM" || result?.signal === "SIGKILL") return "timeout";
  const text = `${result?.stderr || ""}\n${result?.error?.message || ""}`.toLowerCase();
  if (/automation-state\.json.*(?:corrupt|invalid|malformed|损坏)|(?:state file|json).*(?:corrupt|invalid|malformed|损坏)/.test(text)) return "state-corrupt";
  if (/worktree.*(?:already exists|conflict|locked|lock|failed|error)|index\.lock|cannot lock ref|branch .* already exists/.test(text)) return "worktree-conflict";
  if (/\b(?:429|rate.?limit|quota exceeded|too many requests|capacity)\b/.test(text)) return "rate-limit";
  if (/\b(?:econnreset|econnrefused|enotfound|etimedout|eai_again)\b|network\s+(?:error|failure|unreachable)|(?:connection|socket|dns).*(?:error|failed|reset|refused|timed out)/.test(text)) return "network";
  return "provider-error";
}

export function backoffDelay(attempt, base = DEFAULT_RETRY_BASE_MS) {
  return Math.min(base * (2 ** Math.max(0, attempt - 1)), 10 * 60 * 1000);
}

export function rateLimitDelay(attempt, base = DEFAULT_RATE_LIMIT_BASE_MS) {
  return Math.min(base * (2 ** Math.max(0, attempt - 1)), 30 * 60 * 1000);
}

export function parseProviderChain(raw, fallback) {
  const value = raw || fallback;
  const chain = value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [agent, ...modelParts] = entry.split(":");
    return { agent: agent.trim(), model: modelParts.join(":").trim() };
  });
  if (chain.length === 0 || chain.some((entry) => !["codex", "claude"].includes(entry.agent))) {
    throw new Error(`Agent 候选链非法: ${value}`);
  }
  return chain;
}

export function roleChain(role) {
  const envName = `OVERNIGHT_${role.replace(/-/g, "_").toUpperCase()}_CHAIN`;
  return parseProviderChain(process.env[envName], ROLE_DEFAULT_CHAINS[role] || "codex,claude,codex");
}

function taskMap(tasks) {
  return new Map(tasks.map((task) => [task.id, task]));
}

export function taskTransition(before, after, expected) {
  const beforeMap = taskMap(before);
  const afterMap = taskMap(after);
  const changed = [];
  for (const [id, oldTask] of beforeMap) {
    const newTask = afterMap.get(id);
    if (!newTask) throw new Error(`任务清单删除了任务 ${id}`);
    if (oldTask.mark !== newTask.mark) changed.push({ id, from: oldTask.mark, to: newTask.mark });
  }
  for (const task of after) if (!beforeMap.has(task.id)) throw new Error(`任务清单新增了未授权任务 ${task.id}`);
  if (changed.length !== 1 || changed[0].id !== expected.id) {
    throw new Error(`任务状态变更数量或目标错误，期望 ${expected.id}，实际 ${changed.map((x) => x.id).join(",") || "无"}`);
  }
  const transition = changed[0];
  if (expected.role === "fullstack-implementer" && !(["?", "!"].includes(transition.to))) {
    throw new Error(`开发角色必须把任务 ${expected.id} 置为 [?] 或 [!]，实际 [${transition.to}]`);
  }
  if (expected.role === "quality-reviewer" && !(["x", "R", "!"].includes(transition.to))) {
    throw new Error(`审查角色必须把任务 ${expected.id} 置为 [x]、[R] 或 [!]，实际 [${transition.to}]`);
  }
  return transition;
}

export async function runWithRetry({ chain, maxAttempts = DEFAULT_MAX_ATTEMPTS, maxRateLimitRetries = DEFAULT_RATE_LIMIT_RETRIES, runner, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), onAttempt = () => {} }) {
  let lastFailure = null;
  let attempt = 0;
  let invocation = 0;
  let rateLimitRetries = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    const provider = chain[invocation % chain.length];
    invocation += 1;
    onAttempt({ attempt, provider });
    const result = await runner({ attempt, provider });
    if (result?.ok) return { ...result, attempt, provider };
    const failureType = result?.failureType || classifyFailure(result);
    lastFailure = { ...result, failureType, attempt, provider };
    if (failureType === "state-corrupt") throw new Error("状态文件损坏，停止自动重试");
    if (failureType === "rate-limit" && rateLimitRetries < maxRateLimitRetries) {
      rateLimitRetries += 1;
      attempt -= 1;
      await sleep(rateLimitDelay(rateLimitRetries));
      continue;
    }
    if (attempt < maxAttempts) await sleep(backoffDelay(attempt));
  }
  const error = new Error(`Agent 在 ${maxAttempts} 次尝试后仍失败: ${lastFailure?.failureType || "unknown"}`);
  error.failure = lastFailure;
  throw error;
}

function agentCommand(provider, model, prompt) {
  if (provider === "codex") {
    return { command: "codex", args: ["exec", "--sandbox", "workspace-write", ...(model ? ["--model", model] : []), prompt] };
  }
  return {
    command: "claude",
    args: ["-p", prompt, ...(model ? ["--model", model] : []), "--dangerously-skip-permissions"],
  };
}

export function runAgentProcess({ provider, model, prompt, cwd, logFile, timeoutMs = DEFAULT_TIMEOUT_MS, env = process.env }) {
  return new Promise((resolve) => {
    const spec = agentCommand(provider, model, prompt);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const log = fs.createWriteStream(logFile, { flags: "a" });
    const child = spawn(spec.command, spec.args, {
      cwd,
      env: { ...env, CI: "1", GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let finished = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => { if (!finished) child.kill("SIGKILL"); }, 5_000).unref();
    }, timeoutMs);
    const appendOutput = (current, chunk) => {
      const value = current + chunk.toString();
      return value.length > MAX_CAPTURED_OUTPUT_BYTES ? value.slice(-MAX_CAPTURED_OUTPUT_BYTES) : value;
    };
    child.stdout.on("data", (chunk) => { stdout = appendOutput(stdout, chunk); log.write(chunk); });
    child.stderr.on("data", (chunk) => { stderr = appendOutput(stderr, chunk); log.write(chunk); });
    child.on("error", (error) => { clearTimeout(timer); log.end(); resolve({ ok: false, error, stdout, stderr, timedOut }); });
    child.on("close", (code, signal) => {
      finished = true;
      clearTimeout(timer);
      log.end();
      resolve({ ok: code === 0 && !timedOut, code, signal, stdout, stderr, timedOut });
    });
  });
}

function pathMatches(file, pattern) {
  const normalizedFile = file.replaceAll("\\", "/");
  const normalizedPattern = pattern.replaceAll("\\", "/");
  if (normalizedPattern.endsWith("/")) {
    const directory = normalizedPattern.slice(0, -1);
    return normalizedFile === directory || normalizedFile.startsWith(normalizedPattern);
  }
  if (!normalizedPattern.includes("*")) {
    return normalizedFile === normalizedPattern || normalizedFile.startsWith(`${normalizedPattern}/`);
  }
  const escaped = normalizedPattern
    .replace(/\*\*/g, "\u0000")
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\u0000/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`).test(normalizedFile);
}

function roleFromManifest(roleId) {
  const manifest = parseAgentManifest(fs.readFileSync(MANIFEST_FILE, "utf8"));
  const role = manifest.roles.find((item) => item.id === roleId);
  if (!role) throw new Error(`manifest 中不存在角色 ${roleId}`);
  return role;
}

function changedFiles(base, cwd) {
  return runGit(["diff", "--name-only", `${base}..HEAD`], cwd).stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function validateAllowedPaths(files, role) {
  const violations = files.filter((file) => !role.allowed_paths.some((pattern) => pathMatches(file, pattern)) || role.forbidden_paths.some((pattern) => pathMatches(file, pattern)));
  if (violations.length > 0) throw new Error(`角色 ${role.id} 修改了未允许路径: ${violations.join(", ")}`);
}

function runCommand(command, cwd, logFile) {
  const guard = spawnSync(process.execPath, [path.join(ROOT, "scripts/agent/pre-tool-guard.mjs"), command], { encoding: "utf8" });
  if (guard.status !== 0) throw new Error(`命令被安全护栏拦截: ${command}\n${guard.stderr || ""}`);
  const result = spawnSync("bash", ["-lc", command], { cwd, encoding: "utf8" });
  fs.appendFileSync(logFile, `\n$ ${command}\n${result.stdout || ""}${result.stderr || ""}`);
  if (result.status !== 0) throw new Error(`声明命令失败: ${command}`);
}

function runDeclaredChecks(role, cwd, logFile) {
  for (const command of role.commands || []) runCommand(command, cwd, logFile);
  for (const check of role.checks || []) {
    const resolved = resolveCheck(check);
    if (!resolved) throw new Error(`未知检查项: ${check}`);
    if (resolved.kind === "npm") runCommand(`npm run ${resolved.script}`, cwd, logFile);
    else if (resolved.kind === "node") runCommand(`node ${resolved.script}`, cwd, logFile);
    else if (resolved.kind === "markdown-links" || resolved.kind === "spec-consistency") {
      if (!fs.existsSync(path.join(cwd, "spec"))) throw new Error("spec 目录不存在");
    }
  }
}

function taskPrompt(role, specPath, task) {
  if (role === "fullstack-implementer") {
    return `你是实现角色。严格按 spec/${specPath}/requirements.md、design.md 和 tasks.md 工作。只处理任务 ${task.id}：${task.title}。先读取项目 AGENTS.md、相关 rules 和既有实现。只修改该任务允许的文件。完成后运行任务验收命令和 manifest 声明检查。确认通过后只把顶层任务 ${task.id} 从 [ ] 或 [R] 改为 [?]，失败且无法修复才改为 [!]，追加实现记录并提交 Git。不要修改其他任务，不要推送远程，不要操作主工作区。`;
  }
  return `你是独立质量审查角色。审查 spec/${specPath}/tasks.md 中任务 ${task.id} 的最新实现。读取该任务对应 requirements.md、design.md、代码差异和验收标准。亲自运行声明的检查，不能相信实现者的文字结论。只允许修改审查证据、任务状态和必要的审查规则文件。通过时把任务 ${task.id} 改为 [x]，不通过改为 [R] 并写清复现步骤，连续失败才改为 [!]。提交 Git，不要修改 src/ 代码。`;
}

async function runTrackedAgent({ state, stateFile, taskState, ...options }) {
  const heartbeat = setInterval(() => {
    taskState.lastHeartbeat = now();
    saveState(stateFile, state);
  }, 30_000);
  heartbeat.unref?.();
  try {
    return await runAgentProcess(options);
  } finally {
    clearInterval(heartbeat);
    taskState.lastHeartbeat = now();
    saveState(stateFile, state);
  }
}

function evidenceContent({ runId, task, role, provider, model, base, head, files, checks, status, note }) {
  return `# Overnight Agent Evidence\n\n- Run ID: \`${runId}\`\n- Task: \`${task.id}\` ${task.title}\n- Role: \`${role}\`\n- Agent: \`${provider}\`\n- Model: \`${model || "default"}\`\n- Base: \`${base}\`\n- Commit: \`${head}\`\n- Decision: **${status}**\n\n## Changed files\n\n${files.map((file) => `- \`${file}\``).join("\n") || "- none"}\n\n## Checks\n\n${checks.map((check) => `- ${check}`).join("\n") || "- none"}\n\n## Note\n\n${note || "Deterministic orchestration evidence generated after command and Git checks."}\n`;
}

function createIntegrationBranch(branch, baseline) {
  const exists = runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], ROOT, true).status === 0;
  if (!exists) runGit(["branch", branch, baseline]);
}

function ensureIntegrationWorktree(branch, runId) {
  const dir = path.join(WORKTREE_PARENT, `clue-lens-integration-${safeFileName(runId)}`);
  if (!fs.existsSync(dir)) {
    runGit(["worktree", "add", dir, branch]);
    const nmSource = path.join(ROOT, "node_modules");
    const nmDest = path.join(dir, "node_modules");
    if (fs.existsSync(nmSource) && !fs.existsSync(nmDest)) fs.symlinkSync(nmSource, nmDest, "dir");
  }
  return dir;
}

function removeIntegrationWorktree(dir) {
  if (fs.existsSync(dir)) runGit(["worktree", "remove", "--force", dir], ROOT, true);
}

function worktreeCommand(action, slug, base) {
  const args = [path.join(ROOT, "scripts/agent/worktree.mjs"), action, slug];
  if (action === "new") args.push("--base", base);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, WORKTREE_PARENT },
  });
  if (result.status !== 0) throw new Error(`${action} worktree 失败: ${result.stdout || ""}${result.stderr || ""}`);
  return path.join(WORKTREE_PARENT, `clue-lens-${slug}`);
}

function dropWorktree(slug) {
  spawnSync(process.execPath, [path.join(ROOT, "scripts/agent/worktree.mjs"), "drop", slug], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, WORKTREE_PARENT },
  });
}

function resetWorktreeForRetry(cwd, base) {
  runGit(["reset", "--hard", base], cwd);
  runGit(["clean", "-fd"], cwd);
}

function commitEvidence(cwd, file, content, message) {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content, "utf8");
  runGit(["add", "-A"], cwd);
  runGit(["commit", "-m", message], cwd);
}

async function processTask({ state, stateFile, specDir, integrationDir, task, maxAttempts }) {
  const taskState = state.tasks[task.id];
  if (!taskState) throw new Error(`automation-state.json 没有任务 ${task.id}`);
  const specPath = state.specPath.replace(/^spec\//, "");
  const builderRole = roleFromManifest("fullstack-implementer");
  const reviewerRole = roleFromManifest("quality-reviewer");
  const taskSlug = `${safeFileName(state.runId)}-${safeFileName(task.id)}-${taskState.attempts + 1}`;
  taskState.attempts += 1;
  taskState.phase = "builder-running";
  taskState.lastHeartbeat = now();
    state.currentTaskId = task.id;
    state.status = "running";
  state.phase = "fullstack-implementer";
  saveState(stateFile, state);

  const builderSlug = `${taskSlug}-builder`;
  let builderDir;
  let reviewerDir;
  try {
    builderDir = worktreeCommand("new", builderSlug, state.integrationBranch);
    taskState.worktree = builderDir;
    saveState(stateFile, state);
    const builderLog = path.join(specDir, "automation-logs", `${taskSlug}-builder.log`);
    fs.mkdirSync(path.dirname(builderLog), { recursive: true });
    const builderResult = await runWithRetry({
      chain: roleChain("fullstack-implementer"),
      maxAttempts,
      runner: async ({ attempt, provider }) => {
        taskState.agent = provider.agent;
        taskState.model = provider.model;
        taskState.lastHeartbeat = now();
        saveState(stateFile, state);
        const result = await runTrackedAgent({ state, stateFile, taskState, provider: provider.agent, model: provider.model, prompt: taskPrompt("fullstack-implementer", specPath, task), cwd: builderDir, logFile: builderLog });
        if (!result.ok) {
          const failureType = classifyFailure(result);
          if (attempt < maxAttempts && failureType !== "state-corrupt") {
            try {
              resetWorktreeForRetry(builderDir, state.integrationBranch);
            } catch (error) {
              return { ...result, failureType: "worktree-conflict", error };
            }
          }
          return { ...result, failureType };
        }
        return result;
      },
      onAttempt: ({ attempt, provider }) => {
        taskState.agent = provider.agent;
        taskState.model = provider.model;
        taskState.lastHeartbeat = now();
        saveState(stateFile, state);
        fs.appendFileSync(builderLog, `\nAttempt ${attempt}: ${provider.agent}/${provider.model || "default"}\n`);
      },
    });
    if (!builderResult.ok) throw new Error("实现 Agent 未成功完成");
    const builderHead = runGit(["rev-parse", "HEAD"], builderDir).stdout.trim();
    const builderStatus = runGit(["status", "--porcelain"], builderDir).stdout.trim();
    if (builderStatus) throw new Error("实现 Agent 结束后仍有未提交变更");
    if (runGit(["rev-list", "--count", `${state.integrationBranch}..HEAD`], builderDir).stdout.trim() === "0") throw new Error("实现 Agent 没有提交任何变更");
    const builderFiles = changedFiles(state.integrationBranch, builderDir);
    validateAllowedPaths(builderFiles, builderRole);
    const beforeTasks = readTasks(path.join(integrationDir, state.specPath, "tasks.md")).tasks;
    const afterTasks = readTasks(path.join(builderDir, state.specPath, "tasks.md")).tasks;
    const transition = taskTransition(beforeTasks, afterTasks, { id: task.id, role: "fullstack-implementer" });
    taskState.status = transition.to;
    taskState.phase = "builder-validated";
    taskState.commitSha = builderHead;
    saveState(stateFile, state);

    runDeclaredChecks(builderRole, builderDir, builderLog);
    const builderPostCheckStatus = runGit(["status", "--porcelain"], builderDir).stdout.trim();
    if (builderPostCheckStatus) {
      const generated = builderPostCheckStatus.split(/\r?\n/).map((line) => line.slice(3).trim()).filter(Boolean);
      validateAllowedPaths(generated, builderRole);
    }
    const builderEvidence = path.join("evidence", "agent-runs", state.runId, `${safeFileName(task.id)}-fullstack-implementer.md`);
    commitEvidence(builderDir, builderEvidence, evidenceContent({ runId: state.runId, task, role: builderRole.id, provider: builderResult.provider.agent, model: builderResult.provider.model, base: state.integrationBranch, head: runGit(["rev-parse", "HEAD"], builderDir).stdout.trim(), files: builderFiles, checks: builderRole.commands.concat(builderRole.checks), status: "BUILDER_PASS", note: "实现提交、允许路径、任务状态和声明检查均已由调度器复核。" }), `chore(automation): record builder evidence for ${task.id}`);

    const builderBranch = `agent/${builderSlug}`;
    const reviewerSlug = `${taskSlug}-reviewer`;
    reviewerDir = worktreeCommand("new", reviewerSlug, builderBranch);
    taskState.worktree = reviewerDir;
    taskState.phase = "reviewer-running";
    state.phase = "quality-reviewer";
    saveState(stateFile, state);
    const reviewerLog = path.join(specDir, "automation-logs", `${taskSlug}-reviewer.log`);
    fs.mkdirSync(path.dirname(reviewerLog), { recursive: true });
    const reviewerResult = await runWithRetry({
      chain: roleChain("quality-reviewer"),
      maxAttempts,
      runner: async ({ attempt: retryAttempt, provider }) => {
        taskState.agent = provider.agent;
        taskState.model = provider.model;
        taskState.lastHeartbeat = now();
        saveState(stateFile, state);
        const result = await runTrackedAgent({ state, stateFile, taskState, provider: provider.agent, model: provider.model, prompt: taskPrompt("quality-reviewer", specPath, task), cwd: reviewerDir, logFile: reviewerLog });
        if (!result.ok) {
          const failureType = classifyFailure(result);
          if (retryAttempt < maxAttempts && failureType !== "state-corrupt") {
            try {
              resetWorktreeForRetry(reviewerDir, builderBranch);
            } catch (error) {
              return { ...result, failureType: "worktree-conflict", error };
            }
          }
          return { ...result, failureType };
        }
        return result;
      },
    });
    const reviewerHead = runGit(["rev-parse", "HEAD"], reviewerDir).stdout.trim();
    if (!reviewerResult.ok) throw new Error("质量审查 Agent 未成功完成");
    if (runGit(["status", "--porcelain"], reviewerDir).stdout.trim()) throw new Error("质量审查 Agent 结束后仍有未提交变更");
    if (runGit(["rev-list", "--count", `${builderBranch}..HEAD`], reviewerDir).stdout.trim() === "0") throw new Error("质量审查 Agent 没有提交审查结果");
    const reviewerFiles = changedFiles(builderBranch, reviewerDir);
    validateAllowedPaths(reviewerFiles, reviewerRole);
    const reviewerBefore = readTasks(path.join(builderDir, state.specPath, "tasks.md")).tasks;
    const reviewerAfter = readTasks(path.join(reviewerDir, state.specPath, "tasks.md")).tasks;
    const reviewTransition = taskTransition(reviewerBefore, reviewerAfter, { id: task.id, role: "quality-reviewer" });
    runDeclaredChecks(reviewerRole, reviewerDir, reviewerLog);
    const reviewerPostCheckStatus = runGit(["status", "--porcelain"], reviewerDir).stdout.trim();
    if (reviewerPostCheckStatus) {
      const generated = reviewerPostCheckStatus.split(/\r?\n/).map((line) => line.slice(3).trim()).filter(Boolean);
      validateAllowedPaths(generated, reviewerRole);
    }
    const reviewerEvidence = path.join("evidence", "agent-runs", state.runId, `${safeFileName(task.id)}-quality-reviewer.md`);
    commitEvidence(reviewerDir, reviewerEvidence, evidenceContent({ runId: state.runId, task, role: reviewerRole.id, provider: reviewerResult.provider.agent, model: reviewerResult.provider.model, base: builderBranch, head: reviewerHead, files: reviewerFiles, checks: reviewerRole.commands.concat(reviewerRole.checks), status: reviewTransition.to === "x" ? "REVIEW_PASS" : "REVIEW_BLOCKED", note: reviewTransition.to === "x" ? "独立审查通过，随后进入夜间集成分支。" : "独立审查未通过，任务保留在审查结果状态。" }), `chore(automation): record reviewer evidence for ${task.id}`);
    const reviewerBranch = `agent/${reviewerSlug}`;
    runGit(["-C", integrationDir, "merge", "--ff-only", reviewerBranch]);
    taskState.status = reviewTransition.to;
    taskState.phase = reviewTransition.to === "x" ? "merged" : "blocked";
    taskState.commitSha = runGit(["rev-parse", "HEAD"], integrationDir).stdout.trim();
    taskState.worktree = null;
    state.currentTaskId = null;
    state.phase = reviewTransition.to === "x" ? "fullstack-implementer" : "quality-reviewer";
    saveState(stateFile, state);
    dropWorktree(builderSlug);
    dropWorktree(reviewerSlug);
    return reviewTransition.to === "x";
  } catch (error) {
    taskState.phase = "blocked";
    taskState.lastHeartbeat = now();
    state.status = "blocked";
    saveState(stateFile, state);
    throw error;
  }
}

function allCompleted(state) {
  return Object.values(state.tasks).every((task) => task.status === "x" || task.phase === "completed" || task.phase === "merged");
}

function installSupervisor(specPath) {
  const project = ROOT;
  const script = path.join(project, "scripts/overnight.sh");
  const logDir = path.join(project, "logs/overnight");
  fs.mkdirSync(logDir, { recursive: true });
  if (process.platform === "darwin") {
    const target = path.join(os.homedir(), "Library/LaunchAgents/com.clue-lens.overnight.plist");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.clue-lens.overnight</string><key>ProgramArguments</key><array><string>${script}</string><string>${specPath}</string><string>run</string></array><key>WorkingDirectory</key><string>${project}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><false/><key>StartInterval</key><integer>300</integer><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${path.join(logDir, "launchd.out.log")}</string><key>StandardErrorPath</key><string>${path.join(logDir, "launchd.err.log")}</string></dict></plist>\n`, "utf8");
    console.log(`已生成 launchd 配置: ${target}`);
    console.log(`加载命令: launchctl bootstrap gui/${process.getuid?.() || "$(id -u)"} ${target}`);
    return;
  }
  const target = path.join(os.homedir(), ".config/systemd/user/clue-lens-overnight.service");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `[Unit]\nDescription=clue-lens overnight SDD automation\nAfter=network-online.target\n\n[Service]\nType=simple\nWorkingDirectory=${project}\nExecStart=${script} ${specPath} run\nRestart=on-failure\nRestartSec=30\n\n[Install]\nWantedBy=default.target\n`, "utf8");
  console.log(`已生成 systemd user service: ${target}`);
  console.log("安装命令: systemctl --user enable --now clue-lens-overnight.service");
}

async function main() {
  const mode = process.argv[2] || "run";
  const specPath = process.env.SPEC_PATH;
  const specDir = resolveSpecDir(specPath);
  if (mode === "install-launchd" || mode === "install-systemd") {
    installSupervisor(specPath);
    return;
  }
  const stateFile = path.join(specDir, "automation-state.json");
  const lockFile = path.join(specDir, ".automation.lock");
  if (mode === "status") {
    if (!fs.existsSync(stateFile)) { console.log("没有 automation-state.json，尚未启动过调度器。"); return; }
    console.log(JSON.stringify(loadState(stateFile), null, 2));
    return;
  }
  if (mode === "stop") {
    if (!fs.existsSync(lockFile)) { console.log("当前没有运行中的调度器。"); return; }
    const release = acquireLock(lockFile, { command: "stop-check" });
    release();
    console.log("已清理失效锁文件。运行中的有效进程需要通过系统服务停止。");
    return;
  }
  if (!["run", "resume"].includes(mode)) throw new Error(`未知模式: ${mode}`);
  if (mode === "run" && fs.existsSync(stateFile) && loadState(stateFile).status === "blocked") return;
  verifyBootstrapApproval(specDir);
  const releaseLock = acquireLock(lockFile, { specPath, mode });
  let integrationDir;
  try {
    let state;
    if (fs.existsSync(stateFile)) {
      state = loadState(stateFile);
      if (state.specPath !== specPath) throw new Error("automation-state.json 的 SPEC_PATH 与启动参数不一致");
    } else {
      const tasks = readTasks(path.join(specDir, "tasks.md")).tasks;
      const baseline = process.env.OVERNIGHT_BASELINE || "main";
      runGit(["rev-parse", "--verify", baseline]);
      const runId = `overnight-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const integrationBranch = process.env.OVERNIGHT_INTEGRATION_BRANCH || `overnight/${safeFileName(runId)}`;
      createIntegrationBranch(integrationBranch, baseline);
      state = createState({ specPath, baseline, integrationBranch, runId, tasks });
      saveState(stateFile, state);
    }
    integrationDir = ensureIntegrationWorktree(state.integrationBranch, state.runId);
    const maxTasks = Number(process.env.OVERNIGHT_MAX_TASKS || 1000);
    const idleMs = Number(process.env.OVERNIGHT_IDLE_MS || 5_000);
    for (let completedThisRun = 0; completedThisRun < maxTasks; completedThisRun += 1) {
      if (allCompleted(state)) {
        state.status = "completed";
        state.phase = "quality-reviewer";
        saveState(stateFile, state);
        console.log(`所有任务已完成。夜间集成分支为 ${state.integrationBranch}`);
        return;
      }
      const currentTasks = readTasks(path.join(integrationDir, specPath, "tasks.md")).tasks;
      const task = currentTasks.find((item) => item.mark === " " || item.mark === "R" || item.mark === "?");
      if (!task) throw new Error("任务清单状态无法推进，可能存在未支持的状态或状态文件损坏");
      if (state.tasks[task.id]?.attempts >= DEFAULT_MAX_ATTEMPTS) throw new Error(`任务 ${task.id} 已达到最大尝试次数`);
      await processTask({ state, stateFile, specDir, integrationDir, task, maxAttempts: DEFAULT_MAX_ATTEMPTS });
      console.log(`任务 ${task.id} 已处理。集成分支为 ${state.integrationBranch}`);
      await new Promise((resolve) => setTimeout(resolve, idleMs));
    }
    console.log(`已达到本次运行任务上限 ${maxTasks}。下次由 supervisor 或 resume 继续。`);
    state.status = allCompleted(state) ? "completed" : "running";
    saveState(stateFile, state);
    if (state.status !== "completed") process.exitCode = 75;
  } finally {
    if (integrationDir) removeIntegrationWorktree(integrationDir);
    releaseLock();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`❌ [OVERNIGHT] ${error.message}`);
    try {
      const specPath = process.env.SPEC_PATH;
      const stateFile = specPath ? path.join(resolveSpecDir(specPath), "automation-state.json") : "";
      const state = stateFile && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
      process.exitCode = state?.status === "blocked" ? EXIT_BLOCKED : 1;
    } catch {
      process.exitCode = 1;
    }
  });
}

