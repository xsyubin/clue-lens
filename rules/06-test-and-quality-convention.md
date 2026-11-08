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
   - `./scripts/check-consistency.sh`: 验证核心表名、模型类与文档定义零漂移。
   - `./scripts/static-security-check.sh`: 静态扫描 Server Actions 是否遗漏鉴权或越权检查。
   - `./scripts/secret-scan.sh`: 严防任何生产密钥或私有 Token 误入版本控制。
3. **单元测试与业务逻辑验证:**
   - 复杂计算与转换函数（如线索意向分算法、数据脱敏工具 `maskMobile`、Zod Schema 校验）必须配套单元测试。
   - 严禁空断言伪测试，单测必须明确包含边界值断言（`expect(...)`）。

## 2. 自动化前置审查
- 项目配备 `./scripts/deterministic-review.sh`。
- 本地开发或 CI 自动化构建时，统一执行确定性机器审查，生成 `evidence/deterministic-review-report.md`。
- 门禁存在任何一项 `FAIL` 时，严禁合并或交付生产。
