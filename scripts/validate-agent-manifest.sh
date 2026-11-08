#!/usr/bin/env bash
# ============================================================================
# 校验 .agents/agent-manifest.yml 的受控子集。
# 这不是通用 YAML 解析器，而是针对本工程角色契约的结构校验器。
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${AGENT_MANIFEST_FILE:-${ROOT}/.agents/agent-manifest.yml}"
cd "${ROOT}"

failures=0
fail() {
    echo "❌ [AGENT-MANIFEST] ${1}" >&2
    failures=$((failures + 1))
}
pass() {
    echo "✅ [AGENT-MANIFEST] ${1}"
}

if [[ ! -f "${MANIFEST}" ]]; then
    fail "文件不存在：${MANIFEST}"
    exit 1
fi

grep -q '^version: ' "${MANIFEST}" || fail "缺少 version"
grep -q '^project: ' "${MANIFEST}" || fail "缺少 project"
grep -q '^roles:' "${MANIFEST}" || fail "缺少 roles"
grep -q '^execution:' "${MANIFEST}" || fail "缺少 execution"

role_ids="$(awk '/^  - id: / {print $3}' "${MANIFEST}")"
if [[ -z "${role_ids}" ]]; then
    fail "roles 为空"
else
    duplicate_ids="$(printf '%s\n' "${role_ids}" | sort | uniq -d)"
    [[ -z "${duplicate_ids}" ]] || fail "角色 id 重复：${duplicate_ids}"
fi

while IFS= read -r role; do
    [[ -z "${role}" ]] && continue
    block="$(awk -v role="${role}" '
        $0 == "  - id: " role {inside=1}
        inside && $0 ~ /^  - id: / && $0 != "  - id: " role {exit}
        inside && $0 ~ /^execution:/ {exit}
        inside {print}
    ' "${MANIFEST}")"

    for field in objective inputs outputs allowed_paths forbidden_paths checks commands; do
        printf '%s\n' "${block}" | grep -q "^    ${field}:" \
            || fail "角色 ${role} 缺少 ${field}"
    done

    allowed="$(printf '%s\n' "${block}" | sed -n 's/^    allowed_paths: \[\(.*\)\]/\1/p')"
    forbidden="$(printf '%s\n' "${block}" | sed -n 's/^    forbidden_paths: \[\(.*\)\]/\1/p')"
    [[ -n "${allowed}" ]] || fail "角色 ${role} 的 allowed_paths 为空"
    [[ -n "${forbidden}" ]] || fail "角色 ${role} 的 forbidden_paths 为空"

    commands="$(printf '%s\n' "${block}" | sed -n 's/^    commands: \[\(.*\)\]/\1/p')"
    [[ -n "${commands}" ]] || fail "角色 ${role} 没有可执行 commands"
    while IFS= read -r script_path; do
        [[ -z "${script_path}" ]] && continue
        [[ -x "${ROOT}/${script_path}" ]] || fail "角色 ${role} 引用的脚本不可执行或不存在：${script_path}"
    done < <(printf '%s\n' "${commands}" | grep -oE '\\./scripts/[A-Za-z0-9_.-]+\.sh' | sort -u || true)
done <<< "${role_ids}"

for field in isolation serial_required merge_policy human_gate; do
    grep -q "^  ${field}:" "${MANIFEST}" \
        || fail "execution 缺少 ${field}"
done

if [[ "${failures}" -gt 0 ]]; then
    echo "[AGENT-MANIFEST] 校验失败：${failures} 项。" >&2
    exit 1
fi

pass "结构校验通过：${MANIFEST}"
