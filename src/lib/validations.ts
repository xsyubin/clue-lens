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

/**
 * 通用基础线索输入校验规则 (基础 CRM 示例模块)
 */
export const clueInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "请输入线索标题")
    .max(100, "标题不能超过 100 个字符"),
  customerName: z
    .string()
    .trim()
    .min(1, "请输入客户姓名")
    .max(50, "客户姓名不能超过 50 个字符"),
  customerPhone: z
    .string()
    .trim()
    .min(1, "请输入客户联系方式")
    .max(20, "联系方式不能超过 20 个字符"),
  customerCompany: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ClueInput = z.infer<typeof clueInputSchema>;
