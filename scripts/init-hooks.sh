#!/usr/bin/env bash
# ==============================================================================
# scripts/init-hooks.sh
# 团队共享 Git 门禁与本地环境初始化脚本
# ==============================================================================
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "🔧 [Init] 正在配置团队共享 Git 门禁 (.githooks)..."

# 1. 确保 .githooks 目录存在并赋予可执行权限
mkdir -p .githooks
chmod +x .githooks/* 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true
chmod +x scripts/*.mjs 2>/dev/null || true
chmod +x .agents/hooks/* 2>/dev/null || true

# 2. 如果处于 Git 仓库中，配置 Git hooks 路径
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git config core.hooksPath .githooks
    echo "✅ [Init] Git hooks 配置成功！"
    echo "   - 当前 hooksPath: $(git config core.hooksPath)"
    echo "   - 每次 git commit 前将自动触发 .githooks/pre-commit 质量检查"
else
    echo "⚠️ [Init] 当前目录未初始化 Git，跳过 hooksPath 设置。"
fi

# 3. 验证并激活 AI Agent 安全护栏钩子 (.agents/hooks/pre-tool-guard.sh)
if [[ -f ".agents/hooks/pre-tool-guard.sh" ]]; then
    chmod +x .agents/hooks/pre-tool-guard.sh
    echo "🛡️ [Init] AI Agent 架构与凭证护栏已就绪：.agents/hooks/pre-tool-guard.sh"
    echo "   - 接入点 1: scripts/agent-run.sh 命令执行前动态拦截"
    echo "   - 接入点 2: .githooks/pre-commit 暂存区改动提交前静态拦截"
fi
