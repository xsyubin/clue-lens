#!/usr/bin/env node
// ==============================================================================
// scripts/mcp-server.mjs
// clue-lens SQLite Schema MCP Server (stdio 传输模式)
// ==============================================================================
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";

// 表名正则校验与白名单/黑名单
const TABLE_NAME_PATTERN = /^[a-zA-Z0-9_]{1,64}$/;
const ALLOWED_TABLES = new Set([
  "user",
  "session",
  "account",
  "verification",
  "todos",
  "clues",
  "clue_follow_ups",
  "clue_mcp_audit_log",
  "monopoly_clues",
  "clue_timeline_logs",
  "system_audit_logs",
]);
const SENSITIVE_TABLES = new Set([
  "ops_user_credential",
  "ops_permission_grant",
  "admin_secrets",
]);

const TABLE_COMMENTS = {
  user: "系统用户核心主体表 (Better Auth 账号体系)",
  session: "用户登录会话凭据表 (带有效期与 IP/UserAgent 记录)",
  account: "用户身份提供方账号凭证表 (OAuth 与密码凭据)",
  verification: "安全验证与临时令牌凭据表",
  todos: "轻量待办事项业务示例表",
  clues: "线索全生命周期主表 (包含意向评分、状态机流转与归属销售顾问)",
  clue_follow_ups: "线索沟通跟进流水表 (记录每次拜访沟通与下一步计划)",
  clue_mcp_audit_log: "MCP 工具调阅安全存证审计日志表",
  monopoly_clues: "专卖监管线索核心主表 (含全生命周期状态、5维异常特征、涉案金额与经办流转)",
  clue_timeline_logs: "专卖线索流转时间轴历史表 (只追加不可篡改，记录导入/分派/办理/复核/驳回/归档全流水)",
  system_audit_logs: "系统安全合规与操作审计留痕表 (含全局 TraceId 链路追踪)",
};

const COLUMN_COMMENTS = {
  id: "主键标识 (UUID 字符串)",
  user_id: "所属用户 ID (强制用于租户数据隔离)",
  clue_id: "所属线索 ID (外键级联关联 clues 表)",
  name: "用户全名/显示名称",
  email: "用户唯一登录邮箱",
  email_verified: "邮箱验证状态 (0=未验证, 1=已验证)",
  image: "用户头像 URL 地址",
  token: "会话令牌凭证 (用于校验 Cookie)",
  expires_at: "会话过期时间戳",
  ip_address: "客户端登录 IP 地址",
  user_agent: "客户端设备浏览器标识",
  account_id: "身份提供商侧用户标识",
  provider_id: "认证提供者标识 (如 credential, github)",
  password: "哈希加密后的用户密码凭据 (严禁返回客户端)",
  title: "标题/主题简述",
  customer_name: "客户联系人姓名",
  customer_phone: "客户联系电话 (列表展示时必须脱敏)",
  customer_company: "客户所在企业名称",
  source: "线索来源 (REFERRAL/WEBSITE/EVENT/COLD_OUTREACH)",
  status: "线索状态机 (NEW/FOLLOWING/WON/LOST)",
  intent_score: "意向评分 (0~100 整数，>=70 为高意向)",
  notes: "初始沟通背景与意向备注",
  content: "本次跟进沟通详细纪要",
  next_action: "下一步动作规划",
  done: "是否已完成 (布尔值 0/1)",
  created_at: "系统创建时间戳",
  updated_at: "系统最后更新时间戳",
  trace_id: "链路追踪 ID",
  operator_id: "操作人员工号/智能体标识",
  role: "操作执行角色",
  tool_name: "调用工具名称",
  arguments: "入参快照",
  execution_ms: "执行耗时 (毫秒)",
  error_message: "异常报错简述",
  // 专卖监管线索扩展字段注释
  clue_no: "线索唯一业务编号 (如 CLUE-2026-001)",
  discovery_date: "线索发现日期 (YYYY-MM-DD)",
  region: "所属行政辖区/区域",
  target_name: "涉案经营主体/商户名称",
  risk_level: "风险等级 (高/中/低)",
  amount: "涉案案值金额 (元)",
  department: "责任承办部门",
  handler: "责任经办人",
  deadline: "办理期限截止日期 (YYYY-MM-DD)",
  need_review: "是否需要部门负责人终审复核 (0=否, 1=是)",
  check_date: "现场勘验核查日期",
  check_result: "现场核查事实结论",
  measures: "采取的法定制裁或处置措施",
  review_comment: "部门负责人复核审批意见 (驳回时必填)",
  close_reason: "终审归档结案理由说明",
  operator_role: "操作人业务角色",
  operator_name: "操作人姓名",
  from_status: "流转起始状态",
  to_status: "流转目标状态",
  comment: "操作备注与执法记录说明",
  target_id: "操作关联的目标主体 ID",
  details: "结构化审计快照 JSON",
};

