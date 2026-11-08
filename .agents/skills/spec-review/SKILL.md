---
name: spec-review
description: AI 辅助代码评审与交付门禁（Reviewer Agent）。对比当前变更（Git Diff）与功能规格（优先使用 spec/<feature>/requirements.md）、项目架构红线（AGENTS.md）及项目级/功能级风险清单，生成结构化《代码健康与安全审计卡》，辅助架构师进行独立终审与责任定界。
---

# AI 辅助代码评审与交付治理 (spec-review)

> 本 Skill 负责 Reviewer Agent 的语义审查。`scripts/deterministic-review.sh`、`scripts/static-security-check.sh` 和 `scripts/secret-scan.sh` 只是确定性前置门禁，不等价于模型审查，也不能替代人工终审。
> B-01～B-06 是本工程线索洞察案例的项目级基线；新增功能应优先以 `spec/<feature>/requirements.md`、`design.md` 和 `tasks.md` 派生本次变更的业务风险清单，不把新业务规则写入通用机器脚本。

以功能规格文件（`spec/<feature>/requirements.md`，本工程对应 `spec/clue-lens/requirements.md`）、架构规则（`AGENTS.md`、`rules/*.md`）为基准，对当前代码变更（Git Diff）进行严格的 AI 辅助初审，输出《代码健康与安全审计卡》，杜绝“只管打字提速、不抓审计责任”。

## 输入

1. **业务规格文件**：
   - 默认：当前变更对应的 `spec/<feature>/requirements.md`；本案例对应 `spec/clue-lens/requirements.md`
2. **架构约束文件**：
   - 项目根目录 `AGENTS.md`
   - `rules/01-project-architecture.md`
   - `rules/04-server-actions-convention.md`
   - `rules/05-coding-style.md`
   - `rules/07-security-and-auth.md`
3. **代码变更内容 (Git Diff)**：
   - 暂存区或指定分支对比：`git diff HEAD~1` 或 `git diff main...HEAD`

## 企业级双级评审准则 (Two-Tier Checklist)

### 🚨 阻断级清单 (Blockers) - 出现任一必须建议 REJECT 打回！

- **[B-01 业务契约偏离]**
  - 专卖监管线索生命周期状态跃迁是否合法？严格遵循：`PENDING_ASSIGN -> IN_PROGRESS -> PENDING_REVIEW -> COMPLETED -> CLOSED`，以及待复核驳回回退至办理中 `PENDING_REVIEW -> IN_PROGRESS`；严禁跳跃式非法流转。
  - 接口返回值是否 100% 符合规范结构 `{ ok: boolean; error?: string; ... }`？
- **[B-02 服务端权威 RBAC 与数据防卫（严禁信任客户端角色）]**
  - Server Action 入口是否显式调用 `const session = await requireSession()`？
  - **严禁信任客户端传入的 `operatorRole`**！动作权限守卫与流水审计必须统一使用服务端可信的 `session.user.role`；
  - 个人私有数据（如 todos）写查操作强制绑定 `eq(table.userId, session.user.id)`；政企协同共享大盘数据流转必须前置状态机守卫、角色准入与不可篡改时间轴留痕。
- **[B-03 外部输入与文件全量 Zod 防卫]**
  - 是否所有请求参数（包括单个参数、查询过滤、FormData 文件封装）100% 经过 Zod Schema 的 `safeParse` 严格校验？
  - 文件上传入口必须校验封装格式、扩展名（仅限 `.xlsx`/`.xls`）、文件大小（<=10MB）及非空。严禁未经校验直接入库或读取！
- **[B-04 敏感数据裸奔]**
  - 涉案当事人手机号在前端列表与审计日志展示中必须经过 `maskMobile` 脱敏（`138****0000`），严禁明文外泄。
  - 用户密码哈希或 Token 绝不能随响应返回给前端客户端。
- **[B-05 SQL 注入风险]**
  - 是否 100% 采用 Drizzle ORM 查询构造器 API？严禁任何形式的字符串拼接 SQL！
- **[B-06 原生模块与运行时配置破坏]**
  - `next.config.ts` 中的 `serverExternalPackages: ["better-sqlite3"]` 是否被误删？
  - SQLite 初始化是否保持 WAL 模式与外键级联开启？

### 💡 建议级清单 (Advices) - 记录技术债，不阻断本次合并

- **[A-01 重复造轮子]**：是否未复用已有公共工具函数（如 `cn()`、`maskMobile`）？
- **[A-02 魔法字符串/数字]**：来源枚举与状态码是否统一引用类型或常量？
- **[A-03 RSC 与 Client 边界过宽]**：展示型组件是否过度声明了 `"use client"`？
- **[A-04 缺少字段说明]**：对外暴露的 Zod Schema 属性是否缺少清晰的业务错误提示？

---

## 执行步骤

1. **提取变更代码**：
   运行 `git diff` 抓取当前的变更内容（TypeScript 代码、TSX、配置等）。
2. **规约与底线扫描**：
   逐行排查是否有违反 B-01 ~ B-06 阻断项的内容。
3. **对比业务规格**：
   对照 `spec/clue-lens/requirements.md` 中的状态机规则与意向算法验证实现是否完整、边界条件是否严密。
4. **输出报告**：
   输出 Markdown 格式的《代码健康与安全审计卡》，并给出最终初审建议：`[ APPROVED / REJECTED ]`。

---

## 输出模板：《代码健康与安全审计卡》

```markdown
# 📋 AI 辅助代码评审报告 (Code Health & Security Audit)

- **评审时间**: YYYY-MM-DD HH:mm:ss
- **关联规格**: spec/clue-lens/requirements.md
- **变更文件数**: N 个文件

## 1. 🚨 阻断项判决 (Blockers)
| 检查项 | 状态 | 涉及文件与行号 | 生产危害说明与整改建议 |
|---|---|---|---|
| B-01 业务契约偏离 | [PASS / FAIL] | ... | ... |
| B-02 架构底线越权 | [PASS / FAIL] | ... | ... |
| B-03 外部输入未校验 | [PASS / FAIL] | ... | ... |
| B-04 敏感数据泄露 | [PASS / FAIL] | ... | ... |
| B-05 SQL 注入风险 | [PASS / FAIL] | ... | ... |
| B-06 原生运行时破坏 | [PASS / FAIL] | ... | ... |

## 2. 💡 建议项清单 (Advices)
- [A-01] ...
- [A-02] ...

## 3. 🎯 终审裁决建议
- **初审建议**: **[ ❌ REJECTED - 存在阻断缺陷 / ✅ APPROVED - 建议放行 ]**
- **架构师复核提示**: （说明关键核心逻辑及需要人工抽检的模块）
- **责任归因**: 提交人对本次提交承担最终生产正确性责任，AI 评审仅供决策参考。
```
