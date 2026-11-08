import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/* ===== Better Auth 所需的表 ===== */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

/* ===== 业务表示例：待办事项 ===== */
export const todos = sqliteTable(
  "todos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("todos_user_idx").on(t.userId)],
);

/* ===== 核心业务表：线索管理 ===== */
export const clues = sqliteTable(
  "clues",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerCompany: text("customer_company"),
    source: text("source").notNull().default("WEBSITE"),
    status: text("status").notNull().default("NEW"),
    intentScore: integer("intent_score").notNull().default(0),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("clues_user_idx").on(t.userId),
    index("clues_status_idx").on(t.status),
    index("clues_created_at_idx").on(t.createdAt),
  ],
);

/* ===== 业务从表：线索跟进明细 ===== */
export const clueFollowUps = sqliteTable(
  "clue_follow_ups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clueId: text("clue_id")
      .notNull()
      .references(() => clues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    nextAction: text("next_action"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("follow_ups_clue_idx").on(t.clueId),
    index("follow_ups_user_idx").on(t.userId),
  ],
);

/* ===== MCP 审计日志表 ===== */
export const clueMcpAuditLog = sqliteTable("clue_mcp_audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  traceId: text("trace_id").notNull(),
  operatorId: text("operator_id").notNull(),
  role: text("role").notNull(),
  toolName: text("tool_name").notNull(),
  arguments: text("arguments"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  executionMs: integer("execution_ms"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ===== 专卖监管线索主表 ===== */
export const monopolyClues = sqliteTable(
  "monopoly_clues",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clueNo: text("clue_no").notNull().unique(),
    discoveryDate: text("discovery_date").notNull(),
    region: text("region").notNull(),
    source: text("source").notNull(),
    type: text("type").notNull(),
    targetName: text("target_name").notNull(),
    riskLevel: text("risk_level").notNull().default("中"),
    amount: integer("amount").notNull().default(0),
    department: text("department"),
    handler: text("handler"),
    deadline: text("deadline"),
    needReview: integer("need_review", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("PENDING_ASSIGN"),
    checkDate: text("check_date"),
    checkResult: text("check_result"),
    measures: text("measures"),
    reviewComment: text("review_comment"),
    closeReason: text("close_reason"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_clues_clue_no").on(t.clueNo),
    index("idx_clues_region").on(t.region),
    index("idx_clues_type").on(t.type),
    index("idx_clues_status").on(t.status),
    index("idx_clues_target_name").on(t.targetName),
    index("idx_clues_discovery_date").on(t.discoveryDate),
    index("idx_clues_user_id").on(t.userId),
  ],
);

/* ===== 专卖监管线索流转时间轴历史表 ===== */
export const clueTimelineLogs = sqliteTable(
  "clue_timeline_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clueId: text("clue_id")
      .notNull()
      .references(() => monopolyClues.id, { onDelete: "cascade" }),
    operatorRole: text("operator_role").notNull(),
    operatorName: text("operator_name").notNull(),
    action: text("action").notNull(), // 'IMPORT', 'DISPATCH', 'SUBMIT', 'APPROVE', 'REJECT', 'CLOSE'
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    comment: text("comment"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_timeline_clue_id").on(t.clueId)],
);

/* ===== 系统全局安全审计日志表 ===== */
export const systemAuditLogs = sqliteTable(
  "system_audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    traceId: text("trace_id").notNull(),
    operatorRole: text("operator_role").notNull(),
    operatorId: text("operator_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id"),
    details: text("details"),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("idx_audit_trace").on(t.traceId)],
);

export type Todo = typeof todos.$inferSelect;
export type Clue = typeof clues.$inferSelect;
export type NewClue = typeof clues.$inferInsert;
export type ClueFollowUp = typeof clueFollowUps.$inferSelect;
export type NewClueFollowUp = typeof clueFollowUps.$inferInsert;
export type ClueMcpAuditLog = typeof clueMcpAuditLog.$inferSelect;

export type MonopolyClue = typeof monopolyClues.$inferSelect;
export type NewMonopolyClue = typeof monopolyClues.$inferInsert;
export type ClueTimelineLog = typeof clueTimelineLogs.$inferSelect;
export type NewClueTimelineLog = typeof clueTimelineLogs.$inferInsert;
export type SystemAuditLog = typeof systemAuditLogs.$inferSelect;
export type NewSystemAuditLog = typeof systemAuditLogs.$inferInsert;
