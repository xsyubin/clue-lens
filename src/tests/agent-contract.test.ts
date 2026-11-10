import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CHECK_MANIFEST = path.resolve(__dirname, "../../scripts/gates/check-manifest.mjs");
const CHECK_SECRETS = path.resolve(__dirname, "../../scripts/gates/check-secrets.mjs");
const AGENT_CONTRACT = path.resolve(__dirname, "../../scripts/lib/agent-contract.mjs");
const AGENT_RUN = path.resolve(__dirname, "../../scripts/agent/agent-run.mjs");
const REVIEW_SCRIPT = path.resolve(__dirname, "../../scripts/review.mjs");

// 探测仓库根目录
let repoRoot: string;
try {
  const res = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: __dirname, encoding: "utf8" });
  repoRoot = (res.stdout || "").trim() || path.resolve(__dirname, "../..");
} catch {
  repoRoot = path.resolve(__dirname, "../..");
}

function runNode(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, ...env } });
}

test("agent-manifest 契约解析与结构门禁 (check-manifest.mjs)", async (t) => {
  await t.test("真实 manifest 结构校验通过", () => {
    const res = runNode([CHECK_MANIFEST]);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /结构校验通过/);
  });

  await t.test("非法缩进 fail-loud：报出具体行号而非静默通过", () => {
    const tmp = path.join(os.tmpdir(), `broken-manifest-${Date.now()}.yml`);
    fs.writeFileSync(tmp, 'version: 1\nproject: x\nroles:\n  - id: r1\n   objective: "坏缩进"\n', "utf8");
    const res = runNode([CHECK_MANIFEST], { AGENT_MANIFEST_FILE: tmp });
    fs.rmSync(tmp, { force: true });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /第 \d+ 行解析失败/);
  });

  await t.test("声明不支持的检查项被阻断（防 fail-open 契约漂移）", () => {
    const tmp = path.join(os.tmpdir(), `bogus-manifest-${Date.now()}.yml`);
    fs.writeFileSync(
      tmp,
      [
        "version: 1",
        "project: clue-lens",
        "roles:",
        "  - id: tester",
        '    objective: "测试角色"',
        '    inputs: ["a"]',
        '    outputs: ["b"]',
        '    allowed_paths: ["spec/"]',
        '    forbidden_paths: ["src/"]',
        '    checks: ["bogus-check"]',
        '    commands: ["git diff --check"]',
        "execution:",
        '  merge_policy: "evidence/agent-runs/<run-id>"',
      ].join("\n"),
      "utf8",
    );
    const res = runNode([CHECK_MANIFEST], { AGENT_MANIFEST_FILE: tmp });
    fs.rmSync(tmp, { force: true });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /不支持的检查项: bogus-check/);
  });

  await t.test("SUPPORTED_CHECKS 与 agent-run resolveCheck 全量对齐（防命名漂移空转）", () => {
    const script = `
      Promise.all([
        import(${JSON.stringify(pathToFileURL(AGENT_CONTRACT).href)}),
        import(${JSON.stringify(pathToFileURL(AGENT_RUN).href)}),
      ]).then(([contract, agentRun]) => {
        for (const name of contract.SUPPORTED_CHECKS) {
          if (!agentRun.resolveCheck(name)) {
            console.error("agent-run 无法解析的检查项: " + name);
            process.exit(1);
          }
        }
        if (agentRun.resolveCheck("definitely-not-a-check") !== null) {
          console.error("未知检查项不应被解析为有效检查");
          process.exit(1);
        }
        process.exit(0);
      }).catch((err) => { console.error(err); process.exit(1); });
    `;
    const res = runNode(["-e", script]);
    assert.equal(res.status, 0, res.stderr);
  });
});

test("check-secrets.mjs 扫描语义回归", async (t) => {
  await t.test("显式文件模式检测到 AKIA 密钥并脱敏输出", () => {
    // 运行时拼接夹具：源码中不得出现连续的密钥字面量，避免误触自身密钥门禁
    const fakeAkiaKey = ["AKIA", "IOSFODNN", "7EXAMPLE"].join("");
    const tmp = path.join(os.tmpdir(), `fake-secret-${Date.now()}.txt`);
    fs.writeFileSync(tmp, `aws_key=${fakeAkiaKey}\n`, "utf8");
    const res = runNode([CHECK_SECRETS, tmp]);
    fs.rmSync(tmp, { force: true });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /\[REDACTED\]/);
    assert.doesNotMatch(res.stderr, new RegExp(fakeAkiaKey));
  });

  await t.test("--staged 旗标不再被误当文件名（旧版空转缺陷回归）", () => {
    const res = runNode([CHECK_SECRETS, "--staged"], { cwd: repoRoot });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /已扫描 \d+ 个文件/);
  });
});

test("review.mjs 审查报告确定性与幂等写入回归", async (t) => {
  const tmpChecks = path.join(os.tmpdir(), `test-checks-${Date.now()}.list`);
  const tmpReport = path.join(os.tmpdir(), `test-report-${Date.now()}.md`);
  // 创建轻量通过的测试检查项（毫秒级执行）
  fs.writeFileSync(tmpChecks, "scripts/gates/check-manifest.mjs\n", "utf8");

  t.after(() => {
    fs.rmSync(tmpChecks, { force: true });
    fs.rmSync(tmpReport, { force: true });
  });

  await t.test("首次生成：生成规范确定性报告，且不含动态物理时间戳", () => {
    const res = runNode([REVIEW_SCRIPT], {
      DETERMINISTIC_REVIEW_CHECKS_FILE: tmpChecks,
      DETERMINISTIC_REVIEW_REPORT_FILE: tmpReport,
    });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /审查报告已更新/);

    const content = fs.readFileSync(tmpReport, "utf8");
    assert.match(content, /# 确定性机器前置审查报告/);
    assert.match(content, /🟢 PASS/);
    assert.doesNotMatch(content, /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, "报告不得包含秒级时间戳导致版本库漂移");
    assert.doesNotMatch(content, /Git Staged|本地完整工作区/, "报告元数据不得受运行期范围影响产生文本横跳");
  });

  await t.test("幂等验证：再次运行（即使传入 --staged）内容保持严格一致且提示保持幂等", () => {
    const contentBefore = fs.readFileSync(tmpReport, "utf8");

    const res = runNode([REVIEW_SCRIPT, "--staged"], {
      DETERMINISTIC_REVIEW_CHECKS_FILE: tmpChecks,
      DETERMINISTIC_REVIEW_REPORT_FILE: tmpReport,
    });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /保持幂等/);

    const contentAfter = fs.readFileSync(tmpReport, "utf8");
    assert.equal(contentAfter, contentBefore, "再次运行生成的报告内容必须 100% 字节相同");
  });
});
