import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dbPath = path.resolve(
  process.cwd(),
  process.env.DATABASE_URL ?? "./data/app.db",
);

// 开发模式下热更新会重复执行模块，缓存连接避免句柄泄漏
const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
};

function createConnection() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

const sqlite = globalForDb.sqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
