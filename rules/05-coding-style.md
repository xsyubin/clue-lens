---
description: "编码风格与 TypeScript/React 19 规范：命名规约、路径别名、导入顺序与 Hooks 规范"
globs: "src/**/*.ts,src/**/*.tsx"
alwaysApply: true
---

# 编码风格与 TypeScript/React 19 规范

## 1. 命名规范

| 类型 | 命名模式 | 示例 | 存放位置 |
|---|---|---|---|
| 页面 / 路由组件 | `PascalCase` | `DashboardPage`, `LoginPage` | `src/app/**/page.tsx` |
| UI 原子组件 | `PascalCase` | `Button`, `CardHeader` | `src/components/ui/*.tsx` |
| 业务复合组件 | `PascalCase` | `AddTodoForm`, `ClueFilterBar` | `src/components/*.tsx` |
| 工具函数 / 动作 | `camelCase` | `cn`, `createClue`, `maskMobile` | `src/lib/*.ts`, `src/app/actions/*.ts` |
| Zod 验证规则 | `{业务名}Schema` | `loginSchema`, `clueInputSchema` | `src/lib/validations.ts` |
| 文件与目录命名 | `kebab-case` | `add-todo-form.tsx`, `auth-client.ts` | 项目各目录统一 |

## 2. 导入与路径别名

- 统一采用 `@/*` 别名引用内部模块，严禁出现深层相对路径（如 `../../../../db`）：
  ```typescript
  import { db } from "@/db";
  import { requireSession } from "@/lib/session";
  import { Button } from "@/components/ui/button";
  ```
- 导入顺序建议：
  1. 外部依赖（`react`, `next/*`, `drizzle-orm`, `zod`）
  2. 内部基础设施（`@/db`, `@/lib/*`）
  3. 内部 UI 与组件（`@/components/*`）
  4. 类型定义（`import type { ... }`）

## 3. React 19 最佳实践
- **表单状态绑定:** 推荐使用 React 19 原生 `useActionState` 搭配 Server Action，优雅获得 `[state, formAction, pending]`。
- **避免过度客户端化:** 仅在需要状态（`useState`）、生命周期（`useEffect`）、事件监听（`onClick`, `onSubmit`）或浏览器特有 API 时添加 `"use client"`；其余页面与展示型容器优先采用 RSC（React Server Component）。
- **组件属性类型:** 使用 `React.ComponentProps<"div">` 或 `React.ComponentProps<typeof Primitive>`，配合 `cn(baseClasses, className)` 传递样式。
