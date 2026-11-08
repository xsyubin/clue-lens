---
description: "Server Actions 规约：鉴权门禁、状态机守卫、Zod 校验、错误格式与事务留痕"
globs: "src/app/actions/**/*.ts"
alwaysApply: true
---

# Server Actions 研发规约

## 1. 结构与文件定位
- 所有的服务端动作函数统一存放在 `src/app/actions/` 目录下（如 `clues.ts`, `todos.ts`）。
- 文件顶部必须显式声明 `"use server"`。

## 2. 核心研发形态与执行规范

在本项目中，Server Actions 规范支持两种标准形态，严禁未经鉴权与校验直接操作数据库：

### 2.1 形态 A: Typed RPC-Style Actions（首选：复杂业务弹窗、协同流转与查询）
适用于弹窗对话框（Dialog）、多维筛选大盘与导出场景。前端组件直接以异步函数形式调用，入参为任意结构，通过 Zod safeParse 构筑输入防卫：

```typescript
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monopolyClues, clueTimelineLogs, systemAuditLogs } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { dispatchClueSchema } from "@/lib/validations/clue";

export async function dispatchClueAction(input: unknown) {
  try {
    // 1. 鉴权门禁：会话守卫，未登录阻断
    const session = await requireSession();

    // 2. 输入防御：Zod safeParse 解析，严禁信任客户端入参
    const parsed = dispatchClueSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "入参校验失败" };
    }
    const { clueId, department, handler, deadline, needReview, operatorRole } = parsed.data;

    // 3. 业务规则校验：如办理时限防卫
    const today = new Date().toISOString().split("T")[0]!;
    if (deadline < today) {
      return { ok: false, error: "办理期限不得早于当前系统日期" };
    }

    // 4. 事务与状态机守卫
    return db.transaction((tx) => {
      const existing = tx.select().from(monopolyClues).where(eq(monopolyClues.id, clueId)).get();
      if (!existing) return { ok: false, error: "线索不存在" };

      // 状态机前置守卫：仅待分派状态允许执行分派
      if (existing.status !== "PENDING_ASSIGN") {
        return { ok: false, error: `状态机守卫拦截：当前状态为【${existing.status}】，仅允许在【待分派】下分派` };
      }

      // 4.1 更新主表
      tx.update(monopolyClues)
        .set({ department, handler, deadline, needReview, status: "IN_PROGRESS", updatedAt: new Date() })
        .where(eq(monopolyClues.id, clueId))
        .run();

      // 4.2 写入时间轴流水
      tx.insert(clueTimelineLogs).values({
        clueId,
        operatorRole,
        operatorName: session.user.name,
        action: "DISPATCH",
        fromStatus: "PENDING_ASSIGN",
        toStatus: "IN_PROGRESS",
        comment: `分派至【${department} - ${handler}】`,
      }).run();

      // 4.3 写入系统安全审计
      tx.insert(systemAuditLogs).values({
        traceId: crypto.randomUUID(),
        operatorRole,
        operatorId: session.user.id,
        action: "CLUE_DISPATCH",
        targetId: clueId,
      }).run();

      // 5. 缓存失效与返回
      revalidatePath("/clues");
      return { ok: true };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "分派失败";
    return { ok: false, error: msg };
  }
}
```

### 2.2 形态 B: Form-Style Actions（用于原生表单与 `useActionState` 绑定）
适用于基础单一表单提交（如快速新增待办、登录），函数签名遵循 React 19 规范：

```typescript
export type ActionState = { error?: string; ok?: boolean };

export async function addTodo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = todoTitleSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await db.insert(todos).values({
    userId: session.user.id,
    title: parsed.data.title,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
```

## 3. 统一返回结构与异常防卫
- 严禁向前端抛出未经捕获的原始 Error 堆栈（防止泄漏物理表名、SQL 片段或底层系统路径）。
- 返回值遵循统一对象模式：
  ```typescript
  export type ActionResult<T = unknown> = {
    ok: boolean;
    error?: string;
    data?: T;
  };
  ```

## 4. 权限与流转防卫铁律

1. **个人私有数据（数据隔离）：**
   - 个人待办等无流转私有资源，必须双重锁定条件：`and(eq(todos.id, id), eq(todos.userId, session.user.id))`。
2. **政企协作监管数据（流转协同）：**
   - 跨部门线索（`monopoly_clues`）禁止教条化比对 `userId`，而必须执行：
     - **角色准入（Role Guard）:** 如审批复核与结案归档必须验证 `operatorRole === "部门负责人"`。
     - **状态机守卫（State Guard）:** 必须先从库中读取当前记录，比对当前状态是否满足流转前置条件，拒绝越级跳跃或逆向流转。
     - **全程审计（Audit Guard）:** 全生命周期流转必须保证时间轴流水（`clue_timeline_logs`）与安全审计（`system_audit_logs`）完整落地。
