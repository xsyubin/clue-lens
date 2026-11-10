#!/usr/bin/env bash
# ==============================================================================
# scripts/agent/pre-tool-guard.sh
# 统一 AI 安全护栏：拦截敏感凭据探测、数据外传与架构破坏
# 支持 IDE Pre-tool Hook (stdin JSON) 与 agent-run.sh (命令行参数)
# ==============================================================================

if [ -n "$1" ]; then
  payload="$*"
else
  payload="$(cat)"
fi

# 1. 凭据与私钥安全护栏：严禁刺探敏感配置文件、私钥或密钥变量
if echo "$payload" | grep -Eiq '(^|["/])\.env(\.|["/]|$)|application-prod\.yml|id_rsa|\.pem|\.p12|\.jks|BETTER_AUTH_SECRET|secret[_-]?key|api[_-]?key'; then
  echo "[GUARD-BLOCK] 凭据护栏拦截：严禁刺探敏感凭据或私钥文件！" >&2
  exit 2
fi

# 2. 数据外传与越权护栏：严禁执行数据外传、反弹 Shell 或远程推送
if echo "$payload" | grep -Eiq 'curl[^\n]*(--data|--upload-file|-T)|wget[^\n]*https?://|nc[[:space:]]|scp[[:space:]]|git[[:space:]]+push'; then
  echo "[GUARD-BLOCK] 传输护栏拦截：禁止在 Agent 运行期执行潜在数据外传或远程写入命令！" >&2
  exit 2
fi

# 3. 架构底线护栏：严禁破坏核心模块排除配置与数据库基础连接
if echo "$payload" | grep -Eiq 'next\.config\.ts.*better-sqlite3|sed[^\n]*drizzle\.config\.ts|>+[[:space:]]*drizzle\.config\.ts'; then
  echo "[GUARD-BLOCK] 架构护栏拦截：严禁越界修改核心模块排除配置与数据库基础连接！" >&2
  exit 2
fi

exit 0
