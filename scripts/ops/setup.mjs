import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(ROOT);

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

// 激活团队共享 Git 门禁 (core.hooksPath=.githooks，合并自原 init-hooks.sh)
console.log("🔧 [Init] 正在配置团队共享 Git 门禁 (.githooks)...");
const gitCheck = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
if (gitCheck.status === 0 && (gitCheck.stdout || "").trim() === "true") {
  spawnSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "inherit" });
  console.log("✅ [Init] Git 门禁配置成功！每次 git commit 前将自动触发 .githooks/pre-commit 确定性审查");
} else {
  console.log("⚠️ [Init] 当前目录未初始化 Git，跳过 hooksPath 设置。");
}

// POSIX 平台确保脚本具备可执行权限（Windows 无需处理）
function walkChmod(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkChmod(full);
    else if (/\.(sh|mjs)$/.test(entry.name) || dir.endsWith(".githooks")) {
      try {
        fs.chmodSync(full, 0o755);
      } catch {
        // 忽略个别文件权限失败
      }
    }
  }
}
if (process.platform !== "win32") {
  for (const target of [".githooks", "scripts"]) walkChmod(path.join(ROOT, target));
}

console.log("🛡️ [Init] AI Agent 前置安全护栏已就绪：scripts/agent/pre-tool-guard.mjs（含 worktree 物理围栏）");
