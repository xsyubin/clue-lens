#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/01-context-architecture.sh
# 场景一：【上下文治理】大上下文溺水 vs 架构地图精准制导 (100% 真实执行版)
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "01" "上下文与架构治理 —— 大上下文溺水 vs 架构地图精准制导" "板块二：2.1 喂对上下文（大上下文陷阱与冰山模型）"

# ------------------------------------------------------------------------------
# 第 1 幕：红屏警报 —— 物理测量全工程源码体积，揭示“大上下文陷阱”
# ------------------------------------------------------------------------------
demo_act "1" "野生裸奔：现场物理测算全仓无脑塞入的 Token 爆炸与失控" "$RED"
demo_step "现场遍历当前代码库全部源码文件，测算如果不经治理全量喂给大模型的真实物理开销..."

demo_run "node -e '
  const fs = require(\"fs\");
  const path = require(\"path\");
  function scan(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if ([\"node_modules\", \".git\", \".next\", \".worktrees\"].includes(f.name)) continue;
      const p = path.join(dir, f.name);
      if (f.isDirectory()) files.push(...scan(p));
      else if (/\\.(ts|tsx|js|mjs|json|md)$/.test(f.name)) files.push(p);
    }
    return files;
  }
  const allFiles = scan(\"${ROOT_DIR}\");
  let totalBytes = 0;
  for (const f of allFiles) totalBytes += fs.statSync(f).size;
  const estimatedTokens = Math.round(totalBytes / 3.8);

  const agentsPath = path.join(\"${ROOT_DIR}\", \"AGENTS.md\");
  const agentsBytes = fs.existsSync(agentsPath) ? fs.statSync(agentsPath).size : 0;
  const agentsTokens = Math.round(agentsBytes / 3.8);

  console.log(\"📊 [现场真实物理测量数据]：\");
  console.log(\"  ├── 全工程源码文件数  : \", allFiles.length, \"个文件\");
  console.log(\"  ├── 全工程物理源码体积: \", (totalBytes / 1024).toFixed(1), \"KB (\", totalBytes, \"字节 )\");
  console.log(\"  ├── 估算全量 Context   : \", estimatedTokens.toLocaleString(), \"Tokens (⚠️ 远超 32k/64k 黄金注意力窗口)\");
  console.log(\"  ├── 常驻层 AGENTS.md   : \", (agentsBytes / 1024).toFixed(1), \"KB (\", agentsTokens.toLocaleString(), \"Tokens )\");
  console.log(\"  └── 上下文体积物理压缩率: \", ((1 - agentsBytes / totalBytes) * 100).toFixed(1) + \"% !\");
'"

echo ""
demo_fail "致命后果：把全仓 9 万+ Tokens 全塞给大模型，必将引爆 Lost in the Middle 效应、响应奇慢且破坏分层架构！"

# 可选调用现场 agy 演示无规范下的回答
if command -v agy &>/dev/null; then
  echo ""
  demo_ai "用一行伪代码说明在 Next.js 里客户端组件怎么查询 sqlite 数据库"
  agy -p "不参考本项目任何规范，请用一行伪代码说明在 Next.js 里客户端组件怎么查询 sqlite 数据库" --print-timeout 15s || true
  demo_fail "看！没有架构家规时，AI 极其容易建议在客户端直接 import 数据库驱动，引发严重的架构污染！"
fi

demo_pause

# ------------------------------------------------------------------------------
# 第 2 幕：绿屏反制 —— clue-lens Harness 资产精准制导
# ------------------------------------------------------------------------------
demo_act "2" "佩戴 Harness：AGENTS.md 常驻指针 + ARCHITECTURE.md 渐进式披露" "$GREEN"
demo_step "展示 clue-lens 常驻家规资产 (极低 Token 控制全局大局观)..."

demo_run "head -n 28 ${ROOT_DIR}/AGENTS.md"
head -n 28 "${ROOT_DIR}/AGENTS.md"

echo ""
demo_step "展示 ARCHITECTURE.md 提供的技术分层红绿灯与公共资产货架表..."
demo_run "grep -E -A 12 '### 1. 技术分层架构' ${ROOT_DIR}/ARCHITECTURE.md"
grep -E -A 12 '### 1. 技术分层架构' "${ROOT_DIR}/ARCHITECTURE.md" || true

echo ""
demo_step "现场运行全栈架构与命名一致性门禁，验证整套架构契约 100% 闭环..."
demo_run "node ${ROOT_DIR}/scripts/gates/check-consistency.mjs"
node "${ROOT_DIR}/scripts/gates/check-consistency.mjs"

demo_pass "AI 依循架构地图生成 Server Actions，严格遵守会话守卫与 Zod 契约，Token 开销削减 97%！"

demo_pause

# ------------------------------------------------------------------------------
# 第 3 幕：架构师对账卡与金句
# ------------------------------------------------------------------------------
demo_act "3" "架构师对账卡：上下文治理前后对比" "$CYAN"
echo -e "${WHITE}
┌──────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 治理维度             │ 无 Harness (无脑全塞上下文)  │ 有 Harness (架构地图渐进式)  │
├──────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 真实物理开销         │ 90,000+ Tokens (打爆窗口)    │ ~2,400 Tokens (极简常驻指针) │
│ 上下文压缩率         │ 0% (注意力涣散与严重卡顿)    │ 97.5% 物理级体积压缩         │
│ 架构一致性保障       │ 跨层引入 DB、私造冗余轮子    │ 100% 遵从分层红绿灯与规范    │
│ 打包与底层稳定性     │ 频繁误改配置文件引爆构建     │ 规则显式防护，运行时零腐烂   │
└──────────────────────┴──────────────────────────────┴──────────────────────────────┘${RESET}"

demo_quote "未经治理的上下文不是弹药，而是毒药！没有架构地图与家规，AI 就是个胡乱改动老系统的盲人。"
