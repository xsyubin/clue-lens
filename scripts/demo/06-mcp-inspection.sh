#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/06-mcp-inspection.sh
# 场景六：【企业集成】一句话开发需求对比：数据库盲人摸象 vs 受控 MCP + RBAC 越权拦截
# ==============================================================================
source "$(dirname "$0")/lib/common.sh"

demo_header "06" "受控企业数据集成 —— 一句话需求开发效果 A/B 真实对决" "板块五：5.1~5.3 MCP 原理、自建 Schema MCP 与 RBAC 审计存证"

demo_feature "查询专卖监管涉案对象、涉案金额与风险等级，并筛选高风险线索"

# ------------------------------------------------------------------------------
# 前者：没有 Harness 资产 (AI 盲人摸象凭直觉脑补字段，现场抛出真实数据库报错)
# ------------------------------------------------------------------------------
demo_act "前者效果" "没有 Harness 资产：AI 盲人摸象脑补数据库字段，触发真实 SQLite 异常" "$RED"
demo_step "AI 缺乏数据库探查通道，凭借直觉脑补字段 (suspect_name, penalty_money, risk)..."

demo_run "node -e \"
  const Database = require('better-sqlite3');
  const db = new Database('${ROOT_DIR}/data/app.db');
  try {
    db.prepare('SELECT clue_no, suspect_name, penalty_money, risk FROM monopoly_clues').all();
  } catch (err) {
    console.error('💥 [真实 SQLite 物理报错]: ' + err.message);
  }
\""
node -e "
  const Database = require('better-sqlite3');
  const db = new Database('${ROOT_DIR}/data/app.db');
  try {
    db.prepare('SELECT clue_no, suspect_name, penalty_money, risk FROM monopoly_clues').all();
  } catch (err) {
    console.error('💥 [真实 SQLite 物理报错]: ' + err.message);
  }
"

echo ""
demo_fail "前者惨痛结局：在没有受控元数据接口时，大模型必然凭空猜测字段名，导致运行时严重崩溃！而如果直接赋予其命令行直连权限，测试库/生产库面临删库删表的灭顶之灾！"

demo_pause

# ------------------------------------------------------------------------------
# 后者：佩戴 Harness 资产 (stdio MCP 只读通道探查 Schema + 正确查询 + 审计留痕)
# ------------------------------------------------------------------------------
demo_act "后者效果" "佩戴 Harness 资产：stdio MCP 只读通道探查 Schema，精准查询并审计留痕" "$GREEN"
demo_step "展示 .mcp.json 受控协议契约与工具注册..."
demo_run "cat ${ROOT_DIR}/.mcp.json"
cat "${ROOT_DIR}/.mcp.json"

echo ""
demo_step "【MCP 真实探查】AI 调用 inspect_db_schema 探查 monopoly_clues 表真实字段与注释..."
demo_run "node -e '
const { spawn } = require(\"child_process\");
const child = spawn(\"node\", [\"scripts/mcp/server.mjs\"], { stdio: [\"pipe\", \"pipe\", \"inherit\"] });
let output = \"\";
child.stdout.on(\"data\", (d) => output += d);
child.on(\"close\", () => {
  const res = JSON.parse(output.trim());
  const schema = JSON.parse(res.result.content[0].text);
  console.log(\"📋 [MCP 探查成功] 表名:\", schema.tableName, \"|\", schema.comment);
  console.log(\"   真实字段与注释:\");
  schema.columns.slice(0, 8).forEach(c => {
    console.log(\"   - \" + c.columnName.padEnd(16) + \" [\" + c.dataType + \"] \" + (c.columnComment || \"\"));
  });
});
child.stdin.write(JSON.stringify({
  jsonrpc: \"2.0\",
  id: 1,
  method: \"tools/call\",
  params: { name: \"inspect_db_schema\", arguments: { tableName: \"monopoly_clues\" } }
}) + \"\\n\");
child.stdin.end();
'"
node -e '
const { spawn } = require("child_process");
const child = spawn("node", ["scripts/mcp/server.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
let output = "";
child.stdout.on("data", (d) => output += d);
child.on("close", () => {
  const res = JSON.parse(output.trim());
  const schema = JSON.parse(res.result.content[0].text);
  console.log("📋 [MCP 探查成功] 表名:", schema.tableName, "|", schema.comment);
  console.log("   真实字段与注释:");
  schema.columns.slice(0, 8).forEach(c => {
    console.log("   - " + c.columnName.padEnd(16) + " [" + c.dataType + "] " + (c.columnComment || ""));
  });
});
child.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "inspect_db_schema", arguments: { tableName: "monopoly_clues" } }
}) + "\n");
child.stdin.end();
'

echo ""
demo_step "【合规查询执行】依据 MCP 探查的真实字段进行查询，真实获取数据库记录..."
demo_run "node -e \"
  const Database = require('better-sqlite3');
  const db = new Database('${ROOT_DIR}/data/app.db');
  const rows = db.prepare('SELECT clue_no, target_name, amount, risk_level, status FROM monopoly_clues WHERE risk_level = ? LIMIT 3').all('高');
  console.log('✅ [查询成功 - 专卖高危线索真实数据]:');
  console.table(rows);
\""
node -e "
  const Database = require('better-sqlite3');
  const db = new Database('${ROOT_DIR}/data/app.db');
  const rows = db.prepare('SELECT clue_no, target_name, amount, risk_level, status FROM monopoly_clues WHERE risk_level = ? LIMIT 3').all('高');
  console.log('✅ [查询成功 - 专卖高危线索真实数据]:');
  console.table(rows);
"

echo ""
demo_step "运行 MCP 契约与安全全项验证客户端 (真实执行 11 项端到端握手与安全验证)..."
demo_run "node ${ROOT_DIR}/scripts/mcp/test-client.mjs"
node "${ROOT_DIR}/scripts/mcp/test-client.mjs"

echo ""
demo_step "现场查阅数据库中的 clue_mcp_audit_log 表，见证调用留痕与 RBAC 拦截证据..."
demo_run "node -e \"
const Database = require('better-sqlite3');
const db = new Database('${ROOT_DIR}/data/app.db');
const logs = db.prepare('SELECT id, tool_name, role, status, execution_ms, created_at FROM clue_mcp_audit_log ORDER BY created_at DESC LIMIT 5').all();
console.table(logs);
\""
node -e "
const Database = require('better-sqlite3');
const db = new Database('${ROOT_DIR}/data/app.db');
const logs = db.prepare('SELECT id, tool_name, role, status, execution_ms, created_at FROM clue_mcp_audit_log ORDER BY created_at DESC LIMIT 5').all();
console.table(logs);
"

demo_pass "后者真实效果：受控 MCP 只读通道彻底杜绝字段幻觉，RBAC 杜绝越权探测，每一次探查物理写入审计日志，安全可控！"

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
