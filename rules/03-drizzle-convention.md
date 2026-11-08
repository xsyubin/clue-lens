---
description: "Drizzle ORM 规约：Schema 规范、推导类型、查询规约、事务处理与迁移工作流"
globs: "src/db/**/*.ts,drizzle.config.ts"
alwaysApply: true
---

# Drizzle ORM 使用规约

## 1. Schema 定义与类型推导

每个实体表定义完成后，必须对外导出对应的 TypeScript 查询类型（Select）与插入类型（Insert）：

```typescript
export const monopolyClues = sqliteTable(
  "monopoly_clues",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    clueNo: text("clue_no").notNull().unique(),
    discoveryDate: text("discovery_date").notNull(),
    region: text("region").notNull(),
    source: text("source").notNull(),
    type: text("type").notNull(),
    targetName: text("target_name").notNull(),
    status: text("status").notNull().default("PENDING_ASSIGN"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("idx_clues_clue_no").on(t.clueNo),
    index("idx_clues_status").on(t.status),
    index("idx_clues_user_id").on(t.userId),
  ]
);

// 强制导出推导类型
export type MonopolyClue = typeof monopolyClues.$inferSelect;
export type NewMonopolyClue = typeof monopolyClues.$inferInsert;
```

## 2. 数据查询与操作规约

### 2.1 推荐模式：强类型 Query Builder
- 使用 Drizzle 强类型查询构造器，杜绝魔术字符串：
  ```typescript
  const rows = await db
    .select()
    .from(monopolyClues)
    .where(and(eq(monopolyClues.status, "IN_PROGRESS"), eq(monopolyClues.region, "海曙区")))
    .orderBy(desc(monopolyClues.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  ```
- **严禁使用未参数化的字符串拼接 SQL**。如使用 `sql` 模板标签，必须采用参数化插值语法。

### 2.2 事务处理规约
- 专卖监管线索任何涉及状态变迁或处置流转的操作，**必须**包装在 `db.transaction()` 中执行，实现“**主表属性更新 + 时间轴流水日志 (`clue_timeline_logs`) + 系统全局安全审计 (`system_audit_logs`)**”三表原子化提交：
  ```typescript
  await db.transaction((tx) => {
    // 1. 更新主表状态与处置结论
    tx.update(monopolyClues)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(monopolyClues.id, clueId))
      .run();

    // 2. 写入业务流转时间轴
    tx.insert(clueTimelineLogs).values({
      clueId,
      operatorRole,
      operatorName: session.user.name,
      action: "SUBMIT",
      fromStatus: "IN_PROGRESS",
      toStatus: nextStatus,
    }).run();

    // 3. 记录全局系统审计日志
    tx.insert(systemAuditLogs).values({
      traceId: crypto.randomUUID(),
      operatorRole,
      operatorId: session.user.id,
      action: "CLUE_SUBMIT_HANDLING",
      targetId: clueId,
    }).run();
  });
  ```

## 3. 模式演进与迁移工作流 (Migration Workflow)

1. **本地快速开发阶段:**
   - 修改 `src/db/schema.ts` 后，执行 `node scripts/ops/init-db.mjs` 或 `npm run db:push` 同步至本地 SQLite。
2. **正式发布与版本归档阶段:**
   - 执行 `npm run db:generate` 生成标准 SQL 迁移文件至 `./drizzle/`。
   - 执行 `npm run db:migrate` 执行迁移脚本，确保数据库模式演进具备确定性与版本可追溯性。
3. **数据调试与检查:**
   - 使用 `npm run db:studio` 启动可视化的 Drizzle Studio 检查表结构与记录。