// 专卖监管业务数据字典库
const BUSINESS_DICTIONARIES = {
  clue_status: {
    dictType: "clue_status",
    name: "专卖线索流转状态代码字典",
    items: [
      { code: "PENDING_ASSIGN", label: "待分派", description: "线索已入库建档，等待综合管理人员指定责任部门与责任人" },
      { code: "IN_PROGRESS", label: "办理中", description: "责任人员现场勘查核验中，待填报核查结论与处置措施" },
      { code: "PENDING_REVIEW", label: "待复核", description: "核查结论已提交，等待部门负责人审批复核" },
      { code: "COMPLETED", label: "已完成", description: "核查事实清楚且通过复核，符合结案要求" },
      { code: "CLOSED", label: "已关闭", description: "线索已全生命周期结案归档，不可再发起流转变更" },
    ],
  },
  risk_level: {
    dictType: "risk_level",
    name: "线索风险等级字典",
    items: [
      { code: "高", label: "高风险", description: "重点涉嫌假私走私、大额涉案、重复违法或团伙窝点线索" },
      { code: "中", label: "中风险", description: "存在超范围经营、擅自变更经营场所、跨区进货等一般违法" },
      { code: "低", label: "低风险", description: "轻微不规范、首次提醒整改、日常双随机抽查合格" },
    ],
  },
  clue_type: {
    dictType: "clue_type",
    name: "线索案由类型字典",
    items: [
      { code: "许可证异常", label: "许可证异常", description: "未依法取得烟草专卖零售许可证、擅自变更经营地址或超期经营" },
      { code: "经营异常", label: "经营异常", description: "违规异地进货、擅自从事卷烟批发业务、销售非渠道供货卷烟" },
      { code: "假冒走私", label: "假冒走私", description: "涉嫌生产、销售假冒伪劣卷烟或走私未完税免税卷烟" },
      { code: "未成年人售烟", label: "未成年人售烟", description: "向未成年人销售卷烟、未设置禁售未成年人标志" },
      { code: "非法寄递", label: "非法寄递", description: "通过寄递物流渠道分散邮寄寄递涉案假冒卷烟" },
      { code: "其他异常", label: "其他异常", description: "其他违反烟草专卖法律法规的情形" },
    ],
  },
  clue_source: {
    dictType: "clue_source",
    name: "线索来源渠道字典",
    items: [
      { code: "日常巡查", label: "日常巡查", description: "专卖稽查人员日常双随机或网格巡查发现" },
      { code: "群众举报", label: "群众举报", description: "12313 热线、信访或群众实名/匿名举报" },
      { code: "系统预警", label: "系统预警", description: "监管大数据平台分析研判或寄递物流异常预警推送" },
      { code: "公安移送", label: "公安移送", description: "公安、市场监管等外部门联合执法办案移交线索" },
      { code: "双随机抽查", label: "双随机抽查", description: "市场主体信用双随机跨部门联合抽查" },
      { code: "物流寄递", label: "物流寄递", description: "寄递物流集中分拨中心驻点安检排查拦截" },
    ],
  },
  operator_role: {
    dictType: "operator_role",
    name: "监管操作角色与权限字典",
    items: [
      { code: "综合管理人员", label: "综合管理人员", description: "负责台账导入、线索登记建档、任务分派、时限控制与全流程督办" },
      { code: "线索核查人员", label: "线索核查人员", description: "负责现场勘查核验、证据采集、文书送达、填报核查结论与处置措施" },
      { code: "部门负责人", label: "部门负责人", description: "负责终审复核审批（支持通过或强校验驳回回退）、结案归档与重大研判审核" },
      { code: "情报分析人员", label: "情报分析人员", description: "负责全域态势研判、高危异常标签穿透分析、挖掘团伙窝点与导出报告" },
      { code: "专卖监督管理人员", label: "专卖监督管理人员", description: "负责行政执法监督、超期督办通报、全流程时间轴审计与纪检监察留痕" },
    ],
  },
  anomaly_tag: {
    dictType: "anomaly_tag",
    name: "确定性异常识别规则标签字典",
    items: [
      { code: "REPEAT_TARGET", label: "高危重复对象", description: "涉案经营主体在全库累计出现 >= 2 次，属于重点排查对象" },
      { code: "REGION_CONCENTRATED", label: "区域短期集中", description: "所属区域近30天集中爆发 >= 5 条线索，提示区域涉烟隐患" },
      { code: "RAPID_SERIES", label: "同类连发预警", description: "近30天内同一区域且同一类型线索 >= 3 条，警惕团伙化窝点" },
      { code: "LARGE_AMOUNT", label: "涉案金额巨大", description: "涉案案值金额 >= 100,000 元，达到涉案重大案件标准" },
      { code: "OVERDUE", label: "办理超期预警", description: "当前日期已超过设定办理期限且仍未结案" },
      { code: "HIGH_RISK_PENDING", label: "高危待派督办", description: "风险等级为高且仍处于待分派状态，需立即分派督办" },
    ],
  },
  department: {
    dictType: "department",
    name: "专卖稽查责任部门字典",
    items: [
      { code: "专卖稽查一队", label: "专卖稽查一队", description: "负责主城区核心网格专卖稽查与市场净化" },
      { code: "专卖稽查二队", label: "专卖稽查二队", description: "负责商业综合体、交通枢纽与重点集贸市场巡查" },
      { code: "专卖稽查三队", label: "专卖稽查三队", description: "负责跨区域重大假冒走私与物流寄递大要案侦办" },
      { code: "城区分局专卖所", label: "城区分局专卖所", description: "负责城区零售网点日常许可证与规范经营核查" },
      { code: "市郊专卖监督所", label: "市郊专卖监督所", description: "负责城乡结合部、乡镇集市与农村零售网点专卖监督" },
    ],
  },
};

