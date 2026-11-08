#!/usr/bin/env bash
# ==============================================================================
# scripts/gates/check-security.sh
# 全栈静态安全与架构红线门禁
# ==============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${PROJECT_ROOT}"

failures=0
fail() {
    echo "❌ [STATIC] $1" >&2
    failures=$((failures + 1))
}
pass() {
    echo "✅ [STATIC] $1"
}

echo "=== [Static Security Check] 开始执行全栈静态安全与红线检查 ==="

# 1. 检查 Server Actions 是否声明 "use server"
if [ -d "src/app/actions" ]; then
    for f in src/app/actions/*.ts; do
        [ -e "$f" ] || continue
        if ! grep -q '"use server"' "$f"; then
            fail "Server Action 文件缺少 'use server' 指令: $f"
        else
            pass "Server Action 指令合规: $f"
        fi
    done
fi

# 2. 检查 Server Actions 是否包含会话鉴权门禁 (requireSession)
if [ -d "src/app/actions" ]; then
    for f in src/app/actions/*.ts; do
        [ -e "$f" ] || continue
        if ! grep -q "requireSession" "$f"; then
            fail "Server Action 缺少 requireSession 鉴权门禁: $f"
        else
            pass "Server Action 鉴权守卫合规: $f"
        fi
    done
fi

# 3. 检查 next.config.ts 是否配置了 better-sqlite3 为 serverExternalPackages
if grep -q "serverExternalPackages.*better-sqlite3" next.config.ts 2>/dev/null; then
    pass "next.config.ts 已正确配置 better-sqlite3 外部模块排除"
else
    fail "next.config.ts 缺少 better-sqlite3 的 serverExternalPackages 配置"
fi

# 4. 检查 SQLite 初始化脚本是否开启 WAL 模式与外键约束
if grep -q "journal_mode = WAL" scripts/ops/init-db.mjs 2>/dev/null && grep -q "foreign_keys = ON" scripts/ops/init-db.mjs 2>/dev/null; then
    pass "SQLite 数据库初始化 WAL 模式与外键级联检查通过"
else
    fail "scripts/ops/init-db.mjs 缺少 WAL 模式或外键级联强制配置"
fi

# 5. 检查 Better Auth 是否注册了 nextCookies 插件
if grep -q "nextCookies" src/lib/auth.ts 2>/dev/null; then
    pass "Better Auth 已正确引入 nextCookies 插件"
else
    fail "src/lib/auth.ts 缺少 nextCookies 插件，可能导致 Cookie 写入失败"
fi

echo "=================================================================="
if [ "$failures" -gt 0 ]; then
    echo "❌ 静态安全红线校验未通过，发现 $failures 处阻断项！" >&2
    exit 1
fi

echo "✅ 恭喜！所有静态安全与架构红线检查全部通过！"
