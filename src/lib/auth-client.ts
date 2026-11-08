import { createAuthClient } from "better-auth/react";

// 不传 baseURL 时默认使用当前页面的 origin
export const authClient = createAuthClient();
