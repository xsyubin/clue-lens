#!/usr/bin/env bash
# ==============================================================================
# scripts/secret-scan.sh
# 确定性密钥扫描：阻断高置信度私钥与云厂商 Token 泄露
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

files="${1:-}"
if [ -z "${files}" ]; then
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        files="$(git ls-files ':!node_modules' ':!.next' ':!data' ':!.git' ':!*.md' ':!.env.example' || true)"
    else
        files="$(find src scripts -type f 2>/dev/null || true)"
    fi
fi

if [ -z "${files}" ]; then
    echo "✅ [SECRET] 没有可扫描的文件"
    exit 0
fi

matches="$(printf '%s\n' "${files}" | xargs grep -nE \
    'BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}' \
    2>/dev/null || true)"

if [ -n "${matches}" ]; then
    echo "❌ [SECRET] 检测到高置信度密钥格式，已阻断提交：" >&2
    printf '%s\n' "${matches}" | sed -E 's/(:[0-9]+:).*/\1[REDACTED]/' >&2
    exit 1
fi

echo "✅ [SECRET] 未发现高置信度密钥格式"
