import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** 同一次请求内多次调用只会查询一次 */
export const getSession = cache(async () => {
  if (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "true") {
    return {
      user: {
        id: "test-user-id",
        name: "测试综合管理员",
        email: "admin@test.local",
        role: "综合管理人员",
      },
      session: {
        id: "test-session-id",
        userId: "test-user-id",
        expiresAt: new Date(Date.now() + 86400000),
      },
    };
  }

  try {
    const h = await headers();
    return await auth.api.getSession({ headers: h });
  } catch {
    return null;
  }
});

/** 未登录则跳转登录页，已登录返回 session */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
