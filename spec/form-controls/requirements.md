# 表单控件与交互体验体系化重构正式需求规格说明书 (requirements.md)

> **文档性质**：SSOT 需求基线与契约标准  
> **最后修订时间**：2026-11-10  
> **修订说明**：根据需求方架构评审意见，彻底纠偏自制原生伪封装方案，全面拥抱项目官方 **shadcn/ui 组件生态**（Radix UI 原语 + Tailwind CSS v4 + Lucide 矢量图标）。

---

## 一、业务与体验需求概述

### 1.1 背景与目标
在专卖监管线索闭环管理平台中，表单输入、条件筛选、日期排期与复核裁决是执法监督人员高频日常操作。此前表单中存在“原生 HTML 粗糙拼接感”、“日期图标悬空错位”、“关闭按钮文本字符化”、“展开后呈现丑陋操作系统菜单”等质量缺陷。

本项目依照工程总体技术栈规范（`Next.js 15 + Tailwind CSS v4 + shadcn/ui`），全面引入并规范 **shadcn/ui 官方组件生态**，对基础表单原子控件与 9 个业务交互组件实施系统化现代化重构。

### 1.2 核心价值
- **正统中台质感**：采用 shadcn/ui 官方生态（基于 Radix UI 原语），拥有带精致阴影、平滑缩放动效、选项对齐 Checkmark 标记的现代浮层，彻底淘汰操作系统底层原生弹层。
- **视觉轴线对齐**：所有表单输入框、下拉框、日期拾取器右侧操作图标（`ChevronDown`、`CalendarIcon`）严格对齐到同一垂直基准线。
- **无障碍与全键盘支持**：依托 Radix UI 业界标杆级的 WAI-ARIA 规范，开箱即支持键盘上下按键切换、回车选定、Esc 键退出等流畅交互。
- **主题完全自适应**：在浅色与深色模式（Dark Mode）下完美适配 CSS 变量，绝无原生操作系统的白斑或反差错乱。

---

## 二、页面与组件交互需求

### 2.1 shadcn/ui 官方原子控件契约 (Design System)

#### 2.1.1 `Select` 控件（基于 shadcn 官方 `select.tsx`）
- **交互契约**：
  - 点击 `SelectTrigger` 展开带进出场缩放动效的 `SelectContent` 阴影浮层。
  - 选项 `SelectItem` 悬浮呈现浅色高亮，选中项展示清晰的 `Check` 矢量图标。
  - 触发器右侧固定呈现居中 `ChevronDown` 矢量图标，彻底杜绝操作系统原生粗糙小三角。
  - 标准输入高度统一为 `h-9`（36px），紧凑高度 `h-8`（32px），圆角 `rounded-lg`。
  - 支持 `focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500` 绿色焦点环与暗黑模式适配。
  - 支持 `disabled` 状态（半透明且不可交互）。

#### 2.1.2 `DatePicker` 控件（基于 shadcn 官方 `Popover` + `Calendar`）
- **交互契约**：
  - 外观样式与 `SelectTrigger`、`Input` 保持 100% 像素级对齐（高度 `h-9`、圆角 `rounded-lg`、边框与文本字号一致）。
  - 右侧绝对居中对齐 Lucide `CalendarIcon`（距右边缘固定 10px）。
  - 点击触发器平滑弹出阴影日历卡片（`Calendar`），支持按月翻页与直观点击日期选定，选定后自动同步回填。
  - 表单标签（Label）彻底移除 `(YYYY-MM-DD)` 繁琐冗余文本。

#### 2.1.3 `Checkbox` 控件（基于 shadcn 官方 `checkbox.tsx`）
- **交互契约**：
  - 统一尺寸 `w-4 h-4`，平滑圆角 `rounded`，高对比度边框。
  - 选中态呈现带有 Check 矢量图标的翠绿色高亮动效（`data-[state=checked]:bg-emerald-600`）。
  - 支持 Label 整行文字点击联动切换，扩大触控命中区域。

#### 2.1.4 `RadioGroup` 控件（基于 shadcn 官方 `radio-group.tsx`）
- **交互契约**：
  - 采用标准 Radix 单选组原语，支持键盘方向键无缝切换选项。
  - 支持状态色彩分级（复核通过为翡翠绿 `emerald-600`，驳回退回为警示红 `red-600`）。
  - 支持点击整行文字切换选项。

#### 2.1.5 `Dialog` 模态弹窗（基于 shadcn 官方 `dialog.tsx`）
- **交互契约**：
  - 严禁出现特殊字符 `✕` 或 `×`。
  - 统一使用 Dialog 内置的标准矢量 `<X className="w-4 h-4" />` 关闭控件，悬浮时呈现微背景底色反馈。
  - 弹窗呼出与关闭具备平滑的淡入淡出（Fade-in / Fade-out）动效，支持点击背景遮罩层与按 Esc 键关闭。

