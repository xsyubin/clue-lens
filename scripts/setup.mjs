import { randomBytes } from "node:crypto";
import fs from "node:fs";

if (fs.existsSync(".env")) {
  console.log(".env 已存在，跳过生成");
} else {
  const example = fs.readFileSync(".env.example", "utf8");
  const secret = randomBytes(32).toString("hex");
  fs.writeFileSync(
    ".env",
    example.replace("change-me-to-a-random-string", secret),
  );
  console.log("已生成 .env（含随机 BETTER_AUTH_SECRET）");
}

fs.mkdirSync("data", { recursive: true });

// 自动初始化本地 SQLite 表结构
await import("./init-db.mjs");
