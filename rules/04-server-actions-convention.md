---
description: "Server Actions 规约：鉴权门禁、租户隔离、Zod 校验、错误格式与缓存失效"
globs: "src/app/actions/**/*.ts"
alwaysApply: true
---

# Server Actions 研发规约

## 1. 结构与文件定位
- 所有的服务端动作函数统一存放在 `src/app/actions/` 目录下（如 `todos.ts`, `clues.ts`）。
- 文件顶部必须显式声明 `"use server"`。

## 2. 核心执行四部曲

每个 Server Action 的内部逻辑必须严格按以下顺序执行：

```typescript
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clues } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { clueInputSchema } from "@/lib/validations";

export type ActionState = { error?: string; ok?: boolean; data?: any };

export async function createClue(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. 鉴权门禁：未登录直接阻断重定向
  const session = await requireSession();

  // 2. 输入防御：Zod 安全解析，绝不直接将 formData 喂给数据库
  const parsed = clueInputSchema.safeParse({
    title: formData.get("title"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // 3. 业务操作：强制显式绑定 session.user.id
  await db.insert(clues).values({
    ...parsed.data,
    userId: session.user.id,
  });

  // 4. 缓存失效：刷新相关页面路由
  revalidatePath("/dashboard");
  return { ok: true };
}
```

## 3. 统一返回类型与异常处理
- 严禁向前端抛出未经捕获的原始 Error 堆栈（防止泄漏内部表名、SQL 或文件路径）。
- 返回值推荐遵循统一结构：
  ```typescript
  export type ActionState = {
    ok?: boolean;
    error?: string;
    fieldErrors?: Record<string, string>;
  };
  ```

## 4. 租户隔离铁律
- 更新或删除操作必须双重锁定条件：
  ```typescript
  // 正确：同时比对主键 ID 与操作人所属 userId
  await db
    .delete(clues)
    .where(and(eq(clues.id, clueId), eq(clues.userId, session.user.id)));
  
  // 严厉禁止：仅凭 id 删除，造成越权越界漏洞！
  // await db.delete(clues).where(eq(clues.id, clueId)); // 违规
  ```
