# clue-lens 架构地图 (ARCHITECTURE.md)

> **定位:** 本文件是本工程当前代码的导航地图，记录工程的真实架构模式、模块目录职责、数据表关系与调用链路。  
> **设计哲学:** **坚持 Next.js 原生心智，坚决拒绝 J2EE 机械套壳。** 不搞冗余无意义的 Interface/Impl/VO 胶水层，采用现代全栈高内聚、轻量、类型安全的三层分层模型（RSC/Actions 表现层 $\rightarrow$ 纯函数领域规则层 $\rightarrow$ DAL 数据访问层 $\rightarrow$ Drizzle 实体层）。

---

## 1. 现代化 Next.js 原生分层架构 (Non-J2EE Pattern)

本工程严格遵循 Vercel 官方《Data Security & Server Actions in Next.js》推荐的工业级最佳实践，既杜绝代码全堆在单个文件的“大泥球”，又避免 J2EE 的“过度抽象”：

```mermaid
graph TD
    subgraph 表现与入口层_Presentation_Layer
        RSC[服务端只读页面 RSC<br/>src/app/(app)/**/page.tsx]
        CLIENT[客户端交互组件<br/>src/components/**]
        ACTION[变更动作 Server Actions<br/>src/app/actions/**/*.ts]
    end

    subgraph 领域与规则层_Domain_Layer
        ANOMALY[异常检测纯函数<br/>src/lib/anomaly-detector.ts]
        ADVISORY[双模处置建议引擎<br/>src/lib/advisory-engine.ts]
        EXCEL[Excel流式解析与对齐<br/>src/lib/excel-parser.ts]
        EXPORTER[报告生成服务<br/>src/lib/report-exporter.ts]
    end

    subgraph 数据访问层_DAL_Data_Access_Layer
        DAL[数据访问函数 DAL<br/>src/dal/*.ts 或 src/db/queries/*.ts]
        SESSION[会话与鉴权门禁<br/>src/lib/session.ts]
        VALIDATION[Zod 参数防卫<br/>src/lib/validations/*.ts]
    end

    subgraph 持久化与驱动层_Persistence_Layer
        DRIZZLE[Drizzle ORM<br/>src/db/index.ts & schema.ts]
        SQLITE[(SQLite 单文件数据库<br/>data/app.db - WAL模式)]
    end

    CLIENT -->|表单提交 / RPC调用| ACTION
    CLIENT -->|页面跳转| RSC
    RSC -->|零API开销/只读聚合| DAL
    RSC -->|React cache 去重| SESSION
    ACTION -->|1. 身份守卫 requireSession| SESSION
    ACTION -->|2. 入参防卫 safeParse| VALIDATION
    ACTION -->|3. 核心业务计算| ANOMALY
    ACTION -->|3. 核心业务计算| ADVISORY
    ACTION -->|4. 数据写入与状态跃迁| DAL
    DAL -->|类型安全查询构建| DRIZZLE
    DRIZZLE -->|原生连接| SQLITE
```

### 1.1 分层职责与设计规约

| 分层 | 对应目录 | 核心职责 | 绝不做什么（反模式禁令） |
|---|---|---|---|
| **1. 表现与入口层** | `src/app/**/page.tsx`<br>`src/app/actions/**`<br>`src/components/**` | - **RSC 页面**：服务端直接调 DAL 查数，直接流式返回 HTML，享受零网络开销。<br>- **Server Actions**：作为写操作的 Controller，强制执行“四部曲”：`requireSession` 鉴权 $\rightarrow$ Zod 防御 $\rightarrow$ 调用 DAL/领域逻辑 $\rightarrow$ `revalidatePath`。<br>- **Client Components**：专注前端用户交互与表单输入。 | ❌ 严禁在组件中手写拼接 SQL<br>❌ 严禁写冗余的 J2EE 风格纯透传 Controller<br>❌ 严禁客户端直接信任未校验的入参 |
| **2. 领域与规则层** | `src/lib/*-detector.ts`<br>`src/lib/*-engine.ts`<br>`src/lib/report-*.ts` | 封装**无状态纯函数（Pure Functions）**，如 5 维异常计算规则、专家处置规则树、Markdown 模板渲染。 | ❌ 不与特定框架生命周期深度耦合<br>❌ 不直接操作 HTTP 请求上下文，保证 100% 单元测试免 Mock 运行 |
| **3. 数据访问层 (DAL)** | `src/dal/**/*.ts`<br>或 `src/db/queries/**/*.ts` | 集中封装 Drizzle ORM 的查询语句（如 `getClueById`、`listCluesWithFilter`、`upsertCluesBatch`）。配合 React `cache()` 实现请求期去重。 | ❌ 不在 DAL 内部直接读取客户端请求头或 Cookie<br>❌ 不把复杂的界面交互逻辑混入数据层 |
| **4. 持久化与实体层** | `src/db/schema.ts`<br>`src/db/index.ts` | 唯一权威物理 DDL 声明与 TypeScript 类型推导源。定义主键、唯一约束、外键级联与索引。 | ❌ 严禁维护两套分离的 Entity 类与 DTO 类（Drizzle `$inferSelect` 原生推导） |

