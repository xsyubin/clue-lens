// ==============================================================================
// scripts/lib/agent-contract.mjs
// .agents/agent-manifest.yml 受控子集的严格解析器与检查项契约（单一事实源）。
// 供 scripts/gates/check-manifest.mjs（结构门禁）与 scripts/agent/agent-run.mjs
// （运行期执行）共用；解析遇到任何不符合受控子集的结构必须抛错终止，
// 严禁静默返回空值（防止角色契约 fail-open 空转）。
// ==============================================================================

// agent-run 支持的声明检查项（check-manifest 门禁据此防契约漂移）
export const SUPPORTED_CHECKS = [
  "markdown-links",
  "spec-consistency",
  "typecheck",
  "check-security",
  "static-security-check",
  "check-consistency",
  "check-secrets",
  "secret-scan",
  "check-mcp",
  "review",
  "deterministic-review",
];

const REQUIRED_ROLE_FIELDS = [
  "id",
  "objective",
  "inputs",
  "outputs",
  "allowed_paths",
  "forbidden_paths",
  "checks",
  "commands",
];

function fail(lineNo, line, reason) {
  throw new Error(`agent-manifest.yml 第 ${lineNo} 行解析失败：${reason}\n  >>> ${line}`);
}

function stripQuotes(value) {
  const m = value.match(/^"(.*)"$/);
  return m ? m[1] : value;
}

// 解析标量或内联数组 ["a", "b"]（受控子集不支持数组项内嵌逗号）
function parseValue(raw, lineNo, line) {
  const value = raw.trim();
  if (value.startsWith("[")) {
    if (!value.endsWith("]")) fail(lineNo, line, "内联数组缺少右括号 ]");
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter((item) => item.length > 0);
  }
  return stripQuotes(value);
}

/**
 * 解析 .agents/agent-manifest.yml 的受控子集：
 * - 顶层标量 (version / project / purpose) 前置于 roles: / execution: 两个 section
 * - 角色条目 "  - id: <id>"，字段固定 4 空格缩进，支持标量、内联数组与块列表
 * - execution 区块为 2 空格缩进的标量或数组
 * - 任何未知层级、错误缩进或残缺结构直接抛错（带行号）
 */
export function parseAgentManifest(text) {
  const manifest = { version: null, project: null, purpose: null, roles: [], execution: {} };
  const lines = text.split(/\r?\n/);
  let section = null;
  let currentRole = null;
  let listTarget = null; // 当前块列表收集目标 { kind: "role" | "execution", key }

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (raw.includes("\t")) fail(lineNo, raw, "不允许使用 Tab 缩进");

    if (/^roles:\s*$/.test(raw)) {
      section = "roles";
      currentRole = null;
      listTarget = null;
      continue;
    }
    if (/^execution:\s*$/.test(raw)) {
      section = "execution";
      currentRole = null;
      listTarget = null;
      continue;
    }
    if (/^[A-Za-z_][\w-]*:/.test(raw)) {
      if (section !== null) {
        fail(lineNo, raw, "顶层键必须前置于 roles/execution 区块");
      }
      const m = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (["version", "project", "purpose"].includes(m[1])) {
        manifest[m[1]] = stripQuotes(m[2]);
        listTarget = null;
        continue;
      }
      fail(lineNo, raw, `未知顶层键: ${m[1]}`);
    }
    if (section === null) {
      fail(lineNo, raw, "顶层内容不符合受控子集（仅允许 version/project/purpose/roles/execution）");
    }

    if (section === "roles") {
      if (/^  - id: \S+\s*$/.test(raw)) {
        currentRole = { id: raw.replace(/^  - id: (\S+)\s*$/, "$1") };
        manifest.roles.push(currentRole);
        listTarget = null;
        continue;
      }
      if (/^  - /.test(raw)) fail(lineNo, raw, 'roles 条目必须以 "  - id: <role-id>" 开头');
      if (!currentRole) fail(lineNo, raw, 'roles: 之后必须先声明 "  - id: <role-id>"');

      const fieldMatch = raw.match(/^    ([A-Za-z_][\w-]*):\s*(.*)$/);
      if (fieldMatch) {
        const [, key, valueRaw] = fieldMatch;
        if (!REQUIRED_ROLE_FIELDS.includes(key)) {
          fail(lineNo, raw, `角色 ${currentRole.id} 存在未知字段: ${key}`);
        }
        if (valueRaw.trim() === "") {
          currentRole[key] = [];
          listTarget = { kind: "role", key };
        } else {
          currentRole[key] = parseValue(valueRaw, lineNo, raw);
          listTarget = null;
        }
        continue;
      }
      if (/^      - /.test(raw) && listTarget?.kind === "role") {
        currentRole[listTarget.key].push(stripQuotes(raw.replace(/^      - /, "").trim()));
        continue;
      }
      fail(lineNo, raw, `角色 ${currentRole.id} 的字段缩进或结构不符合受控子集`);
    }

    // section === "execution"
    const kvMatch = raw.match(/^  ([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kvMatch) {
      const [, key, valueRaw] = kvMatch;
      if (valueRaw.trim() === "") {
        manifest.execution[key] = [];
        listTarget = { kind: "execution", key };
      } else {
        manifest.execution[key] = parseValue(valueRaw, lineNo, raw);
        listTarget = null;
      }
      continue;
    }
    if (/^    - /.test(raw) && listTarget?.kind === "execution") {
      manifest.execution[listTarget.key].push(stripQuotes(raw.replace(/^    - /, "").trim()));
      continue;
    }
    fail(lineNo, raw, "execution 区块缩进或结构不符合受控子集");
  }

  return manifest;
}

/**
 * 结构与契约校验，返回问题清单（空数组 = 合法）。
 * 包含：必填字段、角色 id 唯一性、声明检查项受支持、merge_policy 存在。
 */
export function validateAgentManifest(manifest) {
  const problems = [];
  if (!manifest.version) problems.push("缺少 version");
  if (!manifest.project) problems.push("缺少 project");
  if (!Array.isArray(manifest.roles) || manifest.roles.length === 0) {
    problems.push("roles 为空");
  } else {
    const seen = new Set();
    for (const role of manifest.roles) {
      if (seen.has(role.id)) problems.push(`角色 id 重复：${role.id}`);
      seen.add(role.id);
      for (const field of REQUIRED_ROLE_FIELDS) {
        if (role[field] === undefined || role[field] === null) {
          problems.push(`角色 ${role.id} 缺少 ${field}`);
        }
      }
      for (const chk of role.checks || []) {
        if (!SUPPORTED_CHECKS.includes(chk)) {
          problems.push(`角色 ${role.id} 声明了 agent-run 不支持的检查项: ${chk}`);
        }
      }
    }
  }
  if (!manifest.execution || !("merge_policy" in manifest.execution)) {
    problems.push("缺少 execution.merge_policy");
  }
  return problems;
}
