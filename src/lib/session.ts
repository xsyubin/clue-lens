import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  image?: string | null;
}

export interface AppSession {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

/** 同一次请求内多次调用只会查询一次 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  if (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "true") {
    const mockRole = process.env.TEST_USER_ROLE || "综合管理人员";
    const mockDept = process.env.TEST_USER_DEPT || "综合办公室";
    const mockUserId = process.env.TEST_USER_ID || "test-user-id";
    const mockName = process.env.TEST_USER_NAME || "测试综合管理员";
    return {
      user: {
        id: mockUserId,
        name: mockName,
        email: "admin@test.local",
        role: mockRole,
        department: mockDept,
      },
      session: {
        id: "test-session-id",
        userId: mockUserId,
        expiresAt: new Date(Date.now() + 86400000),
      },
    };
  }

  try {
    const h = await headers();
    const sessionRes = await auth.api.getSession({ headers: h });
    if (!sessionRes || !sessionRes.user) return null;

    // 从数据库查询权威的 role 和 department，防止会话缓存偏差或篡改
    const dbUser = db
      .select({
        role: user.role,
        department: user.department,
      })
      .from(user)
      .where(eq(user.id, sessionRes.user.id))
      .get();

    return {
      ...sessionRes,
      user: {
        ...sessionRes.user,
        role: dbUser?.role || "综合管理人员",
        department: dbUser?.department || null,
      },
    };
  } catch {
    return null;
  }
});

/** 未登录则跳转登录页，已登录返回 session */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
