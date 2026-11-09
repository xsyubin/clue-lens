# AGENTS.md

本工程是面向现代全栈 AI Coding 与规格驱动开发（SDD）构建的线索洞察分析工程沙盒（**clue-lens**），基于 **Next.js 15 (App Router) + Drizzle ORM + SQLite (better-sqlite3) + Better Auth + Tailwind CSS v4 + shadcn/ui + Zod** 搭建。
工程规范拆分在 `rules/` 目录下，按需阅读（渐进式披露）。

## 核心技术栈与工程约束

- **技术栈定位:** 100% 现代化纯 TypeScript/Node.js 全栈技术栈，前后端一体，运行零额外中间件开箱即跑。
- **运行环境:** 本地 SQLite 单文件数据库（`data/app.db`），开启 WAL 模式与外键约束；Node.js >= 20.12。
- **智能体 MCP 基建:** 内置 stdio 模式 Model Context Protocol 服务（`clue-mcp-server`），为 AI Coding Agent 提供只读数据库元数据探查（`inspect_db_schema`）与细粒度 RBAC 鉴权审计。
- **架构底线与安全红线:**
  1. **会话鉴权与数据隔离/流转防卫红线:** 任何涉及业务数据的 Server Action 或受保护 Route Handler，必须在方法入口显式调用 `const session = await requireSession()`。用户个人私有数据（如 todos）写查操作**必须强制显式绑定 `eq(table.userId, session.user.id)`**；政企协同监管数据（如 `monopoly_clues`）写查与状态跃迁**必须强制实施“状态机前置守卫 + 角色准入（Role Guard）+ 时间轴/安全审计全程留痕”**，严禁信任客户端传入的无主变更。
  2. **边界防御与 Zod 校验红线:** 所有外部请求入参（FormData / JSON / URL 参数）必须在进入业务逻辑前通过 `zod` Schema 的 `safeParse` 进行严格校验。校验失败应统一返回 `{ ok: false, error: string }`，严禁未经校验直接拼装写库。
  3. **SQL 安全与 Drizzle 查询规范:** 100% 采用 Drizzle ORM 类型安全 API（`db.select()`, `db.insert()`, `db.update()`, `db.delete()`）。严禁任何形式的字符串拼接 SQL；如使用 `sql` 标签，必须使用参数化插值语法。
  4. **原生模块与运行时架构约束:** `better-sqlite3` 是原生 C++ 模块，`next.config.ts` 必须显式声明 `serverExternalPackages: ["better-sqlite3"]`。SQLite 连接必须在开发模式下缓存至 `globalThis` 以避免 HMR 热更新泄漏句柄。
  5. **敏感信息脱敏与安全底线:** 涉案当事人手机号等敏感信息在前端列表展示或非审计日志打印中必须统一调用 `maskMobile` 进行掩码脱敏（如 `138****0000`）。严禁向客户端泄露密码哈希、Secret 密钥或会话凭据。
  6. **MCP 探查与审计安全红线:** MCP 工具 `inspect_db_schema` 仅允许探查表结构元数据（DDL、列定义、外键、索引），严禁读取真实业务敏感数据；`GUEST` 角色禁止访问任何诊断工具；`ops_user_credential` 属于高危涉密黑名单，触发访问必须坚决阻断并告警。
  7. **代码修改与 Worktree 物理隔离红线:** 任何要提交的代码改动、特性开发或架构改造，严禁直接在主工作区 `main` 分支上动手；必须通过 `./scripts/agent/worktree.sh new <slug>`（或并发批量时使用 `agent-run.sh` / Subagent `Workspace: "share"`）在独立 Git Worktree + 新分支中进行。测试全绿后通过 `./scripts/agent/worktree.sh merge <slug>` 快进合并，从物理层面彻底消除文件互相覆盖、Git index 锁死与 SQLite 数据库锁死（详见 [rules/08-worktree-workflow.md](rules/08-worktree-workflow.md)）。

> [!NOTE]
> 系统的分层调用时序、数据库 ER 关系与物理字段字典、部署拓扑及前端设计系统，以 [ARCHITECTURE.md](ARCHITECTURE.md) 为唯一事实源（SSOT）；本总纲侧重规则索引、安全军规与工程门禁。

## 规则与规格索引