---

### 2.2 业务落地场景需求（9 个组件）

1. **分派线索责任人弹窗 (`dispatch-dialog.tsx`)**：
   - 弹窗外壳升级为 shadcn `Dialog`。
   - 承办责任部门、承办责任人员下拉框升级为 shadcn `Select`。
   - 要求办理期限输入框升级为 shadcn `DatePicker`，移除 Label 冗余 `(YYYY-MM-DD)` 提示。
   - 负责人复核选项升级为 shadcn `Checkbox`。
2. **综合筛选工具栏 (`filter-bar.tsx`)**：
   - 所属区域、线索类型、风险等级、办理状态、异常预警特征 5 个筛选下拉框全部升级为 shadcn `Select`，彻底根除粗糙系统原生下拉。
3. **现场核查与处置登记表单 (`handling-form.tsx`)**：
   - 核查调查日期升级为 shadcn `DatePicker`。
4. **线索办理结果终审复核弹窗 (`review-dialog.tsx`)**：
   - 弹窗外壳升级为 shadcn `Dialog`。
   - 复核裁决单选升级为 shadcn `RadioGroup`（通过为绿色、驳回为红色）。
5. **台账导入弹窗 (`import-modal.tsx`)**：
   - 弹窗外壳升级为 shadcn `Dialog`，消除文本字符 `✕`。
6. **工作台分页控制栏 (`clues-workbench.tsx`)**：
   - 每页显示条数升级为紧凑型 shadcn `Select`（`h-8`）。
7. **顶部角色快速切换器 (`role-switcher.tsx`)**：
   - 角色切换下拉框升级为紧凑型 shadcn `Select`（`h-8`）。
8. **处置建议卡片 (`advisory-card.tsx`)**：
   - 建议已核实采纳复选框升级为 shadcn `Checkbox`。
9. **全局样式层 (`globals.css`)**：
   - 完善 shadcn/ui 组件所需的 CSS 变量与动画工具类兼容性。

---

## 三、EARS 格式验收标准 (Acceptance Criteria)

- **[EARS-FC-001 事件驱动型]**：When 用户在任何表单或工具栏中点击 `Select` 组件时，the 系统 shall 展开带有阴影与平滑动效的 shadcn 浮动面板，且选中项呈现 Check 矢量图标，严禁出现浏览器或操作系统原生弹层。
- **[EARS-FC-002 事件驱动型]**：When 用户在分派弹窗或现场核查表单中操作 `DatePicker` 时，the 系统 shall 弹出带阴影与动画的日历卡片浮层，选定日期后自动回填，且输入框右侧固定居中对齐 Calendar 矢量图标。
- **[EARS-FC-003 常驻型]**：The 表单组件 shall 彻底移除任何表单 Label 后的 `(YYYY-MM-DD)` 硬编码格式文本，保持业务语义整洁。
- **[EARS-FC-004 常驻型]**：The 模态弹窗 shall 100% 使用 shadcn Dialog 自带的标准矢量 `<X />` 关闭控件与平滑遮罩层，严禁使用 `✕`、`×` 等纯文本特殊符号。
- **[EARS-FC-005 状态驱动型]**：While 用户处于深色主题（Dark Mode）下，the 所有重构后的 shadcn 表单控件与浮层 shall 保持高对比度边框（`border-slate-700`）与暗色背景（`bg-slate-900`），严禁出现操作系统原生纯白高亮弹层。
- **[EARS-FC-006 异常行为型]**：If 表单控件处于 `disabled` 状态，the 系统 shall 呈现 `opacity-50` 并禁用鼠标手势（`cursor-not-allowed`），且禁用态不触发任何事件流转。
- **[EARS-FC-007 事件驱动型]**：When 用户点击复选框整行文本或单选框整行文本时，the 系统 shall 切换勾选状态，且响应热区覆盖整行文本区域。
- **[EARS-FC-008 常驻型]**：The 重构后所有表单控件 shall 严格保持原有业务逻辑（`value`、`onChange`、`onSubmit`）兼容性，严禁破坏既有 Server Action 提交逻辑与全量自动化测试。

---

## 四、范围边界说明 (Boundary Commitments)

- **包含边界**：
  - 引入 shadcn 官方 `select`, `checkbox`, `radio-group`, `dialog`, `popover`, `calendar`。
  - 封装统一的 `src/components/ui/date-picker.tsx`。
  - 全工程 9 个业务组件的全量升级替换。
- **排除边界**：
  - 严禁变更后端的表单提交校验逻辑、Server Actions 契约或 Drizzle 表结构。
  - 严禁破坏现有自动化回归测试套件。
