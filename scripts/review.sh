#!/usr/bin/env bash
# ==============================================================================
# scripts/review.sh
# 确定性机器审查总控门禁：驱动 scripts/review-checks.list 并生成审计报告
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

REPORT_FILE="evidence/deterministic-review-report.md"
CHECKS_FILE="${DETERMINISTIC_REVIEW_CHECKS_FILE:-scripts/review-checks.list}"
mkdir -p evidence

if [[ ! -f "${CHECKS_FILE}" ]]; then
    echo "[PRE-REVIEW] 检查清单不存在：${CHECKS_FILE}" >&2
    exit 2
fi

DIFF_NAME="本地完整工作区"
if [[ "${1:-}" == "--staged" || "${1:-}" == "--cached" ]]; then
    DIFF_NAME="Git Staged (暂存区变更)"
fi

failures=0
results=()

echo "=== [Deterministic Review] 开始执行确定性前置门禁 ==="
echo "审查范围: ${DIFF_NAME}"
echo "配置文件: ${CHECKS_FILE}"
echo "--------------------------------------------------"

while IFS= read -r check || [[ -n "${check}" ]]; do
    check="${check#"${check%%[![:space:]]*}"}"
    check="${check%"${check##*[![:space:]]}"}"
    [[ -z "${check}" || "${check}" == \#* ]] && continue

    if [[ ! -x "${ROOT}/${check}" ]]; then
        results+=("FAIL|${check}|脚本不存在或无执行权限")
        failures=$((failures + 1))
        continue
    fi

    echo ">>> 执行检查: ${check}"
    if log_output="$("${ROOT}/${check}" 2>&1)"; then
        results+=("PASS|${check}|正常通过")
        printf '%s\n' "${log_output}"
    else
        exit_code=$?
        results+=("FAIL|${check}|exit=${exit_code}")
        failures=$((failures + 1))
        printf '%s\n' "${log_output}"
    fi
    echo "--------------------------------------------------"
done < "${CHECKS_FILE}"

{
    echo "# 确定性机器前置审查报告 (clue-lens)"
    echo
    echo "- **审查时间**: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "- **审查范围**: ${DIFF_NAME}"
    echo "- **检查清单**: \`${CHECKS_FILE}\`"
    echo "- **总决议**: $([[ "${failures}" -eq 0 ]] && echo "✅ PASS (全部通过)" || echo "❌ FAIL (存在阻断问题)")"
    echo
    echo "| 检查项 | 状态 | 详情 / 备注 |"
    echo "|---|---|---|"
    for result in "${results[@]}"; do
        IFS="|" read -r status name note <<< "${result}"
        if [[ "${status}" == "PASS" ]]; then
            echo "| \`${name}\` | 🟢 PASS | ${note} |"
        else
            echo "| \`${name}\` | 🔴 FAIL | ${note} |"
        fi
    done
} > "${REPORT_FILE}"

echo
echo "=== 审查报告已生成: ${REPORT_FILE} ==="
if [[ "${failures}" -gt 0 ]]; then
    echo "❌ 确定性前置门禁失败，共发现 ${failures} 项未通过！" >&2
    exit 1
fi

echo "✅ 所有确定性门禁检查项全部通过！"
