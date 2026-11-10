#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/06-mcp-inspection.sh
# 场景六：【企业集成】数据库字段幻觉 vs 受控 MCP + RBAC 越权拦截 (100% 真实执行版)
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "06" "受控企业数据集成 —— 数据库盲人摸象 vs 受控 MCP + RBAC 越权拦截" "板块五：5.1~5.3 MCP 原理、自建 Schema MCP 与 RBAC 审计存证"

# ------------------------------------------------------------------------------
# 第 1 幕：红屏警报 —— 现场触发真实 SQLite 字段幻觉报错
# ------------------------------------------------------------------------------
demo_act "1" "野生裸奔：现场执行 AI 脑补字段的查询，触发真实数据库报错" "$RED"
demo_step "现场用 SQLite 执行一条包含 AI 幻觉字段的 SQL (将 customer_phone 脑补为 mobile，intent_score 脑补为 score)..."

demo_run "node -e \"
  const Database = require('better-sqlite3');
  const db = new Database('${ROOT_DIR}/data/app.db');
  try {
    db.prepare('SELECT id, mobile, score FROM clues').all();
  } catch (err) {
    console.error('💥 真实 SQLite 物理报错: ' + err.message);
  }
\""
node -e "
  const Database = require('better-sqlite3');
  const db = new Database('${ROOT_DIR}/data/app.db');
  try {
    db.prepare('SELECT id, mobile, score FROM clues').all();
  } catch (err) {
    console.error('💥 真实 SQLite 物理报错: ' + err.message);
  }
"

echo ""
demo_fail "致命真相：在没有受控元数据接口时，大模型必然凭空猜测字段名，导致运行时严重崩溃！而如果直接赋予其命令行直连权限，测试库/生产库面临删库删表的灭顶之灾！"

demo_pause

# ------------------------------------------------------------------------------
# 第 2 幕：绿屏反制 —— clue-lens MCP 只读受控通道 + RBAC 准入 + 审计留痕
# ------------------------------------------------------------------------------
demo_act "2" "佩戴 Harness：stdio MCP 只读受控通道 + RBAC 鉴权 + 审计存证" "$GREEN"
demo_step "展示 .mcp.json 受控协议契约..."
demo_run "cat ${ROOT_DIR}/.mcp.json"
cat "${ROOT_DIR}/.mcp.json"

echo ""
demo_step "运行 MCP 契约与安全全项验证客户端 (真实执行 11 项端到端握手与安全验证)..."
demo_run "node ${ROOT_DIR}/scripts/mcp/test-client.mjs"
node "${ROOT_DIR}/scripts/mcp/test-client.mjs"

echo ""
demo_step "现场查阅数据库中的 clue_mcp_audit_log 表，见证调用留痕与 RBAC 拦截证据..."
demo_run "node -e \"
const Database = require('better-sqlite3');
const db = new Database('${ROOT_DIR}/data/app.db');
const logs = db.prepare('SELECT id, tool_name, role, status, execution_ms, created_at FROM clue_mcp_audit_log ORDER BY id DESC LIMIT 5').all();
console.table(logs);
\""
node -e "
const Database = require('better-sqlite3');
const db = new Database('${ROOT_DIR}/data/app.db');
const logs = db.prepare('SELECT id, tool_name, role, status, execution_ms, created_at FROM clue_mcp_audit_log ORDER BY id DESC LIMIT 5').all();
console.table(logs);
"

demo_pass "所有探查通过受控只读接口进行，字段幻觉瞬间归零，越权探测当场拒止且全程防篡改存证！"

demo_pause

# ------------------------------------------------------------------------------
# 第 3 幕：架构师对账卡与金句
# ------------------------------------------------------------------------------
demo_act "3" "架构师对账卡：企业数据源集成方案对比" "$CYAN"
echo -e "${WHITE}
┌──────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ 治理维度             │ 无 Harness (命令行裸奔直连)  │ 有 Harness (受控 MCP 协议)   │
├──────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ 字段准确度           │ 频发字段幻觉，字段名胡乱拼写 │ 100% 真实 Schema 与字段注释  │
│ 权限控制粒度         │ 粗暴全量权限，可删库删表     │ 表级白名单 + 只读受控 + RBAC │
│ 敏感黑名单防御       │ 密钥凭证表暴露无遗           │ 针对涉密表坚决阻断越权探测   │
│ 审计与合规追溯       │ 黑盒操作，无人知晓谁查了什么 │ 独立审计表，TraceId、入参留痕│
└──────────────────────┴──────────────────────────────┴──────────────────────────────┘${RESET}"

demo_quote "在内网直连数据库是安全自杀，断网隔离是质量残疾。MCP 是把后门焊死后，为企业 AI 留出的唯一受控防空洞！"
