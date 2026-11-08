import fs from "node:fs";
import path from "node:path";
import { getCurrentOperatorId, getCurrentRole } from "./security";

export interface McpAuditEntry {
  traceId: string;
  toolName: string;
  arguments: unknown;
  status: "SUCCESS" | "FORBIDDEN" | "ERROR";
  errorMessage?: string;
  executionMs: number;
}

/**
 * 记录 MCP 工具调用审计记录
 * 注意：所有日志只能写到 stderr 或 SQLite，绝对禁止输出到 stdout（避免破坏 JSON-RPC stdio 协议）
 */
export function recordMcpAudit(entry: McpAuditEntry): void {
  const operatorId = getCurrentOperatorId();
  const role = getCurrentRole();
  const argsStr = JSON.stringify(entry.arguments);

  // 1. 标准错误流日志留痕 (脱敏后输出)
  process.stderr.write(
    `[MCP Audit] TraceID=${entry.traceId}, Tool=${entry.toolName}, Operator=${operatorId}, Role=${role}, Status=${entry.status}, Cost=${entry.executionMs}ms\n`,
  );

  // 2. 尝试追加写入 SQLite clue_mcp_audit_log 表
  try {
    const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL ?? "./data/app.db");
    if (!fs.existsSync(dbPath)) return;

    let dbInstance: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3");
      dbInstance = new Database(dbPath);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require("node:sqlite");
      dbInstance = new DatabaseSync(dbPath);
    }

    const insertSql = `
      INSERT INTO clue_mcp_audit_log (
        id, trace_id, operator_id, role, tool_name, arguments, status, error_message, execution_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const recordId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const params = [
      recordId,
      entry.traceId,
      operatorId,
      role,
      entry.toolName,
      argsStr.slice(0, 1000),
      entry.status,
      entry.errorMessage ? entry.errorMessage.slice(0, 500) : null,
      entry.executionMs,
      now,
    ];

    if (typeof dbInstance.prepare === "function") {
      dbInstance.prepare(insertSql).run(...params);
    }
    if (typeof dbInstance.close === "function") {
      dbInstance.close();
    }
  } catch (err) {
    // 审计持久化异常降级为 stderr 告警，绝不阻断正常业务
    process.stderr.write(`[MCP Audit Warning] 无法写入 SQLite 审计表: ${err}\n`);
  }
}
