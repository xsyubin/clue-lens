# 实现计划

- **任务清单级别**：轻量 / 标准 / 深度
- **判定依据**：{{DESIGN_LEVEL_AND_REASON}}

## 任务格式模板

按工作拆解的实际情况选用合适的模式:

### 轻量任务（普通 CRUD、表单、列表优先）
- [ ] {{NUMBER}}. {{TASK_DESCRIPTION}}{{PARALLEL_MARK}}
  - {{FILES_OR_RESPONSIBILITIES}} *(写主要页面、接口、Service、Mapper 或数据库职责；不必逐文件拆任务。)*
  - {{OBSERVABLE_COMPLETION_ITEM}}
  - _Requirements: {{REQUIREMENT_IDS}}_

### 标准/深度任务（存在流程、权限、事务或复杂集成时）
- [ ] {{MAJOR_NUMBER}}. {{MAJOR_TASK_SUMMARY}}
- [ ] {{MAJOR_NUMBER}}.{{SUB_NUMBER}} {{SUB_TASK_DESCRIPTION}}{{SUB_PARALLEL_MARK}}
  - {{DETAIL_ITEM_1}}
  - {{DETAIL_ITEM_2}}
  - {{OBSERVABLE_COMPLETION_ITEM}} *(至少一条细节要点写明本任务可观察的完成条件。)*
  - _Requirements: {{REQUIREMENT_IDS}}_ *(只写 ID;不加描述或括号。)*
  - _Boundary: {{COMPONENT_NAMES}}_ *(仅 (P) 任务必填。范围显而易见时可省略。)*
  - _Depends: {{TASK_IDS}}_ *(仅用于不明显的跨边界依赖。多数任务省略。)*

#### 标准/深度集成与验证收尾任务（包含 GWT 黄金验收场景）
- [ ] {{VERIFY_MAJOR_NUMBER}}.{{SUB_NUMBER}} 端到端核心业务闭环与异常防御集成验证{{SUB_PARALLEL_MARK}}
  - {{INTEGRATION_SUMMARY}}
  - _Requirements: {{REQUIREMENT_IDS}}_
  - **GWT 场景 1【正向黄金流转闭环】**:
    - **Given**: {{GIVEN_INITIAL_STATE_AND_ROLE}}
    - **When**: {{WHEN_USER_ACTION_OR_SUBMIT}}
    - **Then**: {{THEN_EXPECTED_TRANSITION_AND_STATE}}
      **And**: {{AND_ADDITIONAL_ASSERTIONS_OR_LOGS}}
  - **GWT 场景 2【逆向驳回/异常拦截防御】**:
    - **Given**: {{GIVEN_EDGE_OR_ABNORMAL_STATE}}
    - **When**: {{WHEN_INVALID_ACTION_OR_REJECTION}}
    - **Then**: {{THEN_REJECTED_OR_ROLLBACK}}
      **And**: {{AND_AUDIT_LOG_RECORDED}}

> **并行标记**:仅对可并行执行的任务在末尾追加 ` (P)`。`--sequential` 模式下全部省略。
>
> **可选测试覆盖**:当子任务是可推迟的、绑定验收标准的测试工作时,复选框写成 `- [ ]*`,并在细节要点中说明所引用的需求。