function queryDictCodes(dictType) {
  checkRbac();

  if (dictType && typeof dictType === "string" && dictType.trim()) {
    const key = dictType.trim().toLowerCase();
    const found = BUSINESS_DICTIONARIES[key];
    if (!found) {
      const available = Object.keys(BUSINESS_DICTIONARIES).join(", ");
      throw new Error(`未找到指定字典类型 [${dictType}]。当前可用字典类型: ${available}`);
    }
    return found;
  }

  // 缺省返回全量字典概览
  return {
    totalDictTypes: Object.keys(BUSINESS_DICTIONARIES).length,
    dictTypes: Object.keys(BUSINESS_DICTIONARIES).map((key) => ({
      dictType: key,
      name: BUSINESS_DICTIONARIES[key].name,
      itemCount: BUSINESS_DICTIONARIES[key].items.length,
    })),
    dictionaries: BUSINESS_DICTIONARIES,
  };
}

function getOperator() {
  return (process.env.CLUE_MCP_OPERATOR || process.env.TICKET_MCP_OPERATOR || "DEV_AGENT_01").trim();
}

function getRole() {
  return (process.env.CLUE_MCP_ROLE || process.env.TICKET_MCP_ROLE || "DEVELOPER").trim().toUpperCase();
}

function checkRbac() {
  const role = getRole();
  if (role === "GUEST") {
    throw new Error(`[RBAC 拒绝] 访客角色 [GUEST] 禁止调用任何内部运维与开发诊断工具`);
  }
}

async function getDb() {
  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL ?? "./data/app.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  try {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(dbPath, { readonly: true });
    return {
      all: (sql, params = []) => db.prepare(sql).all(...params),
      close: () => db.close(),
    };
  } catch {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
    return {
      all: (sql, params = []) => db.prepare(sql).all(...params),
      close: () => db.close(),
    };
  }
}

