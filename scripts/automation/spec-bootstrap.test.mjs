import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STAGES,
  createState,
  parseArgs,
  resolveSpecPath,
  validateStageFiles,
} from "./spec-bootstrap.mjs";

test("规格 bootstrap 要求显式 spec 路径并支持一句话需求", () => {
  const args = parseArgs(["spec/new-feature", "run", "--requirement", "建设线索分析页面"]);
  assert.equal(args.specPath, "spec/new-feature");
  assert.equal(args.requirement, "建设线索分析页面");
  assert.throws(() => resolveSpecPath("new-feature"), /必须指向 spec/);
  assert.ok(resolveSpecPath("spec/new-feature").endsWith("spec/new-feature"));
});

test("规格 bootstrap 状态覆盖四个前置 SDD 阶段", () => {
  const state = createState({
    specPath: "spec/new-feature",
    baseline: "main",
    runId: "bootstrap-test",
    handoffBranch: "agent/spec-bootstrap-test",
    handoffWorktree: "/tmp/spec-bootstrap-test",
  });
  assert.deepEqual(Object.keys(state.stages), ["clarification", "requirements", "design", "tasks"]);
  for (const stage of STAGES) {
    assert.equal(state.stages[stage.id].phase, "pending");
    assert.equal(state.stages[stage.id].commitSha, null);
    assert.equal(typeof state.stages[stage.id].lastHeartbeat, "string");
  }
});

test("规格阶段只允许目标文档和本次证据", () => {
  const stage = STAGES[0];
  assert.doesNotThrow(() => validateStageFiles(
    ["spec/new-feature/clarification.md", "evidence/agent-runs/spec-bootstrap-test/spec-analyst-clarification.md"],
    stage,
    "spec/new-feature",
    "spec-bootstrap-test",
  ));
  assert.throws(() => validateStageFiles(
    ["spec/new-feature/clarification.md", "spec/new-feature/requirements.md"],
    stage,
    "spec/new-feature",
    "spec-bootstrap-test",
  ), /未允许路径/);
});
