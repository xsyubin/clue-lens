---
description: "测试与代码质量规约：静态类型检查、确定性门禁、测试分类判定矩阵与严禁伪测试"
globs: "src/**/*.test.ts,src/**/*.test.tsx,scripts/**"
alwaysApply: true
---

# 测试与质量保障规约 (clue-lens)

> **核心原则:** 代码可以由 AI 编写，但质量必须由可验证的确定性测试与静态门禁背书。

## 1. 质量防线分层

1. **类型安全门禁 (TypeScript):**
   - 提交前必须执行 `npm run typecheck`。
   - `tsconfig.json` 保持 `strict: true`，严禁提交存在 `any` 泛滥或 TypeScript 类型报错的代码。
2. **确定性安全与规范门禁 (Node.js ESM Scripts):**
   - `node scripts/gates/check-consistency.mjs`: 验证核心物理表名、模型类、SDD 契约与架构文档定义零漂移。
   - `node scripts/gates/check-security.mjs`: 静态扫描 Server Actions 是否遗漏鉴权守卫、nextCookies 插件与 C++ 原生驱动配置。
   - `node scripts/gates/check-secrets.mjs`: 严防任何生产密钥或私有 Token 误入版本控制。
   - `npm run test:mcp`: 验证 MCP 智能体探查契约、RBAC 角色拦截与涉密黑名单安全准入。
3. **业务逻辑与自动化测试分级判定矩阵 (Node Test Runner / tsx):**
   测试框架统一采用 Node 原生测试驱动（`tsx --test src/tests/*.test.ts`），按代码逻辑类型实施精准分层，严禁一刀切与形式主义：

   | 代码特征分类 | 典型场景 | 必测要求 | 验收与断言规范 |
   |---|---|---|---|
   | **类 A · 纯函数与核心计算规则** | 业务阈值判断、数据脱敏、协议/文件容错解析、意向评分算法、导出格式化 | **强制编写单元测试** | 必须覆盖正常入参、临界阈值、空值与异常容错边界，严禁空断言；必须使用明确的 `assert.strictEqual` / `assert`。 |
   | **类 B · 状态机与多角色协作流转** | 跨角色分派、办结提交、审批复核驳回、终审归档闭环 | **强制编写 GWT 场景端到端测试** | 真实走通正向黄金流转与逆向驳回/越权阻断旅程。**具体业务场景由该功能的 `spec/<feature>/tasks.md` 统一定义并跟踪**，测试全绿方可标记任务完成。 |
   | **类 C · 轻量展示与基础单表 CRUD** | 纯静态布局、数据字典下拉、基础表单回显、简单 Badge 渲染 | **豁免编写独立单测** | 由 TypeScript 静态类型无死角检查与 Next.js 构建编译兜底，严禁为了盲目刷覆盖率编写无业务价值的形式主义单测。 |

## 2. 测试质量红线与反模式禁令

1. **严禁空断言伪测试:** 单测严禁只运行函数而不做 `assert` 断言，严禁编写 `expect(true).toBe(true)` 类欺骗门禁的无意义代码。
2. **严禁在测试中篡改生产防卫:** 测试必须在真实或受控的隔离环境（如 SQLite 本地内存/单文件、合法 Session Mock）中执行，严禁通过修改业务代码的生产逻辑来“迎合”测试。
3. **自动化前置审查一票否决:** 本地开发或 CI 自动化构建时统一执行 `./scripts/review.sh`。测试套件存在任何一项 `FAIL` 时，严禁合并代码或交付交付生产。
