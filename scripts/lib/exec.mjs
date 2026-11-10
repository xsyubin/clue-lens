// ==============================================================================
// scripts/lib/exec.mjs
// 跨平台命令执行辅助库 (Node.js ESM)
// Windows 下经由 shell 解析 npm.cmd / git.exe 等命令，其余平台直接 spawn。
// ==============================================================================
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 仓库根目录（本文件位于 <root>/scripts/lib/）
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function run(cmd, args = [], opts = {}) {
  if (process.platform === "win32") {
    return spawnSync(cmd, args, { ...opts, shell: true });
  }
  return spawnSync(cmd, args, opts);
}

// 执行 npm script，成功返回 true（stdio 继承输出到当前控制台）
export function runNpmScript(scriptName, opts = {}) {
  const res = run("npm", ["run", scriptName], { stdio: "inherit", ...opts });
  return res.status === 0;
}
