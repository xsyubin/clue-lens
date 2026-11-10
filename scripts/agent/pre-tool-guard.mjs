#!/usr/bin/env node
// ==============================================================================
// scripts/agent/pre-tool-guard.mjs
// 统一 AI 安全护栏 (Node.js ESM)
// 拦截敏感凭据探测、数据外传、远程写入与架构破坏
// 支持 CLI 参数 ($*) 与 stdin JSON (Claude Code / Antigravity / Codex Hook)
// 退出码: 0 允许放行; 2 拦截阻断并向 stderr 输出警告
// ==============================================================================

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function block(tag, reason) {
  process.stderr.write(`[GUARD-BLOCK] [${tag}] 护栏拦截：${reason}\n`);
  process.exit(2);
}

// 敏感配置文件与私钥模式 (允许 .env.example)
const SENSITIVE_FILE_PATTERN = /(^|[/\\])\.env(?!\.example)(\.[a-zA-Z0-9_-]+)?$|application-prod\.ya?ml$|id_rsa$|\.(pem|p12|jks)$/i;

// 敏感凭证变量与配置文件刺探命令模式
const SENSITIVE_CMD_PATTERN = /(^|[\s"'`/])\.env(?!\.example)($|[\s"'`/.]|(?=[^a-zA-Z0-9_-]))|application-prod\.ya?ml|id_rsa|\.(pem|p12|jks)|BETTER_AUTH_SECRET/i;

// 数据外传与越权命令
const EXFILTRATION_CMD_PATTERN = /curl[^\n]*(--data|--upload-file|-T|-d)\b|wget[^\n]*https?:\/\/|nc\s|scp\s|git\s+push\b/i;

// 架构底线破坏
const ARCH_BREACH_CMD_PATTERN = /next\.config\.ts.*better-sqlite3|better-sqlite3.*next\.config\.ts|sed[^\n]*drizzle\.config\.ts|>+\s*drizzle\.config\.ts/i;

export function auditOperation({ toolName = "", cmd = "", filePath = "", rawText = "", rawData = null }) {
  // 1. 目标文件路径检测 (针对 FileRead / View / Edit / Write / read_file)
  if (filePath && SENSITIVE_FILE_PATTERN.test(filePath)) {
    block("凭据护栏拦截", "严禁访问敏感配置文件或私钥凭据！");
  }

  // 2. 命令级检测 (针对 Bash / run_command)
  if (cmd) {
    if (SENSITIVE_CMD_PATTERN.test(cmd)) {
      block("凭据护栏拦截", "严禁在命令中刺探敏感凭据、私钥或生产环境变量！");
    }
    if (EXFILTRATION_CMD_PATTERN.test(cmd)) {
      block("传输护栏拦截", "禁止在 Agent 运行期执行潜在数据外传、远程推送或越权写入！");
    }
    if (ARCH_BREACH_CMD_PATTERN.test(cmd)) {
      block("架构护栏拦截", "严禁越界修改核心模块排除配置与数据库基础连接！");
    }
  }

  // 3. 非结构化原始文本保底检测 (仅在非 JSON 输入下)
  if (!cmd && !filePath && rawText) {
    if (SENSITIVE_CMD_PATTERN.test(rawText)) {
      block("凭据护栏拦截", "严禁刺探敏感凭据或私钥文件！");
    }
    if (EXFILTRATION_CMD_PATTERN.test(rawText)) {
      block("传输护栏拦截", "禁止执行潜在数据外传或远程写入！");
    }
  }

  // 4. Worktree 物理隔离围栏 (rules/08)：严禁在主工作区 main 分支上直接写入代码或提交
  checkWorktreeFence({ toolName, cmd, filePath, rawData });
}

function checkWorktreeFence({ toolName = "", cmd = "", filePath = "", rawData = null }) {
  if (process.env.ALLOW_MAIN_WRITE === "1" || process.env.BYPASS_WORKTREE_GUARD === "1") {
    return;
  }

  // 判断是否为写入类操作
  const isWriteTool = /^(write_file|edit_file|write|edit|patch|apply_patch)$/i.test(toolName);
  const hasWritePayload = Boolean(
    rawData?.arguments?.Content ||
    rawData?.arguments?.Replacement ||
    rawData?.tool_input?.content ||
    rawData?.tool_input?.replacement ||
    rawData?.tool_input?.new_string
  );
  const isFileWrite = isWriteTool || (filePath && hasWritePayload);

  const isCommitOnMain = /^\s*git\s+commit\b/i.test(cmd.trim());
  const isRedirectWrite = /(?:>|>>)\s*(?:src\/|rules\/|scripts\/|app\/|spec\/|package\.json|drizzle\.config\.ts|next\.config\.ts|tsconfig\.json)/i.test(cmd);
  const isShellWrite = isCommitOnMain || isRedirectWrite;

  if (!isFileWrite && !isShellWrite) {
    return;
  }

  // 解析目标路径
  const targetPath = filePath ? path.resolve(process.cwd(), filePath) : process.cwd();
  const normalizedTarget = targetPath.replace(/\\/g, "/");

  // 如果路径处于 .worktrees/ 内部，说明已经在隔离沙盒中，放行
  if (normalizedTarget.includes("/.worktrees/")) {
    return;
  }

  // 探查 Git 根目录与分支（需清除可能被上级 git hook 污染的 GIT 环境变量）
  let toplevel = "";
  let branch = "";
  const gitEnv = { ...process.env };
  delete gitEnv.GIT_DIR;
  delete gitEnv.GIT_WORK_TREE;
  delete gitEnv.GIT_INDEX_FILE;
  delete gitEnv.GIT_OBJECT_DIRECTORY;
  delete gitEnv.GIT_COMMON_DIR;

  try {
    const targetDir = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()
      ? targetPath
      : path.dirname(targetPath);
    const topRes = spawnSync("git", ["-C", targetDir, "rev-parse", "--show-toplevel"], { env: gitEnv, encoding: "utf8" });
    if (topRes.status === 0) {
      toplevel = (topRes.stdout || "").trim();
    }
    const branchRes = spawnSync("git", ["-C", targetDir, "rev-parse", "--abbrev-ref", "HEAD"], { env: gitEnv, encoding: "utf8" });
    if (branchRes.status === 0) {
      branch = (branchRes.stdout || "").trim();
    }
  } catch {
    return;
  }

  if (!toplevel || !branch) {
    return;
  }

  // 若 toplevel 本身在 .worktrees/ 内部，放行
  if (toplevel.replace(/\\/g, "/").includes("/.worktrees/")) {
    return;
  }

  // 仅在主分支 (main / master) 上且目标路径位于该工程主工作区内时实施阻断
  if ((branch === "main" || branch === "master") && targetPath.startsWith(toplevel)) {
    // 忽略 .git 内部自身的非 commit 操作
    if (targetPath.startsWith(path.join(toplevel, ".git")) && !isCommitOnMain) {
      return;
    }

    block(
      "Worktree 隔离围栏",
      `检测到当前操作试图在主工作区 ${branch} 分支上直接修改文件或提交代码！\n` +
      `   - 目标路径: ${path.relative(toplevel, targetPath) || targetPath}\n` +
      `   - 所在分支: ${branch}\n` +
      `👉 架构红线：遵循 rules/08-worktree-workflow.md，严禁直接在主工作区 ${branch} 分支动手。\n` +
      `   正确流程：请先执行 ./scripts/agent/worktree.sh new <slug> 创建隔离沙盒，并在 .worktrees/clue-lens-<slug> 目录下进行改动与测试验证！`
    );
  }
}

async function main() {
  const cliArgs = process.argv.slice(2).join(" ").trim();
  if (cliArgs) {
    auditOperation({ cmd: cliArgs });
    process.exit(0);
  }

  // 从 stdin 读取 payload
  let buffer = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    buffer += chunk;
  }
  buffer = buffer.trim();
  if (!buffer) {
    process.exit(0);
  }

  let toolName = "";
  let cmd = "";
  let filePath = "";
  let isJson = false;
  let rawData = null;

  try {
    const data = JSON.parse(buffer);
    isJson = true;
    rawData = data;
    // 适配 Claude Code Hook 格式: { tool_name, tool_input: { command, file_path, path } }
    // 适配 Antigravity / Codex Hook 格式: { tool, arguments: { CommandLine, Path } }
    toolName = data?.tool_name || data?.tool || data?.toolName || "";
    cmd = data?.tool_input?.command || data?.arguments?.CommandLine || data?.arguments?.command || "";
    filePath = data?.tool_input?.file_path || data?.tool_input?.path || data?.arguments?.Path || data?.arguments?.path || "";
  } catch {
    // 非 JSON 纯文本输入
    cmd = buffer;
  }

  auditOperation({ toolName, cmd, filePath, rawText: isJson ? "" : buffer, rawData });
  process.exit(0);
}

// 仅在直接执行时启动 main
if (process.argv[1] && process.argv[1].endsWith("pre-tool-guard.mjs")) {
  main().catch((err) => {
    process.stderr.write(`[GUARD-ERROR] 护栏内部异常: ${err.message}\n`);
    process.exit(2);
  });
}
