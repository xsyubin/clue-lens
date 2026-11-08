#!/usr/bin/env bash
# ============================================================================
# scripts/gates/check-manifest.sh
# 校验 .agents/agent-manifest.yml 的受控子集。
# 这不是通用 YAML 解析器，而是针对本工程角色契约的结构校验器。
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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
done <<< "${role_ids}"

if [[ "${failures}" -gt 0 ]]; then
    echo "❌ [AGENT-MANIFEST] 校验失败，共 ${failures} 处错误。" >&2
    exit 1
fi

pass "结构校验通过：${MANIFEST}"
