import { inspectDbSchema, listAllowedTables, queryDictCodes } from "./schema-inspector";
import { recordMcpAudit } from "./audit";

const PROTOCOL_VERSION = "2024-11-05";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class McpProtocolHandler {
  /**
   * 处理单行 JSON-RPC 消息
   * @returns 响应 JSON 字符串；若为通知则返回 null
   */
  public handle(line: string): string | null {
    if (!line || !line.trim()) return null;

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line.trim());
    } catch (err) {
      return JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: `Parse error: ${(err as Error).message}` },
      });
    }

    const id = request.id !== undefined ? request.id : null;
    const method = request.method;

    if (!method) {
      return JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Missing method" },
      });
    }

    // 忽略通知消息
    if (method.startsWith("notifications/")) {
      return null;
    }

    try {
      switch (method) {
        case "initialize":
          return this.initialize(id);
        case "tools/list":
          return this.toolsList(id);
        case "tools/call":
          return this.toolsCall(id, request.params);
        case "ping":
          return JSON.stringify({ jsonrpc: "2.0", id, result: {} });
        default:
          return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          });
      }
    } catch (err) {
      return JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: `Internal error: ${(err as Error).message}` },
      });
    }
  }

  private initialize(id: string | number | null): string {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: {
          name: "clue-mcp-server",
          version: "1.0.0",
        },
      },
    });
  }

  private toolsList(id: string | number | null): string {
    const tools = [
      {
        name: "inspect_db_schema",
        description:
          "查询指定 SQLite 白名单数据表的字段列名、数据类型、可空性、主键约束与外键关系；仅返回结构定义，严禁读取业务数据。",
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description:
                "目标物理数据表名，例如: user, session, account, verification, todos, clues, clue_follow_ups",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "list_tables",
        description: "列出当前工程 SQLite 数据库中所有已授权探查的数据表概览与字段数统计。",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "query_dict_codes",
        description:
          "查询专卖监管业务数据字典与枚举编码映射（包含线索状态、风险等级、案由类型、来源渠道、操作角色、异常识别代码、责任部门等）。支持按 dictType 单独查询，缺省返回全量字典概览。",
        inputSchema: {
          type: "object",
          properties: {
            dictType: {
              type: "string",
              description:
                "字典类型编码，可选值: clue_status, risk_level, clue_type, clue_source, operator_role, anomaly_tag, department。缺省返回全部字典清单。",
            },
          },
        },
      },
    ];

    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: { tools },
    });
  }

  private toolsCall(id: string | number | null, params?: Record<string, any>): string {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const traceId = crypto.randomUUID().replace(/-/g, "");
    const startTime = Date.now();

    try {
      let outputData: unknown;

      if (toolName === "inspect_db_schema") {
        const tableName = args.tableName;
        outputData = inspectDbSchema(tableName);
      } else if (toolName === "list_tables") {
        outputData = listAllowedTables();
      } else if (toolName === "query_dict_codes") {
        outputData = queryDictCodes(args.dictType);
      } else {
        throw new Error(`未知工具名称: ${toolName}`);
      }

      const executionMs = Date.now() - startTime;
      recordMcpAudit({
        traceId,
        toolName: toolName || "unknown",
        arguments: args,
        status: "SUCCESS",
        executionMs,
      });

      return JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(outputData, null, 2),
            },
          ],
          isError: false,
        },
      });
    } catch (err) {
      const executionMs = Date.now() - startTime;
      const errorMsg = (err as Error).message || String(err);
      const isForbidden = errorMsg.includes("[RBAC 拒绝]") || errorMsg.includes("[安全告警]");

      recordMcpAudit({
        traceId,
        toolName: toolName || "unknown",
        arguments: args,
        status: isForbidden ? "FORBIDDEN" : "ERROR",
        errorMessage: errorMsg,
        executionMs,
      });

      return JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: errorMsg,
            },
          ],
          isError: true,
        },
      });
    }
  }
}
