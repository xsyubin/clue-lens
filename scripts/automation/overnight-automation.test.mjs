import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import * as automation from "./overnight.mjs";

test("SPEC_PATH 必须显式指向仓库内规格目录", () => {
  assert.throws(() => automation.resolveSpecDir(""), /SPEC_PATH 未设置/);
  assert.throws(() => automation.resolveSpecDir("../outside"), /必须是仓库内相对路径/);
  const dir = automation.resolveSpecDir("spec/clue-lens");
  assert.ok(dir.endsWith(path.join("spec", "clue-lens")));
});

test("任务状态持久化包含断点恢复所需字段", () => {
  const state = automation.createState({
    specPath: "spec/clue-lens",
    baseline: "main",
    integrationBranch: "overnight/test",
    runId: "test-run",
    tasks: [{ id: "1.1", mark: " ", title: "demo", line: 1 }],
  });
  assert.equal(state.tasks["1.1"].taskId, "1.1");
  assert.equal(state.tasks["1.1"].phase, "pending");
  assert.equal(typeof state.tasks["1.1"].lastHeartbeat, "string");
  assert.doesNotThrow(() => automation.validateState(state));
});

test("锁文件拒绝并发调度器并可释放", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overnight-lock-"));
  const lock = path.join(dir, ".automation.lock");
  const release = automation.acquireLock(lock, { runId: "one" });
  assert.throws(() => automation.acquireLock(lock, { runId: "two" }), /已有调度器运行中/);
  release();
  const releaseAgain = automation.acquireLock(lock, { runId: "three" });
  releaseAgain();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("超时、限流、网络和 worktree 冲突会被分类并触发候选链切换", async () => {
  assert.equal(automation.classifyFailure({ timedOut: true }), "timeout");
  assert.equal(automation.classifyFailure({ stderr: "HTTP 429 rate limit" }), "rate-limit");
  assert.equal(automation.classifyFailure({ stderr: "ECONNRESET network" }), "network");
  assert.equal(automation.classifyFailure({ stderr: "worktree already exists" }), "worktree-conflict");
  assert.equal(automation.classifyFailure({ stdout: "讨论 automation-state.json、network 和 worktree" }), "provider-error");
  assert.equal(automation.classifyFailure({ code: 0, stderr: "fatal: network error" }), "provider-error");
  assert.equal(automation.classifyFailure({ code: 1, stdout: JSON.stringify({ type: "turn.failed", error: { message: "HTTP 429 rate limit" } }) }), "rate-limit");
  assert.equal(automation.classifyFailure({ code: 1, stdout: "HTTP 429 Too Many Requests" }), "rate-limit");
  assert.equal(automation.classifyFailure({ code: 1, stderr: "normal mention of automation-state.json" }), "provider-error");
  assert.equal(automation.classifyFailure({ code: 1, stderr: "automation-state.json is corrupt" }), "state-corrupt");

  for (const failureType of ["rate-limit", "network", "worktree-conflict"]) {
    const seen = [];
    const result = await automation.runWithRetry({
      chain: [{ agent: "codex", model: "m1" }, { agent: "claude", model: "m2" }],
      maxAttempts: 2,
      sleep: async () => {},
      runner: async ({ provider }) => {
        seen.push(provider.agent);
        return seen.length === 1 ? { ok: false, failureType } : { ok: true };
      },
    });
    assert.deepEqual(seen, ["codex", "claude"]);
    assert.equal(result.provider.agent, "claude");
  }
});

test("限流重试不消耗普通尝试次数并使用长退避", async () => {
  const seen = [];
  const delays = [];
  const result = await automation.runWithRetry({
    chain: [{ agent: "codex", model: "m1" }, { agent: "claude", model: "m2" }],
    maxAttempts: 1,
    maxRateLimitRetries: 1,
    sleep: async (delay) => delays.push(delay),
    runner: async ({ attempt, provider }) => {
      seen.push({ attempt, provider: provider.agent });
      return seen.length === 1 ? { ok: false, failureType: "rate-limit" } : { ok: true };
    },
  });
  assert.equal(result.provider.agent, "claude");
  assert.deepEqual(seen.map((entry) => entry.attempt), [1, 1]);
  assert.ok(delays[0] >= 60_000);
});

test("允许路径匹配要求目录边界", () => {
  const role = { id: "test", allowed_paths: ["spec/clue-lens"], forbidden_paths: [] };
  assert.doesNotThrow(() => automation.validateAllowedPaths(["spec/clue-lens/tasks.md"], role));
  assert.throws(() => automation.validateAllowedPaths(["spec/clue-lens-evil/tasks.md"], role), /未允许路径/);
});

test("glob 路径匹配支持 ** 跨目录与零层目录，并保持单星号不跨目录", () => {
  const recursive = { id: "glob", allowed_paths: ["src/**"], forbidden_paths: [] };
  for (const file of ["src/a.ts", "src/a/b.ts", "src/"]) {
    assert.doesNotThrow(() => automation.validateAllowedPaths([file], recursive));
  }
  const basename = { id: "glob", allowed_paths: ["**/secrets.json"], forbidden_paths: [] };
  for (const file of ["secrets.json", "a/secrets.json", "a/b/secrets.json"]) {
    assert.doesNotThrow(() => automation.validateAllowedPaths([file], basename));
  }
  const single = { id: "glob", allowed_paths: ["src/*"], forbidden_paths: [] };
  assert.doesNotThrow(() => automation.validateAllowedPaths(["src/a.ts"], single));
  assert.throws(() => automation.validateAllowedPaths(["src/a/b.ts"], single), /未允许路径/);
});

test("Agent 进程超时会被终止并留下失败结果", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overnight-agent-"));
  const fakeBin = path.join(dir, "codex");
  const logFile = path.join(dir, "agent.log");
  fs.writeFileSync(fakeBin, "#!/bin/sh\nsleep 1\n", "utf8");
  fs.chmodSync(fakeBin, 0o755);
  const result = await automation.runAgentProcess({
    provider: "codex",
    model: "fake",
    prompt: "test",
    cwd: dir,
    logFile,
    timeoutMs: 20,
    env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH || ""}` },
  });
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("状态损坏不会自动覆盖或重试", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overnight-state-"));
  const stateFile = path.join(dir, "automation-state.json");
  fs.writeFileSync(stateFile, "{broken", "utf8");
  assert.throws(() => automation.loadState(stateFile), /automation-state.json 损坏/);
  await assert.rejects(
    automation.runWithRetry({
      chain: [{ agent: "codex", model: "m1" }, { agent: "claude", model: "m2" }],
      maxAttempts: 2,
      sleep: async () => {},
      runner: async () => ({ ok: false, failureType: "state-corrupt" }),
    }),
    /状态文件损坏/,
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test("进程重启后可以从磁盘恢复同一任务断点", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overnight-resume-"));
  const stateFile = path.join(dir, "automation-state.json");
  const state = automation.createState({
    specPath: "spec/clue-lens",
    baseline: "main",
    integrationBranch: "overnight/reboot",
    runId: "reboot-run",
    tasks: [{ id: "2.1", mark: " ", title: "resume", line: 1 }],
  });
  state.currentTaskId = "2.1";
  state.phase = "fullstack-implementer";
  state.status = "running";
  state.tasks["2.1"].phase = "builder-running";
  state.tasks["2.1"].attempts = 1;
  automation.saveState(stateFile, state);
  const recovered = automation.loadState(stateFile);
  assert.equal(recovered.currentTaskId, "2.1");
  assert.equal(recovered.tasks["2.1"].phase, "builder-running");
  assert.equal(recovered.tasks["2.1"].attempts, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("任务状态只能由当前角色完成单步转换", () => {
  const before = [
    { id: "1.1", mark: " ", title: "demo", line: 1 },
    { id: "1.2", mark: "x", title: "done", line: 2 },
  ];
  const after = [
    { id: "1.1", mark: "?", title: "demo", line: 1 },
    { id: "1.2", mark: "x", title: "done", line: 2 },
  ];
  assert.equal(automation.taskTransition(before, after, { id: "1.1", role: "fullstack-implementer" }).to, "?");
  assert.throws(() => automation.taskTransition(before, [{ ...after[0], mark: "x" }, after[1]], { id: "1.1", role: "fullstack-implementer" }), /开发角色必须/);
});
