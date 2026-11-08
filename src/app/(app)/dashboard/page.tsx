import { desc, eq } from "drizzle-orm";
import { deleteTodo, toggleTodo } from "@/app/actions/todos";
import { AddTodoForm } from "@/components/add-todo-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();

  const items = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, session.user.id))
    .orderBy(desc(todos.createdAt));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">我的待办</CardTitle>
        <CardDescription>
          示例页面：展示 Server Actions、Drizzle 查询和 Zod 校验的写法
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <AddTodoForm />

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            还没有待办，在上面输入内容并点击“添加”。
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {items.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <form action={toggleTodo} className="flex-1">
                  <input type="hidden" name="id" value={todo.id} />
                  <button
                    type="submit"
                    className={cn(
                      "w-full text-left text-sm",
                      todo.done && "text-muted-foreground line-through",
                    )}
                  >
                    {todo.title}
                  </button>
                </form>
                <form action={deleteTodo}>
                  <input type="hidden" name="id" value={todo.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    删除
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
