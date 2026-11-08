#!/usr/bin/env node
// ==============================================================================
// scripts/init-db.mjs
// 初始化本地 SQLite 数据库表结构
// ==============================================================================
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL ?? "./data/app.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let db;
try {
  const { default: Database } = await import("better-sqlite3");
  db = new Database(dbPath);
} catch {
  const { DatabaseSync } = await import("node:sqlite");
  db = new DatabaseSync(dbPath);
}

const exec = (sql) => {
  if (typeof db.exec === "function") {
    db.exec(sql);
  } else {
    db.prepare(sql).run();
  }
};

exec(`PRAGMA journal_mode = WAL;`);
exec(`PRAGMA foreign_keys = ON;`);

exec(`
-- 1. 用户表
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. 会话表
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

-- 3. 账号认证表
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 4. 验证码表
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

-- 5. 待办事项表
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS todos_user_idx ON todos(user_id);

-- 6. 线索主表
CREATE TABLE IF NOT EXISTS clues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_company TEXT,
  source TEXT NOT NULL DEFAULT 'WEBSITE',
  status TEXT NOT NULL DEFAULT 'NEW',
  intent_score INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS clues_user_idx ON clues(user_id);
CREATE INDEX IF NOT EXISTS clues_status_idx ON clues(status);
CREATE INDEX IF NOT EXISTS clues_created_at_idx ON clues(created_at);

-- 7. 线索跟进记录表
CREATE TABLE IF NOT EXISTS clue_follow_ups (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  next_action TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS follow_ups_clue_idx ON clue_follow_ups(clue_id);
CREATE INDEX IF NOT EXISTS follow_ups_user_idx ON clue_follow_ups(user_id);

-- 8. MCP 审计日志表
CREATE TABLE IF NOT EXISTS clue_mcp_audit_log (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  role TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  arguments TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  execution_ms INTEGER,
  created_at INTEGER NOT NULL
);

-- 9. 敏感演练表（仅用于 MCP 黑名单拦截安全演练）
CREATE TABLE IF NOT EXISTS ops_user_credential (
  credential_id TEXT PRIMARY KEY,
  username TEXT,
  password_hash TEXT,
  secret_key TEXT
);

-- 10. 专卖监管线索主表
CREATE TABLE IF NOT EXISTS monopoly_clues (
  id TEXT PRIMARY KEY,
  clue_no TEXT NOT NULL UNIQUE,
  discovery_date TEXT NOT NULL,
  region TEXT NOT NULL,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT '中',
  amount INTEGER NOT NULL DEFAULT 0,
  department TEXT,
  handler TEXT,
  deadline TEXT,
  need_review INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING_ASSIGN',
  check_date TEXT,
  check_result TEXT,
  measures TEXT,
  review_comment TEXT,
  close_reason TEXT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clues_clue_no ON monopoly_clues(clue_no);
CREATE INDEX IF NOT EXISTS idx_clues_region ON monopoly_clues(region);
CREATE INDEX IF NOT EXISTS idx_clues_type ON monopoly_clues(type);
CREATE INDEX IF NOT EXISTS idx_clues_status ON monopoly_clues(status);
CREATE INDEX IF NOT EXISTS idx_clues_target_name ON monopoly_clues(target_name);
CREATE INDEX IF NOT EXISTS idx_clues_discovery_date ON monopoly_clues(discovery_date);

-- 11. 专卖监管线索流转时间轴历史表
CREATE TABLE IF NOT EXISTS clue_timeline_logs (
  id TEXT PRIMARY KEY,
  clue_id TEXT NOT NULL REFERENCES monopoly_clues(id) ON DELETE CASCADE,
  operator_role TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  comment TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timeline_clue_id ON clue_timeline_logs(clue_id);

-- 12. 系统全局安全审计日志表
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON system_audit_logs(trace_id);
`);

console.log("✅ [init-db] SQLite 数据库表初始化完成！路径:", dbPath);
