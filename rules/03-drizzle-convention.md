---
description: "Drizzle ORM 规约：Schema 规范、推导类型、查询规约、事务处理与迁移工作流"
globs: "src/db/**/*.ts,drizzle.config.ts"
alwaysApply: true
---

# Drizzle ORM 使用规约

## 1. Schema 定义与类型推导

每个表定义完成后，必须导出对应的 TypeScript 查询类型（Select）与插入类型（Insert）：

```typescript
export const clues = sqliteTable("clues", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// 强制导出推导类型
export type Clue = typeof clues.$inferSelect;
export type NewClue = typeof clues.$inferInsert;
```

## 2. 数据查询与操作规约

### 2.1 推荐模式：Query Builder
- 使用 Drizzle 强类型查询构造器：
  ```typescript
  const rows = await db
    .select()
    .from(clues)
    .where(and(eq(clues.userId, session.user.id), eq(clues.status, "in_progress")))
    .orderBy(desc(clues.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  ```
- **严禁使用未参数化的字符串拼接 SQL**。

### 2.2 事务处理
- 多表联动变更（如创建线索同时写入第一条跟进记录与操作审计日志）必须包装在 `db.transaction()` 中执行：
  ```typescript
  await db.transaction(async (tx) => {
    await tx.insert(clues).values(clueData);
    await tx.insert(clueFollowUps).values(followUpData);
  });
  ```

## 3. 模式演进与迁移工作流 (Migration Workflow)

1. **本地快速开发阶段:**
   - 修改 `src/db/schema.ts` 后，执行 `npm run db:push` 直接同步到本地 SQLite。
2. **正式发布与版本归档阶段:**
   - 执行 `npm run db:generate` 生成标准 SQL 迁移文件至 `./drizzle/`。
   - 执行 `npm run db:migrate` 执行迁移脚本，确保数据库模式演进具备确定性与版本可追溯性。
3. **数据调试与检查:**
   - 使用 `npm run db:studio` 启动可视化的 Drizzle Studio 检查表结构与记录。