### 规则文档
| 规则文档 | 何时阅读 | 适用文件 (globs) | 优先级 |
|---|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 全局架构导航地图、Next.js 原生分层规范、数据库 ER 与部署拓扑 | `**/*.ts`, `**/*.tsx`, `src/**` | **[必读]** |
| [rules/01-project-architecture.md](rules/01-project-architecture.md) | 了解全栈架构、分层依赖、RSC/Client 边界与工程底线 | `src/**/*.ts`, `src/**/*.tsx` | **[必读]** |
| [rules/02-database-design.md](rules/02-database-design.md) | SQLite 数据库设计、主键策略、索引规划与表结构规范 | `src/db/**/*.ts` | **[必读]** |
| [rules/03-drizzle-convention.md](rules/03-drizzle-convention.md) | Drizzle Schema 定义、推导类型、查询规约与迁移工作流 | `src/db/**/*.ts`, `drizzle.config.ts` | **[必读]** |
| [rules/04-server-actions-convention.md](rules/04-server-actions-convention.md) | Server Actions 模式、用户隔离、Zod 验证与 revalidatePath | `src/app/actions/**/*.ts` | **[必读]** |
| [rules/05-coding-style.md](rules/05-coding-style.md) | TypeScript/React 19 编码风格、命名规范与目录约定 | `src/**/*.ts`, `src/**/*.tsx` | **[必读]** |
| [rules/06-test-and-quality-convention.md](rules/06-test-and-quality-convention.md) | 确定性代码质量、类型检查门禁与测试规范 | `**/*.test.ts`, `scripts/**/*.sh` | **[必读]** |
| [rules/07-security-and-auth.md](rules/07-security-and-auth.md) | Better Auth 配置、Session 处理、CSRF/Cookie 防护与敏感脱敏 | `src/lib/auth*.ts`, `src/lib/session.ts` | **[必读]** |
| [rules/08-worktree-workflow.md](rules/08-worktree-workflow.md) | 代码修改与改造硬约束、Worktree 生命周期、依赖软链与快进合并 | `**/*` | **[必读]** |
| [spec/clue-lens/requirements.md](spec/clue-lens/requirements.md) | 业务规格书：专卖监管线索全生命周期状态流转、异常规则与契约 | `src/**/*.ts`, `spec/**/*.md` | **[必读]** |

### SDD 规格中心 (spec/)
遵循 **SDD（Spec-Driven Development，规格驱动开发）** 规范。业务功能均以功能独立目录形式沉淀在 `spec/` 下，保证规格先行与单一权威源（SSOT）。
- **`raw-requirements.md`**: 阶段 1 - 原始业务诉求与业务痛点
- **`clarification.md`**: 阶段 2 - 需求澄清结论、口径定义与防雷决策
- **`requirements.md`**: 阶段 3 - 正式需求规格说明书（SSOT 核心契约，EARS 验收标准与状态机）
- **`design.md`**: 阶段 4 - 技术架构与实现设计（表结构、Server Actions 与组件设计）
- **`tasks.md`**: 阶段 5 - 原子化任务分解清单与验证 Checklist

### SDD 技能库 (.agents/skills)
详见 [.agents/skills/WORKFLOW.md](.agents/skills/WORKFLOW.md)，提供规格驱动开发的六步标准技能流水线。跨工具的角色、输入输出、允许路径和串并行边界见 [.agents/agent-manifest.yml](.agents/agent-manifest.yml)；它是本项目的治理清单，不是某个 Agent 工具的原生配置文件。
执行前运行 `./scripts/gates/check-manifest.sh`；需要隔离运行角色时使用 `./scripts/agent/agent-run.sh --role <role> --name <run> --dry-run`。
- **`spec-clarification`**: 业务需求澄清与边界发掘
- **`spec-requirements`**: 正式业务与技术需求细化 (EARS 格式)
- **`spec-design`**: 基于现有架构与规范的技术设计
- **`spec-tasks`**: 原子化可执行开发任务分解、依赖拓扑与核心 GWT 场景化验收
- **`spec-impl`**: 遵循工程红线的测试驱动实现、EARS 规则防卫与 GWT 自动化场景验证
- **`spec-review`**: AI 辅助代码评审与交付门禁（双级 Checklist 审计卡生成）

### MCP 研发智能体服务 (.mcp.json)
项目已内置受控 MCP 研发工具服务器：
- **配置文件:** [.mcp.json](.mcp.json)，开箱即用支持 Claude Desktop / Cursor / Antigravity。
- **执行入口:** `npm run mcp` 或 `node scripts/mcp/server.mjs`。
- **提供工具:**
  - `inspect_db_schema`: 查询指定 SQLite 白名单表的字段列、类型、主键、外键约束与 DDL。
  - `list_tables`: 列出已授权探查的所有物理表概览。
  - `query_dict_codes`: 查询专卖监管业务枚举字典（状态机、风险等级、案由、来源渠道、角色、异常标签、责任部门）。
- **安全约束:** 支持 `CLUE_MCP_ROLE` 环境变量隔离（`DEVELOPER` / `ARCHITECT` / `GUEST`）；所有调用均通过 stderr 及 `clue_mcp_audit_log` 留痕。

## 快速上手与验证流程

1. 首次使用初始化环境：
   ```bash
   ./scripts/ops/init-hooks.sh   # 激活团队共享 Git 门禁与脚本可执行权限
   npm install                   # 安装依赖
   npm run setup                 # 生成 .env（含随机密钥）并初始化数据库表
   ```
2. 本地开发与调试：
   ```bash
   npm run dev                   # 启动 Next.js 极速热重载开发服务器
   npm run db:studio             # 启动 Drizzle Studio 视觉化浏览数据
   ```
3. 提交代码前确定性质量门禁验证：
   ```bash
   npm run typecheck                  # TypeScript 静态类型无死角检查
   npm run test:mcp                   # 验证 MCP 协议契约与 SQLite 探查能力
   ./scripts/gates/check-consistency.sh # 工程命名、表结构与架构一致性校验
   ./scripts/gates/check-secrets.sh     # 高置信度私钥与 Token 泄露扫描
   ./scripts/gates/check-security.sh    # 服务端鉴权与安全红线静态扫描
   ./scripts/review.sh                  # 运行全套机器前置审查并生成审计报告
   ```
