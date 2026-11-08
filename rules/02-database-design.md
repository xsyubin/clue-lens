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
  - 例：`user_id`, `created_at`, `email_verified`, `customer_phone`。
- **TypeScript 属性名:** 一律使用 **camelCase**（小驼峰）。
  - 例：`userId: text("user_id")`, `createdAt: integer("created_at")`。
- **表名复数约定:** 业务表统一采用复数或名词实体全称（如 `todos`, `clues`, `clue_follow_ups`）；Better Auth 核心表保持标准名字（`user`, `session`, `account`, `verification`）。

## 3. 标准审计与时间字段

所有新增的业务主表必须包含统一的时间审计字段：

```typescript
createdAt: integer("created_at", { mode: "timestamp" })
  .notNull()
  .$defaultFn(() => new Date()),
updatedAt: integer("updated_at", { mode: "timestamp" })
  .notNull()
  .$defaultFn(() => new Date())
  .$onUpdate(() => new Date()),
```

- SQLite 中时间推荐使用整型时间戳模式（`{ mode: "timestamp" }`），确保排序高效且时区无关。

## 4. 外键约束与级联删除

- 业务表关联用户表必须显式声明级联删除：
  ```typescript
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ```
- 关联从表（如跟进记录关联线索主表）必须在删除主记录时级联清理，杜绝产生孤儿悬空记录。

## 5. 索引规划规约

- 所有高频外键（如 `userId`、`clueId`）必须显式建立单列或复合索引：
  ```typescript
  (t) => [
    index("clues_user_idx").on(t.userId),
    index("clues_created_at_idx").on(t.createdAt),
  ]
  ```
- 唯一性业务约束（如用户唯一邮箱、第三方绑定）必须声明 `.unique()`。

## 6. WAL 模式与存储引擎配置
- 必须在创建连接时激活 `sqlite.pragma("journal_mode = WAL")` 和 `sqlite.pragma("foreign_keys = ON")`。
- 严禁关闭外键约束执行任意业务写操作。
