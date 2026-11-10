// ==============================================================================
// scripts/lib/exec.mjs
// 跨平台命令执行辅助库 (Node.js ESM)
// Windows 下仅 npm 家族（.cmd 脚本，必须经 cmd.exe 解析）走 shell；
// node / git 等原生 .exe 直接 spawn，避免 cmd.exe 误解析含空格路径
// （如 C:\Program Files\nodejs\node.exe）与 git pathspec 的 "!" 字符。
// ==============================================================================
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 仓库根目录（本文件位于 <root>/scripts/lib/）
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Windows 上以 .cmd/.bat 形式分发、必须经 shell 调用的包管理器命令
const WIN_SHELL_COMMANDS = new Set(["npm", "npx", "pnpm", "yarn"]);

export function run(cmd, args = [], opts = {}) {
  const useShell = process.platform === "win32" && WIN_SHELL_COMMANDS.has(cmd);
  return spawnSync(cmd, args, { ...opts, ...(useShell ? { shell: true } : {}) });
}

// 执行 npm script，成功返回 true（stdio 继承输出到当前控制台）
export function runNpmScript(scriptName, opts = {}) {
  const res = run("npm", ["run", scriptName], { stdio: "inherit", ...opts });
  return res.status === 0;
}
