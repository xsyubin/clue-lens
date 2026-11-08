import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 手机号/联系方式敏感信息掩码脱敏
 * 规约：标准 11 位手机号保留前 3 位和后 4 位，中间 4 位用 **** 替代（如 138****0000）
 * 异常长度或非法格式进行安全兜底掩码，杜绝明文泄露
 */
export function maskMobile(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(7)}`;
  }
  if (cleaned.length > 7) {
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-4)}`;
  }
  if (cleaned.length >= 4) {
    return `${cleaned.slice(0, 2)}**${cleaned.slice(-2)}`;
  }
  return "***";
}
