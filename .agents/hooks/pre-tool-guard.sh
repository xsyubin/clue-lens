#!/usr/bin/env bash
# ==============================================================================
# .agents/hooks/pre-tool-guard.sh
# 智能体运行期受控拦截钩子 (架构护栏与防泄露拦截)
# ==============================================================================
set -euo pipefail

payload="$(cat || true)"

# 1. 【研发质量与架构底线护栏】
# 严禁在未经授权时篡改系统核心持久层、生产环境配置或构建配置
if printf '%s' "${payload}" | grep -Eiq 'next\.config\.ts.*better-sqlite3|drizzle\.config\.ts'; then
    echo "[HOOK-BLOCK] 架构护栏拦截：严禁越界修改核心模块排除配置与数据库基础连接！" >&2
    exit 2
fi

# 2. 【凭证与私钥安全护栏】
if printf '%s' "${payload}" | grep -Eiq '(^|["/])\.env(\.|["/]|$)|id_rsa|\.pem|\.p12|\.jks|BETTER_AUTH_SECRET|secret[_-]?key|api[_-]?key'; then
    echo "[HOOK-BLOCK] 禁止读取可能包含敏感凭据或私钥的文件。请使用 .env.example 或脱敏测试 fixture。" >&2
    exit 2
fi

# 3. 【命令与数据外传护栏】
if printf '%s' "${payload}" | grep -Eiq 'curl[^\n]*(--data|--upload-file|-T)|wget[^\n]*https?://|nc[[:space:]]|scp[[:space:]]|git[[:space:]]+push'; then
    echo "[HOOK-BLOCK] 禁止在 Agent 运行期执行潜在数据外传或远程写入命令。" >&2
    exit 2
fi

exit 0