---

## 2. 数据库设计与持久化规范 (SQLite)

### 2.1 专卖监管线索核心实体关系图

```mermaid
erDiagram
    user ||--o{ session : "1:N 拥有会话"
    user ||--o{ monopoly_clues : "1:N 录入线索"
    monopoly_clues ||--o{ clue_timeline_logs : "1:N 级联流转时间轴"
    user ||--o{ system_audit_logs : "1:N 操作审计"

    user {
        text id PK
        text name
        text email UK
        integer email_verified
        integer created_at
    }

    session {
        text id PK
        text user_id FK
        text token UK
        integer expires_at
    }

    monopoly_clues {
        text id PK
        text clue_no UK "线索业务唯一编号"
        text discovery_date "发现日期"
        text region "所属区域"
        text source "线索来源"
        text type "线索类型"
        text target_name "涉案经营主体"
        text risk_level "高/中/低"
        real amount "涉及金额"
        text department "责任部门"
        text handler "责任人"
        text deadline "办理期限"
        integer need_review "是否需要复核(0/1)"
        text status "5状态生命周期"
        text check_date "核查时间"
        text check_result "核查结果"
        text measures "处置措施"
        text review_comment "复核意见"
        text close_reason "归档原因"
        text user_id FK "关联用户"
        integer created_at
        integer updated_at
    }

    clue_timeline_logs {
        text id PK
        text clue_id FK "级联删除"
        text operator_role "经办角色"
        text operator_name "经办姓名"
        text action "DISPATCH/SUBMIT/APPROVE/REJECT"
        text from_status "前序状态"
        text to_status "跃迁后状态"
        text comment "备注或驳回原因"
        integer created_at
    }

    system_audit_logs {
        text id PK
        text trace_id "链路追踪ID"
        text operator_role "操作角色"
        text operator_id "操作者ID"
        text action "安全敏感操作"
        text target_id "操作对象ID"
        text details "变更上下文JSON"
        text ip_address "客户端IP"
        integer created_at
    }
```

### 2.2 存储与运行特征

- **零外部服务依赖:** 默认写入 `data/app.db`，由 Node.js 进程直连，无需安装 PostgreSQL/MySQL 服务。
- **WAL 并发模式:** 开启 `PRAGMA journal_mode = WAL;`，读写互不阻塞，大幅提升 SQLite 在 Web 场景下的并发读取吞吐。
- **外键级联保障:** 开启 `PRAGMA foreign_keys = ON;`，级联删除（`onDelete: "cascade"`）完全由数据库内核兜底，防止孤儿数据。
- **热更新句柄防泄漏:** 通过 `globalThis.sqlite` 缓存连接实例，解决 Next.js 极速热编译（HMR）重复初始化连接导致的句柄堆积。

---

## 3. 认证授权与会话安全流转机制

Better Auth 与 Next.js 15 App Router 的全生命周期交互链路如下：

```mermaid
sequenceDiagram
    autonumber
    actor User as 用户浏览器
    participant ClientPage as 客户端组件 (LoginPage)
    participant AuthAPI as Route Handler (/api/auth/[...all])
    participant SessionHelper as session.ts (requireSession)
    participant DB as SQLite (data/app.db)

    User->>ClientPage: 输入邮箱与密码提交
    ClientPage->>ClientPage: Zod Schema (loginSchema) 前端校验
    ClientPage->>AuthAPI: authClient.signIn.email(data)
    AuthAPI->>DB: 验证用户密码与哈希
    DB-->>AuthAPI: 匹配通过
    AuthAPI->>DB: 创建新 session 记录
    AuthAPI-->>User: 写入 HttpOnly 会话 Cookie (token)
    User->>SessionHelper: 访问受保护路由 /clues
    Note over SessionHelper: React cache() 单请求内只查询一次 DB
    SessionHelper->>DB: 根据 Cookie 查询 session & user
    alt 会话有效
        SessionHelper-->>User: 渲染 (app)/clues 服务端页面
    else 未登录或过期
        SessionHelper-->>User: 307 Redirect 跳转 /login
    end
```