async function inspectDbSchema(tableName) {
  checkRbac();

  if (!tableName || !TABLE_NAME_PATTERN.test(tableName.trim())) {
    throw new Error(`表名格式不合法，仅允许 1~64 位字母、数字与下划线: "${tableName}"`);
  }
  const cleanName = tableName.trim().toLowerCase();

  if (SENSITIVE_TABLES.has(cleanName)) {
    throw new Error(`[安全告警] 表 [${cleanName}] 为高危安全敏感表，严格禁止访问！`);
  }

  if (!ALLOWED_TABLES.has(cleanName)) {
    throw new Error(`指定表 [${cleanName}] 不在当前授权探查白名单内。可用表: ${Array.from(ALLOWED_TABLES).join(", ")}`);
  }

  const db = await getDb();
  try {
    const tables = db.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name = ?", [cleanName]);
    if (!tables || tables.length === 0) {
      throw new Error(`SQLite 数据库中未找到物理表: ${cleanName}`);
    }

    const ddl = tables[0].sql || "";
    const colRows = db.all(`PRAGMA table_info('${cleanName}')`);
    const fkRows = db.all(`PRAGMA foreign_key_list('${cleanName}')`);
    const idxRows = db.all(`PRAGMA index_list('${cleanName}')`);

    const columns = colRows.map((col) => ({
      columnName: col.name,
      dataType: (col.type || "TEXT").toUpperCase(),
      isNullable: col.notnull === 0,
      isPrimaryKey: col.pk > 0,
      defaultValue: col.dflt_value,
      columnComment: COLUMN_COMMENTS[col.name] || "",
    }));

    const foreignKeys = fkRows.map((fk) => ({
      fromColumn: fk.from,
      targetTable: fk.table,
      targetColumn: fk.to,
      onDelete: fk.on_delete || "NO ACTION",
      onUpdate: fk.on_update || "NO ACTION",
    }));

    const indexes = idxRows.map((idx) => {
      const idxCols = db.all(`PRAGMA index_info('${idx.name}')`);
      return {
        indexName: idx.name,
        isUnique: idx.unique === 1,
        columns: idxCols.map((c) => c.name),
      };
    });

    return {
      tableName: cleanName,
      comment: TABLE_COMMENTS[cleanName] || "业务持久化数据表",
      columns,
      foreignKeys,
      indexes,
      ddl,
    };
  } finally {
    db.close();
  }
}

async function listAllowedTables() {
  checkRbac();

  const db = await getDb();
  try {
    const existing = db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

    const results = [];
    for (const tableName of ALLOWED_TABLES) {
      if (existingNames.has(tableName)) {
        const cols = db.all(`PRAGMA table_info('${tableName}')`);
        results.push({
          tableName,
          comment: TABLE_COMMENTS[tableName] || "业务数据表",
          columnCount: cols.length,
        });
      }
    }
    return results;
  } finally {
    db.close();
  }
}

function recordAudit(traceId, toolName, args, status, errorMsg, executionMs) {
  const operator = getOperator();
  const role = getRole();
  process.stderr.write(
    `[MCP Audit] TraceID=${traceId}, Tool=${toolName}, Operator=${operator}, Role=${role}, Status=${status}, Cost=${executionMs}ms\n`,
  );
}

// JSON-RPC 消息调度器
async function handleMessage(line) {
  if (!line || !line.trim()) return null;

  let request;
  try {
    request = JSON.parse(line.trim());
  } catch (err) {
    return JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: `Parse error: ${err.message}` },
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

  if (method.startsWith("notifications/")) {
    return null;
  }

  if (method === "initialize") {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "clue-mcp-server",
          version: "1.0.0",
        },
      },
    });
  }

  if (method === "tools/list") {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "inspect_db_schema",
            description: "查询指定 SQLite 白名单表的字段列名、类型、可空性、主键与外键；仅返回结构定义，严禁读取业务数据。",
            inputSchema: {
              type: "object",
              properties: {
                tableName: {
                  type: "string",
                  description: "目标表名，例如: user, session, account, verification, todos, clues, clue_follow_ups",
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
        ],
      },
    });
  }

  if (method === "tools/call") {
    const toolName = request.params?.name;
    const args = request.params?.arguments || {};
    const traceId = crypto.randomUUID().replace(/-/g, "");
    const startTime = Date.now();

    try {
      let outputData;
      if (toolName === "inspect_db_schema") {
        outputData = await inspectDbSchema(args.tableName);
      } else if (toolName === "list_tables") {
        outputData = await listAllowedTables();
      } else if (toolName === "query_dict_codes") {
        outputData = queryDictCodes(args.dictType);
      } else {
        throw new Error(`未知工具名称: ${toolName}`);
      }

      const cost = Date.now() - startTime;
      recordAudit(traceId, toolName, args, "SUCCESS", null, cost);

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
      const cost = Date.now() - startTime;
      const isForbidden = err.message.includes("[RBAC 拒绝]") || err.message.includes("[安全告警]");
      recordAudit(traceId, toolName, args, isForbidden ? "FORBIDDEN" : "ERROR", err.message, cost);

      return JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: err.message,
            },
          ],
          isError: true,
        },
      });
    }
  }

  if (method === "ping") {
    return JSON.stringify({ jsonrpc: "2.0", id, result: {} });
  }

  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}

// 启动 stdio 交互
process.stderr.write("[MCP Server] clue-lens SQLite schema MCP server 启动成功 (stdio 模式)\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const res = await handleMessage(line);
    if (res) {
      process.stdout.write(res + "\n");
    }
  } catch (err) {
    process.stderr.write(`[MCP Error] ${err}\n`);
  }
});
