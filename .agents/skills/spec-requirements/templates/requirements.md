# 需求文档

## 引言
{{INTRODUCTION}}

<!-- 可选:当范围可能被误读,或特性涉及相邻系统/规格时填写 -->
## 边界上下文(可选)
- **范围内**:{{IN_SCOPE_BEHAVIORS}}
- **范围外**:{{OUT_OF_SCOPE_BEHAVIORS}}
- **相邻预期**:{{ADJACENT_SYSTEM_OR_SPEC_EXPECTATIONS}}

## 原型与现有系统一致性

| 检查项 | 澄清口径 | 原型/页面表现 | 现有系统约束或复用 | 结论 |
| --- | --- | --- | --- | --- |
| {{ENTRY_FIELD_ACTION_FLOW}} | {{CLARIFIED_EXPECTATION}} | {{PROTOTYPE_BEHAVIOR}} | {{EXISTING_SYSTEM_PATTERN}} | {{ALIGNED_OR_CONFIRMED_DECISION}} |

> 没有原型或存量实现时说明输入缺失及影响；不要编造页面或系统能力。

## 业务需求

### 需求 1:{{REQUIREMENT_AREA_1}}
<!-- 需求标题必须以数字 ID 开头(例如:"需求 1:……"、"1. 概述"、"2 功能:……")。禁止使用字母 ID(如"需求 A")。 -->
**目标:** 作为{{ROLE}},我希望{{CAPABILITY}},从而{{BENEFIT}}

#### 验收标准
1. When [事件], the [系统] shall [响应/动作]
2. If [触发条件], then the [系统] shall [响应/动作]
3. While [前置状态], the [系统] shall [响应/动作]
4. Where [包含某特性], the [系统] shall [响应/动作]
5. The [系统] shall [响应/动作]

### 需求 2:{{REQUIREMENT_AREA_2}}
**目标:** 作为{{ROLE}},我希望{{CAPABILITY}},从而{{BENEFIT}}

#### 验收标准
1. When [事件], the [系统] shall [响应/动作]
2. When [事件] and [条件], the [系统] shall [响应/动作]

<!-- 其余需求遵循同样的模式 -->

## 页面需求（涉及页面时）

| 页面/区域 | 入口 | 展示与字段 | 查询/操作 | 校验与反馈 | 权限 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- |
| {{PAGE}} | {{ENTRY}} | {{FIELDS}} | {{ACTIONS}} | {{VALIDATION_FEEDBACK}} | {{PERMISSION}} | {{REQUIREMENT_IDS}} |

## 接口需求（涉及接口时）

| 接口用途 | 调用方 | 关键输入 | 关键输出 | 错误语义/约束 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| {{API_PURPOSE}} | {{CALLER}} | {{KEY_INPUT}} | {{KEY_OUTPUT}} | {{ERROR_SEMANTICS}} | {{REQUIREMENT_IDS}} |

> 本节描述业务契约，不设计 URL、DTO 类、序列化格式或实现代码。

## 权限需求（涉及权限时）

| 角色 | 功能/按钮权限 | 数据范围 | 越权结果 | 关联需求 |
| --- | --- | --- | --- | --- |
| {{ROLE}} | {{FUNCTION_PERMISSION}} | {{DATA_SCOPE}} | {{DENIED_BEHAVIOR}} | {{REQUIREMENT_IDS}} |

## 流程与状态需求（涉及流程时）

| 当前状态 | 角色/动作 | 前置条件 | 目标状态 | 失败、撤回或驳回 | 关联需求 |
| --- | --- | --- | --- | --- | --- |
| {{CURRENT_STATE}} | {{ROLE_ACTION}} | {{PRECONDITION}} | {{TARGET_STATE}} | {{EXCEPTION_PATH}} | {{REQUIREMENT_IDS}} |

## 非功能需求（按需）

- {{PERFORMANCE_SECURITY_COMPATIBILITY_AUDIT_REQUIREMENT}}

## 需求完整性结论

- **用户可见口径**：页面、接口、权限、流程、异常和验收行为均已明确。
- **阻塞项**：无。
- **设计阶段项**：{{仅列数据库、类、组件、文件、算法或基础设施等内部实现事项；无则写“无”。}}

> 只要仍存在会影响用户行为、页面结果、接口业务契约、权限、流程或验收结果的未决事项，就不得生成本正式文档。不得使用“后续设计确认”或“开发时确定”掩盖需求缺口。
