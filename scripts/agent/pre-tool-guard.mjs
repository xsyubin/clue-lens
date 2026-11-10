#!/usr/bin/env node
// ==============================================================================
// scripts/agent/pre-tool-guard.mjs
// 统一 AI 安全护栏 (Node.js ESM)
// 拦截敏感凭据探测、数据外传、远程写入与架构破坏
// 支持 CLI 参数 ($*) 与 stdin JSON (Claude Code / Antigravity / Codex Hook)
// 退出码: 0 允许放行; 2 拦截阻断并向 stderr 输出警告
// ==============================================================================

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

export function auditOperation({ cmd = "", filePath = "", rawText = "" }) {
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

  let cmd = "";
  let filePath = "";
  let isJson = false;

  try {
    const data = JSON.parse(buffer);
    isJson = true;
    // 适配 Claude Code Hook 格式: { tool_name, tool_input: { command, file_path, path } }
    // 适配 Antigravity / Codex Hook 格式: { tool, arguments: { CommandLine, Path } }
    cmd = data?.tool_input?.command || data?.arguments?.CommandLine || data?.arguments?.command || "";
    filePath = data?.tool_input?.file_path || data?.tool_input?.path || data?.arguments?.Path || data?.arguments?.path || "";
  } catch {
    // 非 JSON 纯文本输入
    cmd = buffer;
  }

  auditOperation({ cmd, filePath, rawText: isJson ? "" : buffer });
  process.exit(0);
}

// 仅在直接执行时启动 main
if (process.argv[1] && process.argv[1].endsWith("pre-tool-guard.mjs")) {
  main().catch((err) => {
    process.stderr.write(`[GUARD-ERROR] 护栏内部异常: ${err.message}\n`);
    process.exit(2);
  });
}
