---
description: "安全与认证规范：Better Auth 配置、会话守卫、敏感数据脱敏与密钥治理"
globs: "src/lib/auth*.ts,src/lib/session.ts,src/lib/validations.ts"
alwaysApply: true
---

# 安全与认证规范 (clue-lens)

## 1. 认证方案与会话安全 (Better Auth)

- **核心插件:** `src/lib/auth.ts` 中必须包含 `plugins: [nextCookies()]`，确保 Server Action 执行过程中能正确回写 Set-Cookie 响应头。
- **密码要求:** 
  - 最短密码长度设定为 8 位 (`minPasswordLength: 8`)。
  - Zod 验证中配套 `z.string().min(8, "密码至少 8 位")`。
- **会话读取与去重:**
  - 服务端使用 `getSession = cache(...)` 实现单次 HTTP 请求内会话查询自动记忆（Request Memoization），避免 Layout、Page、Components 多次重复打库。

## 2. 敏感数据脱敏规约

客户手机号、证件号等个人隐私数据在列表渲染与日志输出时必须脱敏：
- 手机号规范脱敏算法：前 3 位与后 4 位明文，中间 4 位用 `****` 替代（如 `138****1234`）。
- 严禁在任何 API 接口中直接将用户密码哈希字段（`account.password`）暴露给前端。

## 3. 环境变量与安全密钥治理

- **禁止提交生产凭据:**
  - `.env` 必须在 `.gitignore` 中被显式忽略。
  - 项目提供 `.env.example`，其中的默认占位符必须通过 `./scripts/setup.mjs` 在初始化时使用安全伪随机数替换：
    ```javascript
    randomBytes(32).toString("hex")
    ```
- **域名约束:**
  - 生产环境部署时必须正确配置 `BETTER_AUTH_URL` 为 HTTPS 真实域名，避免跨站 Cookie 劫持。
