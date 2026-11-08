import { defineConfig } from "drizzle-kit";

// drizzle-kit 不会自动读取 .env，这里手动加载（Node >= 20.12）
try {
  process.loadEnvFile(".env");
} catch {
  // .env 不存在时使用默认值
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./data/app.db",
  },
});
