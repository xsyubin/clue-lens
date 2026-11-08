import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/session";
import { RoleProvider, RoleSwitcher } from "@/components/role-switcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <RoleProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-base shadow">
                  专
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">
                    专卖监管线索闭环系统
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    clue-lens · 智能分析与流转平台
                  </div>
                </div>
              </Link>

              <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  态势大盘
                </Link>
                <Link
                  href="/clues"
                  className="px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  线索工作台
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <RoleSwitcher />
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden md:inline">
                  {session.user.name}
                </span>
                <SignOutButton />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </RoleProvider>
  );
}
