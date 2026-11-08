---
description: "全栈架构与工程规范：技术栈、分层结构、RSC/客户端边界与工程底线"
globs: "src/**/*.ts,src/**/*.tsx,next.config.ts"
alwaysApply: true
---

# 项目架构与工程规范 (clue-lens)

> **文件定位:** 本文件是可执行的架构约束，回答“必须怎么做、哪些做法禁止”。当前模块路径、调用链、表关系和运行方式以 [ARCHITECTURE.md](../ARCHITECTURE.md) 为地图，不在这里重复维护实现细节。

## 1. 核心技术栈
- **框架:** Next.js 15.x (React 19, App Router 架构)
- **数据库:** SQLite (Node 原生高性能驱动 `better-sqlite3` 12.x)
- **ORM:** Drizzle ORM 0.44.x + Drizzle Kit 0.31.x
- **认证方案:** Better Auth 1.3.x (Drizzle Adapter + `nextCookies` 插件)
- **UI & 样式:** Tailwind CSS v4 + shadcn/ui (New York 风格, Radix Primitives)
- **参数校验:** Zod 4.x / 3.x
- **语言:** TypeScript 5.9+ (严格模式 `strict: true`)

## 2. 分层架构与依赖方向

工程强制保持单向依赖流动：
`UI Components -> Server Actions / Route Handlers -> lib (auth/session/validations/engines) -> db (Drizzle/SQLite)`

严禁出现反向引用或底层跨层调用高层组件。

### 2.1 模块职责边界
- **`src/app` (页面与路由):**
  - 服务端组件（RSC）作为默认组件，负责直接读取数据、鉴权跳转，保持轻量与零客户端 JS 打包。
  - 需要交互（表单输入、按钮点击、弹窗联动等）才声明 `"use client"`。
- **`src/app/actions` (业务变更动作):**
  - 声明 `"use server"`。
  - 必须进行鉴权校验 (`requireSession`)，严禁暴露未鉴权的数据写入接口。
  - 所有外部输入必须经过 Zod 校验，统一返回 `{ ok?: boolean; error?: string }` 结构。
- **`src/db` (持久层):**
  - 单一数据源，对外导出 `db` 实例与 schema。
  - 严禁在页面或组件层直接 import 原生 `better-sqlite3`。
- **`src/lib` (共享逻辑与核心业务引擎):**
  - 存放校验模式 (`validations/`)、会话守卫 (`session.ts`)、认证客户端 (`auth-client.ts`)、异常规则引擎 (`anomaly-detector.ts`)、处置建议引擎 (`advisory-engine.ts`) 与 Excel 容错解析 (`excel-parser.ts`)。
- **`src/mcp` (智能体研发元数据与审计服务):**
  - 遵循 Model Context Protocol (MCP 2024-11-05) 契约，提供只读 DDL/表结构探查与业务枚举字典查询。
  - 强行隔离涉密数据，只读不写，全量操作必须通过 `clue_mcp_audit_log` 审计留痕。
- **`src/tests` (质量与契约验证):**
  - 存放单元测试、Excel 容错解析测试与专卖监管端到端 GWT 场景自动化测试。

## 3. 架构红线与禁令

1. **红线 1（鉴权与数据隔离）:**
   - **用户私有数据:** 个人待办等私有资源，必须通过 `session.user.id` 做双重绑定隔离，严禁直接信任前端上传的 `userId`。
   - **政企协同监管数据:** 跨部门流转线索（`monopoly_clues`），更新操作**必须实施三重防卫：会话登录态守卫 + 状态机前置状态守卫（State Guard）+ 操作人角色准入守卫（Role Guard）**，且变更过程必须向时间轴（`clue_timeline_logs`）和全局审计（`system_audit_logs`）双重留痕。
2. **红线 2（原生模块打包规约）:** `next.config.ts` 必须保持 `serverExternalPackages: ["better-sqlite3"]`，避免 Webpack/Turbopack 将原生 C++ 模块打入前端或 Serverless bundle 中。
3. **红线 3（防泄露与注入）:** 严禁手写 SQL 字符串拼接；敏感个人隐私（手机号等）在前端列表展示或日志输出时必须调用 `maskMobile` 进行脱敏。
