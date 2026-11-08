#!/usr/bin/env node
// ==============================================================================
// scripts/mcp/test-client.mjs
// MCP 服务协议契约、SQLite Schema 探查与 RBAC 安全演练测试
// ==============================================================================
import { spawn } from "node:child_process";
import assert from "node:assert";

console.log("=== [MCP Test] 开始执行 clue-lens SQLite Schema MCP 契约与安全测试 ===");

function runMcpSession(linesToSend, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/mcp/server.mjs"], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const responses = [];
    let stderrOutput = "";

    child.stdout.on("data", (data) => {
      const text = data.toString();
      for (const line of text.split("\n")) {
        if (line.trim()) {
          try {
            responses.push(JSON.parse(line.trim()));
          } catch (e) {
            // ignore non-json
          }
        }
      }
    });

    child.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    child.on("close", (code) => {
      resolve({ responses, stderr: stderrOutput, code });
    });

    child.on("error", reject);

    for (const req of linesToSend) {
      child.stdin.write(JSON.stringify(req) + "\n");
    }
    child.stdin.end();
  });
}

async function runTests() {
  let passed = 0;

  // 测试 1: MCP 握手协议 (initialize)
  console.log("--- 1. 测试 MCP initialize 握手协议 ---");
  const initResult = await runMcpSession([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
  ]);
  assert.strictEqual(initResult.responses.length, 1);
  const initRes = initResult.responses[0];
  assert.strictEqual(initRes.id, 1);
  assert.strictEqual(initRes.result.protocolVersion, "2024-11-05");
  assert.strictEqual(initRes.result.serverInfo.name, "clue-mcp-server");
  console.log("✅ [PASS] initialize 协议版本 2024-11-05 握手成功");
  passed++;

  // 测试 2: 工具列表暴露 (tools/list)
  console.log("--- 2. 测试 tools/list 工具暴露契约 ---");
  const listResult = await runMcpSession([
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  const tools = listResult.responses[0].result.tools;
  const toolNames = tools.map((t) => t.name);
  assert(toolNames.includes("inspect_db_schema"), "必须包含 inspect_db_schema 工具");
  assert(toolNames.includes("list_tables"), "必须包含 list_tables 工具");
  assert(toolNames.includes("query_dict_codes"), "必须包含 query_dict_codes 工具");
  console.log("✅ [PASS] tools/list 包含预期工具:", toolNames.join(", "));
  passed++;

  // 测试 3: 探查 user 表结构
  console.log("--- 3. 测试 inspect_db_schema 探查 user 表 ---");
  const userSchemaResult = await runMcpSession([
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "inspect_db_schema", arguments: { tableName: "user" } },
    },
  ]);
  const userRes = userSchemaResult.responses[0].result;
  assert.strictEqual(userRes.isError, false);
  const userSchema = JSON.parse(userRes.content[0].text);
  assert.strictEqual(userSchema.tableName, "user");
  const colNames = userSchema.columns.map((c) => c.columnName);
  assert(colNames.includes("id") && colNames.includes("email") && colNames.includes("name"));
  const idCol = userSchema.columns.find((c) => c.columnName === "id");
  assert.strictEqual(idCol.isPrimaryKey, true, "id 列必须识别为主键");
  console.log("✅ [PASS] user 表 Schema 检索成功，列数:", userSchema.columns.length);
  passed++;

  // 测试 4: 探查 clues 表结构及外键约束
  console.log("--- 4. 测试 inspect_db_schema 探查 clues 表及外键 ---");
  const cluesSchemaResult = await runMcpSession([
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "inspect_db_schema", arguments: { tableName: "clues" } },
    },
  ]);
  const cluesRes = cluesSchemaResult.responses[0].result;
  assert.strictEqual(cluesRes.isError, false);
  const cluesSchema = JSON.parse(cluesRes.content[0].text);
  assert.strictEqual(cluesSchema.tableName, "clues");
  assert(cluesSchema.foreignKeys.some((fk) => fk.targetTable === "user"));
  console.log("✅ [PASS] clues 表 Schema 检索成功，外键指向 user 表");
  passed++;

  // 测试 5: RBAC 鉴权拦截 (GUEST 角色拦截演练)
  console.log("--- 5. 测试 RBAC 安全准入 (GUEST 角色阻断) ---");
  const guestResult = await runMcpSession(
    [
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "inspect_db_schema", arguments: { tableName: "todos" } },
      },
    ],
    { CLUE_MCP_ROLE: "GUEST" },
  );
  const guestRes = guestResult.responses[0].result;
  assert.strictEqual(guestRes.isError, true);
  assert(guestRes.content[0].text.includes("[RBAC 拒绝]"));
  console.log("✅ [PASS] RBAC 门禁成功阻断 GUEST 角色调用诊断工具");
  passed++;

  // 测试 6: 核心涉密黑名单表拦截 (ops_user_credential)
  console.log("--- 6. 测试敏感表黑名单拦截演练 (ops_user_credential) ---");
  const blacklistResult = await runMcpSession([
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "inspect_db_schema", arguments: { tableName: "ops_user_credential" } },
    },
  ]);
  const blacklistRes = blacklistResult.responses[0].result;
  assert.strictEqual(blacklistRes.isError, true);
  assert(blacklistRes.content[0].text.includes("[安全告警]"));
  console.log("✅ [PASS] 敏感黑名单成功阻断越权刺探");
  passed++;

  // 测试 7: SQL 注入入参防御
  console.log("--- 7. 测试 SQL 注入防御拦截 ---");
  const injectionResult = await runMcpSession([
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "inspect_db_schema", arguments: { tableName: "user; DROP TABLE user;" } },
    },
  ]);
  const injectionRes = injectionResult.responses[0].result;
  assert.strictEqual(injectionRes.isError, true);
  assert(injectionRes.content[0].text.includes("表名格式不合法"));
  console.log("✅ [PASS] 非法表名正则校验拦截成功");
  passed++;

  // 测试 8: query_dict_codes 探查单个字典 (clue_status)
  console.log("--- 8. 测试 query_dict_codes 探查 clue_status 字典 ---");
  const statusDictResult = await runMcpSession([
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "query_dict_codes", arguments: { dictType: "clue_status" } },
    },
  ]);
  const statusDictRes = statusDictResult.responses[0].result;
  assert.strictEqual(statusDictRes.isError, false);
  const statusDict = JSON.parse(statusDictRes.content[0].text);
  assert.strictEqual(statusDict.dictType, "clue_status");
  const statusCodes = statusDict.items.map((i) => i.code);
  assert(statusCodes.includes("PENDING_ASSIGN") && statusCodes.includes("IN_PROGRESS") && statusCodes.includes("CLOSED"));
  console.log("✅ [PASS] query_dict_codes 成功获取 clue_status 枚举代码:", statusCodes.join(", "));
  passed++;

  // 测试 9: query_dict_codes 缺省返回全量字典概览
  console.log("--- 9. 测试 query_dict_codes 缺省返回全量字典概览 ---");
  const allDictResult = await runMcpSession([
    {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "query_dict_codes", arguments: {} },
    },
  ]);
  const allDictRes = allDictResult.responses[0].result;
  assert.strictEqual(allDictRes.isError, false);
  const allDictData = JSON.parse(allDictRes.content[0].text);
  assert.strictEqual(allDictData.totalDictTypes, 7);
  const registeredTypes = allDictData.dictTypes.map((d) => d.dictType);
  assert(registeredTypes.includes("clue_status") && registeredTypes.includes("anomaly_tag") && registeredTypes.includes("operator_role"));
  console.log("✅ [PASS] query_dict_codes 全量字典探查成功，包含 7 大核心字典:", registeredTypes.join(", "));
  passed++;

  // 测试 10: query_dict_codes 探查不存在的字典类型拦截
  console.log("--- 10. 测试 query_dict_codes 异常字典类型校验拦截 ---");
  const invalidDictResult = await runMcpSession([
    {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "query_dict_codes", arguments: { dictType: "non_existent_dict" } },
    },
  ]);
  const invalidDictRes = invalidDictResult.responses[0].result;
  assert.strictEqual(invalidDictRes.isError, true);
  assert(invalidDictRes.content[0].text.includes("未找到指定字典类型 [non_existent_dict]"));
  console.log("✅ [PASS] 非法字典类型拦截并列出可用字典提示成功");
  passed++;

  // 测试 11: query_dict_codes GUEST 角色拦截
  console.log("--- 11. 测试 query_dict_codes GUEST 角色 RBAC 拦截 ---");
  const guestDictResult = await runMcpSession(
    [
      {
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: { name: "query_dict_codes", arguments: { dictType: "clue_status" } },
      },
    ],
    { CLUE_MCP_ROLE: "GUEST" },
  );
  const guestDictRes = guestDictResult.responses[0].result;
  assert.strictEqual(guestDictRes.isError, true);
  assert(guestDictRes.content[0].text.includes("[RBAC 拒绝]"));
  console.log("✅ [PASS] query_dict_codes 同样受 RBAC 门禁约束");
  passed++;

  console.log("==================================================================");
  console.log(`🎉 全部 ${passed}/11 项 MCP 契约与安全测试 100% 验证通过！`);
}

runTests().catch((err) => {
  console.error("❌ [MCP Test Failed]:", err);
  process.exit(1);
});
