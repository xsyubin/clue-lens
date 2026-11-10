# 表单控件与交互体验体系化重构 (Form Controls & UI Design System)

## 一、原始背景与业务诉求

在近期专卖监管线索分析与闭环管理系统（ClueLens）的实际操作与演示中，用户明确反馈：
- 模态弹窗和工作台里的时间选择框、下拉框、复选框等样式体验不佳，具有明显的“HTML 原始输入框”粗糙拼凑感。
- 日期输入框里的日历图标孤零零悬在正中间偏左，没有右对齐，与上面的下拉框右侧箭头严重错位，破坏了表单整体视觉节奏。
- 表单标签后面硬编码 `(YYYY-MM-DD)` 格式提示，弹窗关闭按钮直接使用文本字符 `✕`，单选和复选框为操作系统原生小方块，不同浏览器（macOS / Windows / Chrome / Safari）下渲染差异巨大，缺乏现代企业级政企业务系统的专业严谨质感。

用户要求：
1. **全局复盘**：全面排查整个工程中所有存在“原生 HTML 粗糙拼接感”的组件与表单项。
2. **走 SDD 规格驱动流程**：在 `spec/form-controls/` 下建立规格文档，逐步推进需求澄清（Clarification）、正式需求（Requirements）、技术设计（Design）、任务拆解（Tasks）与高质量实现及审查（Impl & Review）。

---

## 二、全局工程排查复盘清单

经全工程（`src/`）代码全量静态扫描，共发现 **9 个业务与基础组件** 存在共计 **18+ 处** 原生 HTML 粗糙控件或视觉割裂问题：

### 1. 原生 `<select>` 泛滥（共 9 处）
- `src/components/clues/filter-bar.tsx`（5 处）：所属区域、线索类型、风险等级、办理状态、异常预警特征。
- `src/components/clues/dispatch-dialog.tsx`（2 处）：承办责任部门、承办责任人员。
- `src/components/clues/clues-workbench.tsx`（1 处）：分页每页条数选择器（`pageSize`）。
- `src/components/role-switcher.tsx`（1 处）：顶部操作人员角色切换下拉框。
- **痛点**：缺少自定义下拉小箭头，直接依赖操作系统原生外观；macOS / Windows 下各不相同；点击后弹出操作系统原生纯白/纯灰浮层，暗黑模式适配粗糙。

### 2. 原生 `<input type="date">` 样式失真与悬空（共 2 处）
- `src/components/clues/dispatch-dialog.tsx`（1 处）：要求办理期限。
- `src/components/clues/handling-form.tsx`（1 处）：核查调查日期。
- **痛点**：WebKit 浏览器下日历图标缺少 `margin-left: auto`，孤悬在中间偏左，右侧大片空白；与同一表单内的 Select 下拉箭头严重错位；标签强加 `(YYYY-MM-DD)`。

### 3. 原生 Checkbox 与 Radio 控件（共 4 处）
- `src/components/clues/dispatch-dialog.tsx`（1 处）：办结后需要部门负责人复核复选框。
- `src/components/clues/advisory-card.tsx`（1 处）：处置建议已核实采纳复选框。
- `src/components/clues/review-dialog.tsx`（2 处）：复核通过 / 驳回退回单选框。
- **痛点**：原生小圆点/小方块，尺寸小且缺少平滑动效与选中态高亮，触控或点击命中区偏窄。

### 4. 纯文本字符关闭按钮（共 3 处）
- `src/components/clues/dispatch-dialog.tsx`（1 处）：`<button>✕</button>`。
- `src/components/clues/review-dialog.tsx`（1 处）：`<button>✕</button>`。
- `src/components/clues/import-modal.tsx`（1 处）：`<button>✕</button>`。
- **痛点**：字符在不同系统字体库中字重、行高与基线不一致，产生轻微错位与模糊感，应统一使用矢量图标 `<X className="w-4 h-4" />`。

### 5. 设计系统层（Design System）基建缺失
- `src/components/ui/` 仅有 `button`, `card`, `input`, `badge`, `label`，缺少通用的表单组件基建（如封装良好的 `select`, `checkbox`, `date-picker`, `textarea`, `modal/dialog`）。

---

## 三、目标愿景

1. **统一设计语言与对齐基准线**：所有表单输入框、下拉框、日期框高度、圆角、边框、Focus 焦点态（Focus Ring）、禁用态统一步调；右侧操作图标（日历图标、下拉箭头、清除按钮）严格在同一垂直对齐轴线上。
2. **现代企业级视觉质感**：全面消除纯文本字符与原生粗粝系统控件，使用 Lucide 细线条矢量图标体系，完美支持深浅主题模式。
3. **零沉重外部依赖**：基于现有的 Tailwind CSS v4 + React 19 + Lucide React 原生构建轻量、高效的 UI 封装，不破坏现有服务端/客户端组件架构与运行性能。
4. **全工程零回归**：全量重构替换 9 个目标组件，通过端到端自动化测试与静态类型检查门禁。
