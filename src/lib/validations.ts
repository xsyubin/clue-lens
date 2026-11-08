import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("请输入有效的邮箱地址"),
  password: z.string().min(8, "密码至少 8 位"),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1, "请输入姓名").max(50, "姓名不能超过 50 个字符"),
});

export const todoTitleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "请输入待办内容")
    .max(200, "待办内容不能超过 200 个字符"),
});

export const todoIdSchema = z.object({
  id: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
