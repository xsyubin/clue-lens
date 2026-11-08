import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">My App</h1>
      <p className="text-muted-foreground">
        Next.js、Drizzle、SQLite、Better Auth、Tailwind、shadcn/ui 和 Zod
        已经接好，登录后就能使用示例待办清单。
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">登录</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/register">注册</Link>
        </Button>
      </div>
    </main>
  );
}
