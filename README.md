# clue-lens (线索透视)

Next.js 15（App Router）+ Drizzle ORM + SQLite + Better Auth + Tailwind CSS v4 + shadcn/ui + Zod 现代化全栈与 AI 研发工程范例。

前后端一体，数据库为项目内置轻量文件（`data/app.db`），开启 WAL 并发与外键级联，开箱即用。

---

## 快速开始

要求 Node.js 20.12 或更高版本。

```bash
./scripts/ops/init-hooks.sh   # 激活本地 Git 门禁与脚本执行权限
npm install                   # 安装依赖
npm run setup                 # 生成 .env（含随机安全密钥）并初始化数据库表
npm run dev                   # 启动开发服务器
```

打开 http://localhost:3000 ，注册一个账号即可使用仪表盘与示例。

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（Turbopack 极速热编译） |
| `npm run build` / `npm start` | 构建并以生产模式运行 |
| `npm run typecheck` | TypeScript 静态类型无死角检查 |
| `npm run review` | 触发通用确定性机器前置审查并输出报告 |
| `npm run check:consistency` | 校验工程结构、表名与架构规范一致性 |
| `npm run check:security` | 静态扫描 Server Actions 鉴权与架构红线 |
| `npm run db:push` | 将 `src/db/schema.ts` 变更直接推送到本地 SQLite |
| `npm run db:generate` / `db:migrate` | 生成并执行版本化迁移文件（生产发布推荐） |
| `npm run db:studio` | 打开 Drizzle Studio 视觉化浏览数据 |

---

## 目录结构与工程规范

工程严格遵循 **SDD (Spec-Driven Development)** 与 **AI Agent 治理体系**：

```
clue-lens/
├── AGENTS.md                  # AI 智能体治理体系入口、架构红线与渐进式规则索引
├── ARCHITECTURE.md            # 系统实现事实导航地图（分层依赖、ER图、时序图）
├── rules/                     # 架构规范与红线约束（可执行规约）
│   ├── 01-project-architecture.md
│   ├── 02-database-design.md
│   ├── 03-drizzle-convention.md
│   ├── 04-server-actions-convention.md
│   ├── 05-coding-style.md
│   ├── 06-test-and-quality-convention.md
│   └── 07-security-and-auth.md
├── spec/                      # 规格中心单一权威源 (SSOT)
│   ├── README.md              # SDD 五阶段流转全景
│   └── clue-lens/             # 业务规格（raw-req -> clarification -> requirements -> design -> tasks）
├── scripts/                   # 自动化运维、质量门禁与智能体脚本
│   ├── review.sh              # 门禁审查唯一总入口（支持 --staged）
│   ├── review-checks.list     # 门禁审查可插拔配置清单
│   ├── gates/                 # 质量门禁检查类脚本 (check-*.sh)
│   ├── ops/                   # 环境配置与数据运维 (setup/init-db/seed/init-hooks)
│   ├── agent/                 # 多智能体调度与隔离沙盒 (agent-run/worktree)
│   └── mcp/                   # MCP 协议服务与探查客户端 (server/test-client)
├── evidence/                  # 机器审查报告输出归档
├── src/
│   ├── app/                   # App Router 路由组与 Server Actions
│   ├── components/            # shadcn/ui 原子组件与业务复合组件
│   ├── db/                    # Drizzle ORM Schema 与 SQLite 连接
│   └── lib/                   # Better Auth、会话守卫与 Zod 契约
```

---

## 架构红线与约束

1. **鉴权与数据隔离:** 所有数据变更的 Server Actions 必须在方法头部执行 `const session = await requireSession()`，且查询与更新必须携带 `eq(table.userId, session.user.id)`。
2. **输入防御:** 外部输入必须通过 Zod Schema 进行 `safeParse`，严禁未经校验直接入库。
3. **原生模块打包:** `next.config.ts` 必须配置 `serverExternalPackages: ["better-sqlite3"]`。
4. **敏感脱敏:** 手机号等客户隐私在列表展示时必须脱敏为 `138****0000`。
