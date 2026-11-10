#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/06-mcp-inspection.sh
# 场景六：【企业集成】数据库字段幻觉 vs 受控 MCP + RBAC 越权拦截
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "06" "受控企业数据集成 —— 数据库盲人摸象 vs 受控 MCP + RBAC 越权拦截" "板块五：5.1~5.3 MCP 原理、自建 Schema MCP 与 RBAC 审计存证"

# ------------------------------------------------------------------------------
# 第 1 幕：红屏警报 —— 盲人摸象的字段幻觉与直接 SQL 裸奔
# ------------------------------------------------------------------------------
demo_act "1" "野生裸奔：AI 凭空脑补字段与直接连接数据库的高危事故" "$RED"
demo_step "模拟让 AI 编写持久层查询，但未向其提供受控元数据接口..."

demo_simulate "AI 正在生成专卖线索查询 SQL..."
sleep 0.8

echo -e "${RED}
[终端致命报错回显]:
------------------------------------------------------------------------
// ❌ 灾难 1 [字段幻觉]：AI 脑补了列名，数据库根本没有这些字段！
SELECT id, mobile, score, company_name FROM clues;
--> Error: SQLite3 error: no such column: mobile (真实字段为 customer_phone)
--> Error: SQLite3 error: no such column: score (真实字段为 intent_score)

// ❌ 灾难 2 [权限与操作失控]：
Agent 获得命令行数据库直连权限后，试图修复表结构：
DROP TABLE clues; -- 生产数据被一键清空！
------------------------------------------------------------------------${RESET}"
demo_fail "致命真相：给 AI 终端裸奔直连数据库是安全自杀！而完全不给元数据则是质量残疾！"

demo_pause

# ------------------------------------------------------------------------------
# 第 2 幕：绿屏反制 —— clue-lens MCP 只读受控通道 + RBAC 准入 + 审计留痕
# ------------------------------------------------------------------------------
demo_act "2" "佩戴 Harness：stdio MCP 只读受控通道 + RBAC 鉴权 + 审计存证" "$GREEN"
demo_step "展示 .mcp.json 受控协议契约..."
demo_run "cat ${ROOT_DIR}/.mcp.json"
cat "${ROOT_DIR}/.mcp.json"

echo ""
demo_step "运行 MCP 契约与安全全项验证客户端 (执行 11 项端到端验证)..."
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
