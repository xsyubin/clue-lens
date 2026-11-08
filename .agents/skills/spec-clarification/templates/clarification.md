# {{FEATURE_NAME}}需求澄清清单

> 本文档轻量记录经需求方确认的业务口径，作为后续技术需求细化与正式需求编写的输入。
> 最后确认时间：{{CONFIRMED_AT}}

## 一、背景与目标

- **目标用户**：{{TARGET_USERS}}
- **当前痛点**：{{CURRENT_PAIN_POINTS}}
- **预期价值**：{{EXPECTED_VALUE}}
- **成功表现**：{{SUCCESS_OUTCOMES}}

## 二、已确认的范围边界

| 维度 | 已确认结论 |
| --- | --- |
| 产品定位 | {{PRODUCT_POSITIONING}} |
| 范围内 | {{IN_SCOPE}} |
| 范围外 | {{OUT_OF_SCOPE}} |
| 相邻系统职责 | {{ADJACENT_RESPONSIBILITIES}} |
| 本期与后续 | {{PHASING}} |

## 三、用户角色与权限

| 角色 | 主要目标 | 允许操作 | 数据可见范围 | 明确限制 |
| --- | --- | --- | --- | --- |
| {{ROLE}} | {{ROLE_GOAL}} | {{ALLOWED_ACTIONS}} | {{DATA_SCOPE}} | {{RESTRICTIONS}} |

## 四、核心业务流程

### 1. {{FLOW_NAME}}

1. **触发条件**：{{TRIGGER}}
2. **前置条件**：{{PRECONDITIONS}}
3. **主要步骤**：{{MAIN_STEPS}}
4. **完成状态**：{{COMPLETION_STATE}}
5. **失败或取消**：{{FAILURE_OR_CANCEL}}

## 五、功能与业务规则

### 1. {{CAPABILITY_NAME}}

- **用户行为**：{{USER_BEHAVIOR}}
- **系统结果**：{{SYSTEM_OUTCOME}}
- **业务规则**：{{BUSINESS_RULES}}
- **边界情况**：{{EDGE_CASES}}

## 六、数据与业务口径

| 数据或指标 | 来源 | 业务定义 | 更新时效 | 限制 |
| --- | --- | --- | --- | --- |
| {{DATA_ITEM}} | {{SOURCE}} | {{BUSINESS_DEFINITION}} | {{FRESHNESS}} | {{LIMITS}} |

## 七、输入与输出

- **输入方式**：{{INPUTS}}
- **输出形态**：{{OUTPUTS}}
- **查询、筛选或排序**：{{QUERY_BEHAVIOR}}
- **导入、导出或打印**：{{IMPORT_EXPORT_PRINT}}

## 八、异常与非功能约束

- **空数据与无结果**：{{EMPTY_STATE}}
- **无权限**：{{UNAUTHORIZED_STATE}}
- **重复或冲突**：{{CONFLICT_HANDLING}}
- **失败与重试**：{{FAILURE_RETRY}}
- **容量与性能**：{{CAPACITY_PERFORMANCE}}
- **安全、审计与合规**：{{SECURITY_AUDIT_COMPLIANCE}}

## 九、开放问题与推迟项

| 状态 | 问题或事项 | 影响 | 责任人/后续阶段 |
| --- | --- | --- | --- |
| 开放/阻塞/已推迟 | {{OPEN_ITEM}} | {{IMPACT}} | {{OWNER_OR_PHASE}} |

> 无开放问题时写“无”，不要保留空白占位。

## 十、变更记录

| 日期 | 原口径 | 新口径 | 变更原因 | 影响范围 |
| --- | --- | --- | --- | --- |
| {{DATE}} | {{OLD_DECISION}} | {{NEW_DECISION}} | {{REASON}} | {{IMPACT_SCOPE}} |

> 首次生成且无历史变更时写“无”。

## 十一、设计阶段输入

以下内容不是需求结论，仅作为后续技术设计需要核验的输入：

- {{DESIGN_INPUT}}

## 十二、确认结论

- **确认范围**：{{CONFIRMED_SCOPE}}
- **确认人/确认方式**：{{CONFIRMATION_SOURCE}}
- **是否可进入正式需求细化阶段**：是 / 否
- **阻塞说明**：{{BLOCKING_REASON}}
