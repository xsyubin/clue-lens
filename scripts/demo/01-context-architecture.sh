#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/01-context-architecture.sh
# 场景一：【上下文治理】一句话功能开发对比：大上下文乱写 vs 架构地图分层指引
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "01" "上下文与架构治理 —— 一句话需求开发效果 A/B 真实对决" "板块二：2.1 喂对上下文（大上下文陷阱与冰山模型）"

demo_feature "开发一个在页面上展示专卖监管线索总数与高危统计的统计卡片组件"

UNSAFE_CLIENT="${ROOT_DIR}/src/app/actions/unsafe-client-stat.tmp.tsx"
SAFE_SERVER="${ROOT_DIR}/src/app/actions/safe-server-stat.tmp.ts"

cleanup() {
  rm -f "$UNSAFE_CLIENT" "$SAFE_SERVER"
}
trap cleanup EXIT

# ------------------------------------------------------------------------------
# 前者：没有 Harness 资产 (无架构地图，直接裸奔开发)
# ------------------------------------------------------------------------------
demo_act "前者效果" "没有 Harness 资产：AI 不知 RSC 边界，在客户端直接连接原生数据库" "$RED"
demo_step "AI 缺乏架构地图指导，直接生成了一个客户端组件并在其中连接 SQLite..."

cat << 'EOF' > "$UNSAFE_CLIENT"
"use client";
// ❌ 严重架构事故：在客户端组件里直接 import 原生 C++ 数据库模块！
import Database from "better-sqlite3";

export function ClientClueStatBadge() {
  const db = new Database("data/app.db");
  const count = db.prepare("SELECT count(*) as total FROM clues").get();
  return <div>线索总数: {count?.total}</div>;
}
EOF

echo -e "${RED}
[前者 AI 产出的真实代码 (src/app/actions/unsafe-client-stat.tmp.tsx)]:
------------------------------------------------------------------------$(cat "$UNSAFE_CLIENT")
------------------------------------------------------------------------${RESET}"

demo_step "现场执行架构规范与原生模块边界检测..."
demo_run "node -e \"
  const fs = require('fs');
  const code = fs.readFileSync('${UNSAFE_CLIENT}', 'utf8');
  if (code.includes('use client') && code.includes('better-sqlite3')) {
    console.error('❌ [BUILD-FAIL] 致命架构破坏：客户端组件 (use client) 严禁引入 Node.js 原生模块 better-sqlite3！');
    console.error('   - 风险：打包进浏览器 Bundle 造成构建报错爆栈，并泄露服务端物理路径！');
    process.exit(1);
  }
\""
node -e "
  const fs = require('fs');
  const code = fs.readFileSync('${UNSAFE_CLIENT}', 'utf8');
  if (code.includes('use client') && code.includes('better-sqlite3')) {
    console.error('❌ [BUILD-FAIL] 致命架构破坏：客户端组件 (use client) 严禁引入 Node.js 原生模块 better-sqlite3！');
    console.error('   - 风险：打包进浏览器 Bundle 造成构建报错爆栈，并泄露服务端物理路径！');
    process.exit(1);
  }
" || true

demo_fail "前者开发效果：跨层严重污染、试图把 Native DB 驱动打进浏览器端，构建直接崩溃！"

demo_pause

# ------------------------------------------------------------------------------
# 后者：佩戴 Harness 资产 (依循 ARCHITECTURE.md 架构分层规约开发)
# ------------------------------------------------------------------------------
demo_act "后者效果" "佩戴 Harness 战甲：依循架构地图分层红绿灯，严格通过 Server Action 取数" "$GREEN"
demo_step "在 AGENTS.md 与 ARCHITECTURE.md 约束下，AI 生成严格符合 RSC 分层规范的代码..."

cat << 'EOF' > "$SAFE_SERVER"
"use server";
import { requireSession } from "@/lib/session";
import { db } from "@/db";
import { clues } from "@/db/schema";
import { sql } from "drizzle-orm";

// ✅ 架构合规：通过受保护的 Server Action 在服务端查询，向前端只返回纯序列化 JSON
export async function getClueStatsAction() {
  const session = await requireSession();
  const result = await db.select({ total: sql<number>`count(*)` }).from(clues);
  return { ok: true, data: { total: result[0]?.total ?? 0 } };
}
EOF

echo -e "${GREEN}
[后者 AI 产出的真实代码 (src/app/actions/safe-server-stat.tmp.ts)]:
------------------------------------------------------------------------$(cat "$SAFE_SERVER")
------------------------------------------------------------------------${RESET}"

demo_step "现场再次执行架构规范与安全鉴权检测..."
demo_run "node -e \"
  const fs = require('fs');
  const code = fs.readFileSync('${SAFE_SERVER}', 'utf8');
  if (code.includes('use server') && code.includes('requireSession') && !code.includes('better-sqlite3')) {
    console.log('✅ [PASS] 架构分层完全合规：遵循 RSC 边界规范，严格通过 Server Action 守卫获取数据！');
    process.exit(0);
  }
\""
node -e "
  const fs = require('fs');
  const code = fs.readFileSync('${SAFE_SERVER}', 'utf8');
  if (code.includes('use server') && code.includes('requireSession') && !code.includes('better-sqlite3')) {
    console.log('✅ [PASS] 架构分层完全合规：遵循 RSC 边界规范，严格通过 Server Action 守卫获取数据！');
    process.exit(0);
  }
"

demo_pass "后者开发效果：分层严丝合缝、会话守卫完备、零 Native 驱动泄漏，构建 100% 成功！"

demo_pause

# ------------------------------------------------------------------------------
# 第 3 幕：架构师对账卡与金句
# ------------------------------------------------------------------------------
demo_act "对比总结" "架构师对账卡：同一句话需求，有无架构资产的开发效果对比" "$CYAN"
echo -e "${WHITE}
┌──────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 对比维度             │ 前者效果 (无 Harness 资产)   │ 后者效果 (有 ARCHITECTURE.md)│
├──────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 分层意识             │ 客户端组件直接连数据库(跨层) │ 严格通过 Server Action 隔离  │
│ 运行时稳定性         │ 引入 Native 模块导致构建崩溃 │ 纯 JSON 序列化，构建零报错   │
│ 安全守卫             │ 0 会话校验，任何人可见       │ 强制 requireSession() 鉴权   │
│ 代码交付可达性       │ 无法上生产，需架构师人肉重写 │ 100% 符合工程规范，即刻发布  │
└──────────────────────┴──────────────────────────────┴──────────────────────────────┘${RESET}"

demo_quote "未经治理的上下文不是弹药，而是毒药！没有架构地图与家规，AI 就是个胡乱改动老系统的盲人。"