---

## 4. 前端组件与样式架构

- **Tailwind CSS v4 原生引擎:** 使用 `@tailwindcss/postcss` 编译器，样式入口位于 `src/app/globals.css`。全面摒弃旧版 JavaScript 配置文件，采用 `@theme inline` 映射 CSS 变量，原生支持现代 OKLCH 色域。
- **设计令牌与暗黑模式:**
  - 根样式采用 `:root` 与 `.dark` 类名切换。
  - 通过 `@custom-variant dark (&:is(.dark *));` 实现无缝暗色模式切换。
- **shadcn/ui New York 规范:**
  - 组件均标注 `data-slot` 属性（如 `data-slot="button"`），语义清晰且易于全局覆盖样式。
  - 采用 `@radix-ui/react-*` 无样式可访问性基建，配合 `class-variance-authority` (cva) 处理多种尺寸与变体。

---

## 5. 运维与生产部署拓扑

```mermaid
flowchart LR
    HOST[单机 Linux 服务器 / Docker 容器]
    DATA[(挂载存储卷 /data)]
    ENV[环境变量注入<br/>BETTER_AUTH_SECRET<br/>BETTER_AUTH_URL]

    HOST --- DATA
    ENV --> HOST
    HOST -->|80/443| NGINX[反向代理 / Nginx / Caddy]
    NGINX -->|HTTPS 终止| CLIENT[终端用户浏览器]
```

- **容器化部署要点:** 使用 Debian 系基础镜像（如 `node:22-slim`），保证 `better-sqlite3` 原生 C++ 编译插件在运行时具备 glibc 支持。
- **数据持久化:** Docker 容器必须通过 `-v $(pwd)/data:/app/data` 挂载主机持久化目录，防止容器销毁后 SQLite 数据库丢失。
- **备份建议:** 支持使用 SQLite 原生 `.backup` 命令，或在线复制 `app.db`、`app.db-wal`、`app.db-shm` 三个文件实施热备份。

---

## 6. MCP 智能体服务与 SQLite Schema 探查机制

为方便 Cursor / Claude Desktop / Antigravity 等 AI 辅助编码智能体精准获取本工程 SQLite 结构，工程内置了标准的 MCP 服务器：

```mermaid
sequenceDiagram
    autonumber
    actor Agent as AI Coding Agent (Cursor / IDE)
    participant Stdio as Stdio JSON-RPC (scripts/mcp-server.mjs)
    participant Security as McpSecurityContext (RBAC)
    participant Inspector as SQLite Schema Inspector
    participant SQLite as data/app.db
    participant Audit as clue_mcp_audit_log (只追加)

    Agent->>Stdio: tools/call {"name": "inspect_db_schema", "arguments": {"tableName": "monopoly_clues"}}
    Stdio->>Security: 校验当前角色 (CLUE_MCP_ROLE)
    alt 角色为 GUEST
        Security-->>Stdio: 抛出 403 McpAccessDeniedException
        Stdio->>Audit: 记录 FORBIDDEN 审计日志
        Stdio-->>Agent: {"isError": true, "content": [{"text": "[RBAC 拒绝]..."}]}
    else 角色为 DEVELOPER / ARCHITECT
        Security-->>Inspector: 准入通过，开始解析表名
        Inspector->>Inspector: 正则校验 ^[a-zA-Z0-9_]{1,64}$ & 黑名单防御
        Inspector->>SQLite: PRAGMA table_info / foreign_key_list / index_list
        SQLite-->>Inspector: 返回物理列类型、主外键、约束
        Inspector->>Stdio: 组装 TableSchemaDTO (包含语义注释与 DDL)
        Stdio->>Audit: 记录 SUCCESS 审计留痕
        Stdio-->>Agent: {"isError": false, "content": [{"text": "{...TableSchemaDTO...}"}]}
    end
```

- **安全边界保障:**
  - 严禁查询 `SELECT *` 真实数据，只允许调阅元数据。
  - 表名入参正则强制防御 SQL 注入。
  - 黑名单防御涉密表（如 `ops_user_credential`）。
  - 所有诊断输出强制流向 `stderr`，保障 `stdout` 纯净供 JSON-RPC 通信。
