---
description: "编码风格与 TypeScript/React 19 规范：命名规约、路径别名、导入顺序与 Hooks 规范"
globs: "src/**/*.ts,src/**/*.tsx"
alwaysApply: true
---

# 编码风格与 TypeScript/React 19 规范

## 1. 命名规范

| 类型 | 命名模式 | 示例 | 存放位置 |
|---|---|---|---|
| 页面 / 路由组件 | `PascalCase` | `DashboardPage`, `CluesPage` | `src/app/**/page.tsx` |
| UI 原子组件 | `PascalCase` | `Button`, `CardHeader`, `Badge` | `src/components/ui/*.tsx` |
| 业务复合组件 | `PascalCase` | `CluesWorkbench`, `TimelineView`, `DispatchDialog` | `src/components/clues/*.tsx` |
| 工具函数 / 动作 | `camelCase` | `cn`, `maskMobile`, `dispatchClueAction`, `parseCluesExcel` | `src/lib/*.ts`, `src/app/actions/*.ts` |
| Zod 验证规则 | `{业务名}Schema` | `dispatchClueSchema`, `importClueRowSchema`, `loginSchema` | `src/lib/validations/*.ts` |
| 文件与目录命名 | `kebab-case` | `clues-workbench.tsx`, `anomaly-detector.ts` | 项目各目录统一 |

## 2. 导入与路径别名

- 统一采用 `@/*` 别名引用内部模块，严禁出现深层相对路径（如 `../../../../db`）：
  ```typescript
  import { db } from "@/db";
  import { requireSession } from "@/lib/session";
  import { Button } from "@/components/ui/button";
  import { dispatchClueAction } from "@/app/actions/clues";
  ```
- 导入顺序建议：
  1. 外部依赖（`react`, `next/*`, `drizzle-orm`, `zod`）
  2. 内部基础设施（`@/db`, `@/lib/*`）
  3. 内部 UI 与组件（`@/components/*`）
  4. 类型定义（`import type { ... }`）

## 3. React 19 最佳实践
- **避免过度客户端化（RSC 优先）:** 仅在需要状态（`useState`）、生命周期（`useEffect`）、事件监听（`onClick`, `onSubmit`）或浏览器特有 API 时在文件头部声明 `"use client"`；展示型页面大盘与布局优先采用 RSC（React Server Component）。
- **组件属性类型:** 使用 `React.ComponentProps<"div">` 或 `React.ComponentProps<typeof Primitive>`，配合 `cn(baseClasses, className)` 合并传递样式。
- **Server Action 客户端绑定规范:**
  - **模态弹窗与复杂流程（Dialog / Drawer）:** 采用 `useTransition` 或标准 async 事件处理器，直接调用 RPC 风格 Server Action，以便在异步返回后精确控制弹窗开闭、清空表单与 Toast 提示。
  - **原生基础表单（Form Page）:** 推荐搭配 React 19 原生 `useActionState` 绑定 Form-Style Action，优雅获得 `[state, formAction, pending]`。

## 4. UI 表单与设计系统军规 (shadcn/ui Form Controls Standard)

为彻底消除表单控件的“原生 HTML 粗糙拼接感”，保持整个工程交互质感与现代中台规范严格对齐，制定以下硬性约束：

1. **严禁手写原生 `<select>` 标签**：
   - 必须 100% 使用 `@/components/ui/select` 中的 `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`。
   - 严禁出现操作系统底层的粗糙原生下拉菜单。紧凑场景（如分页、角色选择）使用 `size="sm"`。
2. **严禁手写原生 `<input type="date">`**：
   - 必须 100% 使用 `@/components/ui/date-picker` 中的 `DatePicker`。
   - 严禁日历图标悬空与轴线错位；表单 Label 严禁硬编码拼接 `(YYYY-MM-DD)` 等格式说明。
3. **严禁使用纯文本字符充当图标（如 `✕`、`×`）**：
   - 模态弹窗与操作按钮的关闭控件，必须统一使用 `lucide-react` 的矢量图标 `<X className="w-4 h-4" />`。
4. **单选框与复选框规范**：
   - 复选框必须统一使用 `@/components/ui/checkbox` 中的 `Checkbox`，支持点击关联 Label 整行触发。
   - 单选框必须统一使用 `@/components/ui/radio-group` 中的 `RadioGroup` 与 `RadioGroupItem`，复核裁决支持 `variantColor="emerald"` 与 `variantColor="red"` 状态分级。
5. **模态弹窗规范**：
   - 模态框与会话弹窗统一使用 `@/components/ui/dialog` 中的 `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`，保证全局一致的淡入淡出动效、背景遮罩层与无障碍焦点捕获。
