---
description: "数据库设计规范：SQLite 字段命名、主键策略、索引规约与 WAL 并发"
globs: "src/db/**/*.ts,drizzle.config.ts"
alwaysApply: true
---

# SQLite & Drizzle 数据库设计规范

## 1. 主键策略
- 默认采用 UUIDv4 字符串作为主键：
  - Drizzle 字段定义：`text("id").primaryKey().$defaultFn(() => crypto.randomUUID())`
  - 保证客户端/服务端分布式生成无冲突，避免自增数字 ID 暴露系统数据体量。

## 2. 字段与表命名规约
- **表名与数据库列名:** 一律使用 **snake_case**（小写字母 + 下划线）。
  - 例：`user_id`, `clue_no`, `discovery_date`, `risk_level`, `operator_role`。
- **TypeScript 属性名:** 一律使用 **camelCase**（小驼峰）。
  - 例：`userId: text("user_id")`, `clueNo: text("clue_no")`, `createdAt: integer("created_at")`。
- **表名约定:**
  - 核心专卖监管实体表：采用实体全称及复数（`monopoly_clues`, `clue_timeline_logs`, `system_audit_logs`, `clue_mcp_audit_log`）。
  - 基础认证与示例表：遵循 Better Auth 标准名（`user`, `session`, `account`, `verification`）与基础模块（`todos`, `clues`, `clue_follow_ups`）。

## 3. 标准审计与时间/日期字段

### 3.1 系统审计时间戳 (Integer Timestamp)
所有核心业务主表必须包含统一的创建与更新时间审计字段：

```typescript
createdAt: integer("created_at", { mode: "timestamp" })
  .notNull()
  .$defaultFn(() => new Date()),
updatedAt: integer("updated_at", { mode: "timestamp" })
  .notNull()
  .$defaultFn(() => new Date()),
```
- SQLite 中时间审计字段统一使用整型时间戳模式（`{ mode: "timestamp" }`），保证物理排序高效。数据变更时在 Server Actions 中显式赋值 `updatedAt: new Date()`。

### 3.2 业务日期规约 (Text "YYYY-MM-DD")
- 涉及案发发现日期、办理时限、现场核查日期等业务日期字段（如 `discoveryDate`, `deadline`, `checkDate`），统一采用 ISO 8601 标准日期文本模式（`text` 字段，格式 `YYYY-MM-DD`）。
- 确保 Excel 批量导入导出、跨时区计算及前端日历选择器对齐零误差。

## 4. 外键约束与级联删除

- 业务主表关联用户表必须显式声明级联删除：
  ```typescript
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ```
- 流转从表（如 `clue_timeline_logs` 关联 `monopoly_clues`）必须在删除主记录时级联清理，杜绝产生孤儿悬空记录：
  ```typescript
  clueId: text("clue_id")
    .notNull()
    .references(() => monopolyClues.id, { onDelete: "cascade" }),
  ```

## 5. 索引规划规约

- **高频外键索引（强制）:** 所有高频外键（如 `userId`、`clueId`）必须显式建立单列索引，避免联表查询全表扫描：
  ```typescript
  (t) => [
    index("idx_clues_user_id").on(t.userId),
    index("idx_timeline_clue_id").on(t.clueId),
  ]
  ```
- **业务检索与过滤维度索引:**
  - 唯一性业务编号（如专卖线索编号 `clueNo`）必须声明 `.unique()` 并建立索引 `index("idx_clues_clue_no").on(t.clueNo)`。
  - 高频过滤与统计维度必须建立索引：`region`（辖区）、`status`（状态机）、`type`（违法案由）、`targetName`（经营对象）、`discoveryDate`（发现日期）。

## 6. WAL 模式与存储引擎配置
- 必须在创建连接时激活 `sqlite.pragma("journal_mode = WAL")` 和 `sqlite.pragma("foreign_keys = ON")`。
- 严禁关闭外键约束执行任意业务写操作。
