---
description: "测试与代码质量规约：静态类型检查、确定性门禁、测试分层与严禁伪测试"
globs: "src/**/*.test.ts,src/**/*.test.tsx,scripts/**/*.sh"
alwaysApply: true
---

# 测试与质量保障规约 (clue-lens)

> **核心原则:** 代码可以由 AI 编写，但质量必须由可验证的确定性测试与静态门禁背书。

## 1. 质量防线分层

1. **类型安全门禁 (TypeScript):**
   - 提交前必须执行 `npm run typecheck`。
   - `tsconfig.json` 保持 `strict: true`，严禁提交存在 `any` 泛滥或 TypeScript 类型报错的代码。
2. **确定性安全与规范门禁 (Shell Scripts):**
   - `./scripts/check-consistency.sh`: 验证核心物理表名、模型类、SDD 契约与架构文档定义零漂移。
   - `./scripts/static-security-check.sh`: 静态扫描 Server Actions 是否遗漏鉴权守卫、nextCookies 插件与 C++ 原生驱动配置。
   - `./scripts/secret-scan.sh`: 严防任何生产密钥或私有 Token 误入版本控制。
   - `npm run test:mcp`: 验证 MCP 智能体探查契约、RBAC 角色拦截与涉密黑名单安全准入。
3. **单元测试与业务逻辑验证 (Node Test Runner / tsx):**
   - **专卖监管 5 维异常识别引擎验证 (`src/tests/anomaly-detector.test.ts`):** 针对重复经营对象、区域短期高频连发、涉案巨额（>=10万）、超期预警、高风险未分派必须具备严格断言。
   - **Excel 台账行级容错解析验证 (`src/tests/excel-parser.test.ts`):** 验证中文字段对齐映射、非法行跳过容错与错误明细收集。
   - **敏感数据脱敏工具验证 (`src/tests/utils.test.ts`):** 针对 `maskMobile` 11 位手机号、短号、极短号与空值边界进行穷尽断言。
   - **全生命周期 GWT 场景端到端验证 (`src/tests/clue-workflow.test.ts`):** 必须真实覆盖正向黄金流转闭环（导入->分派->办理->复核->归档）、终审复核驳回回退二次办结、时限非法防卫等 GWT 场景。
   - 严禁空断言伪测试，单测必须明确包含边界值断言（`assert.strictEqual(...)`, `assert(...)`）。

## 2. 自动化前置审查
- 项目配备 `./scripts/deterministic-review.sh`。
- 本地开发或 CI 自动化构建时，统一执行确定性机器审查，生成 `evidence/deterministic-review-report.md`。
- 门禁存在任何一项 `FAIL` 时，严禁合并或交付生产。
