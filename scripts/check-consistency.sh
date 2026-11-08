#!/usr/bin/env bash
# ==============================================================================
# scripts/check-consistency.sh
# 全栈工程一致性与规范完整性校验门禁
# ==============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "=== [Consistency Check] 开始执行工程命名与核心一致性校验 ==="

FAILURES=0

check_file_exists() {
    local file_path="$1"
    if [ ! -f "${file_path}" ]; then
        echo "❌ [MISSING] 未找到必需文件: ${file_path}"
        FAILURES=$((FAILURES + 1))
    else
        echo "✅ [FOUND] ${file_path}"
    fi
}

check_content_contains() {
    local file_path="$1"
    local pattern="$2"
    local desc="$3"
    if ! grep -F -q "${pattern}" "${file_path}" 2>/dev/null; then
        echo "❌ [MISMATCH] ${file_path} 缺少关键定义: ${desc} (pattern: ${pattern})"
        FAILURES=$((FAILURES + 1))
    else
        echo "✅ [MATCH] ${desc} in ${file_path}"
    fi
}

check_forbidden_pattern() {
    local dir_path="$1"
    local pattern="$2"
    local desc="$3"
    local matches
    matches=$(grep -rn "${pattern}" "${dir_path}" --exclude="*.sh" --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".git" 2>/dev/null || true)
    if [ -n "${matches}" ]; then
        echo "❌ [FORBIDDEN] 发现禁止出现的残留项 (${desc}):"
        echo "${matches}" | head -n 5
        FAILURES=$((FAILURES + 1))
    else
        echo "✅ [CLEAN] 无违规残留: ${desc}"
    fi
}

echo "--- 1. 核心规范与架构文档存在性检查 ---"
check_file_exists "AGENTS.md"
check_file_exists "ARCHITECTURE.md"
check_file_exists "rules/01-project-architecture.md"
check_file_exists "rules/02-database-design.md"
check_file_exists "rules/03-drizzle-convention.md"
check_file_exists "rules/04-server-actions-convention.md"
check_file_exists "rules/05-coding-style.md"
check_file_exists "rules/06-test-and-quality-convention.md"
check_file_exists "rules/07-security-and-auth.md"
check_file_exists "spec/README.md"
check_file_exists "spec/clue-lens/requirements.md"
check_file_exists "spec/clue-lens/design.md"
check_file_exists "spec/clue-lens/tasks.md"

echo "--- 2. 基础配置与核心代码文件检查 ---"
check_file_exists "package.json"
check_file_exists "components.json"
check_file_exists "drizzle.config.ts"
check_file_exists "next.config.ts"
check_file_exists "postcss.config.mjs"
check_file_exists "src/app/globals.css"
check_file_exists "src/db/index.ts"
check_file_exists "src/db/schema.ts"
check_file_exists "src/lib/auth.ts"
check_file_exists "src/lib/auth-client.ts"
check_file_exists "src/lib/session.ts"
check_file_exists "src/lib/validations.ts"
check_file_exists "src/lib/utils.ts"

echo "--- 3. 数据库核心表名定义检查 (src/db/schema.ts) ---"
check_content_contains "src/db/schema.ts" 'sqliteTable("user"' "用户表 user"
check_content_contains "src/db/schema.ts" 'sqliteTable("session"' "会话表 session"
check_content_contains "src/db/schema.ts" 'sqliteTable("account"' "账号表 account"
check_content_contains "src/db/schema.ts" 'sqliteTable("verification"' "验证表 verification"
check_content_contains "src/db/schema.ts" 'clues = sqliteTable' "线索表 clues"
check_content_contains "src/db/schema.ts" 'clueMcpAuditLog = sqliteTable' "MCP审计表 clue_mcp_audit_log"

echo "--- 4. Tailwind v4 与全局样式规范检查 ---"
check_content_contains "src/app/globals.css" '@import "tailwindcss";' "Tailwind v4 原生导入"
check_forbidden_pattern "src/app/globals.css" '@tailwind base;' "旧版 Tailwind v3 指令"

echo "--- 5. 架构文档一致性检查 ---"
check_content_contains "ARCHITECTURE.md" "当前代码的导航地图" "ARCHITECTURE.md 定位声明"
check_content_contains "AGENTS.md" "架构底线与安全红线" "AGENTS.md 约束声明"

echo "--- 6. MCP 智能体服务与配置检查 ---"
check_file_exists ".mcp.json"
check_file_exists "scripts/mcp-server.mjs"
check_file_exists "scripts/test-mcp.mjs"
check_file_exists "src/mcp/index.ts"
check_file_exists "src/mcp/schema-inspector.ts"
check_content_contains "scripts/mcp-server.mjs" "inspect_db_schema" "MCP 工具 inspect_db_schema"
check_content_contains ".mcp.json" "clue-mcp-server" "MCP 服务配置 clue-mcp-server"

echo "--- 7. SDD 技能库与智能体契约检查 (.agents) ---"
check_file_exists ".agents/agent-manifest.yml"
check_file_exists ".agents/skills/WORKFLOW.md"
check_file_exists ".agents/skills/spec-clarification/SKILL.md"
check_file_exists ".agents/skills/spec-requirements/SKILL.md"
check_file_exists ".agents/skills/spec-design/SKILL.md"
check_file_exists ".agents/skills/spec-tasks/SKILL.md"
check_file_exists ".agents/skills/spec-impl/SKILL.md"
check_file_exists ".agents/skills/spec-review/SKILL.md"
check_file_exists "scripts/validate-agent-manifest.sh"
check_file_exists "scripts/agent-run.sh"

echo "=================================================================="
if [ "${FAILURES}" -gt 0 ]; then
    echo "❌ 一致性校验未通过，共发现 ${FAILURES} 处不一致！" >&2
    exit 1
fi

echo "✅ 恭喜！工程命名与规范一致性校验 100% 通过！"
