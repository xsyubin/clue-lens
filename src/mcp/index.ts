import readline from "node:readline";
import { McpProtocolHandler } from "./protocol-handler";

export function startMcpServer(): void {
  const handler = new McpProtocolHandler();

  process.stderr.write("[MCP Server] clue-lens SQLite schema MCP server 启动成功，传输模式: stdio\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", (line) => {
    if (!line.trim()) return;

    try {
      const response = handler.handle(line);
      if (response) {
        process.stdout.write(response + "\n");
      }
    } catch (err) {
      process.stderr.write(`[MCP Server Error] 处理消息异常: ${err}\n`);
    }
  });

  rl.on("close", () => {
    process.stderr.write("[MCP Server] 标准输入关闭，服务退出。\n");
    process.exit(0);
  });
}

// 支持直接运行入口
if (require.main === module || (typeof process !== "undefined" && process.argv[1]?.endsWith("index.ts"))) {
  startMcpServer();
}
