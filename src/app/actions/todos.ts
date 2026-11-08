"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { todoIdSchema, todoTitleSchema } from "@/lib/validations";

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

  await db
    .insert(todos)
    .values({ userId: session.user.id, title: parsed.data.title });

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleTodo(formData: FormData): Promise<void> {
  const session = await requireSession();

  const parsed = todoIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const [row] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, parsed.data.id), eq(todos.userId, session.user.id)));
  if (!row) return;

  await db
    .update(todos)
    .set({ done: !row.done })
    .where(and(eq(todos.id, row.id), eq(todos.userId, session.user.id)));

  revalidatePath("/dashboard");
}

export async function deleteTodo(formData: FormData): Promise<void> {
  const session = await requireSession();

  const parsed = todoIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  await db
    .delete(todos)
    .where(and(eq(todos.id, parsed.data.id), eq(todos.userId, session.user.id)));

  revalidatePath("/dashboard");
}
