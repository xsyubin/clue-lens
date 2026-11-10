<!-- Merge Request 提交说明模板 (clue-lens 现代化全栈工程；AI 初审不等于人工批准) -->

## 1. 需求背景与追溯链
- **关联需求 / Issue**：
- **对应 SDD 规格文件**：`spec/clue-lens/requirements.md`
- **涵盖业务状态机 / EARS 规则**：
- **涉及模块 / 路径**：

## 2. AI 参与度声明
- [ ] 纯人工编写（0% AI）
- [ ] AI 辅助生成骨架 + 人工深度校验（AI 占比约：  %）
- [ ] AI 辅助修改既有代码与修复 Bug
- [ ] AI 完全自动生成（需附带 Subagent 运行日志与人工复核范围）

## 3. 门禁验证证据 (Evidence Checklist)
- [ ] **确定性机器全量前置审查**：`npm run review` 或 `./scripts/review.sh --staged`
  - 静态安全门禁 (`scripts/gates/check-security.mjs`)：[ ] PASS
  - 架构与命名一致性 (`scripts/gates/check-consistency.mjs`)：[ ] PASS
  - 敏感凭据扫描 (`scripts/gates/check-secrets.mjs`)：[ ] PASS
  - TypeScript 严格类型与 Lint (`scripts/gates/check-types.mjs`)：[ ] PASS
  - 单元测试与 RBAC 边界防卫测试 (`scripts/gates/check-tests.mjs`)：[ ] PASS
  - Next.js 生产环境构建打包 (`scripts/gates/check-build.mjs`)：[ ] PASS
  - 审查报告归档：[`evidence/deterministic-review-report.md`](evidence/deterministic-review-report.md)
- [ ] **MCP 协议与数据库契约测试**：`npm run test:mcp` (全部 11/11 项通过)
- [ ] **Agent 并发与隔离凭证**（如涉及 Subagent 并发开发）：
  - 隔离沙盒日志：`evidence/agent-runs/<run-id>/`

## 4. 开发者理解与责任保证（强制勾选）
- [ ] **提交人已逐行通读所有新增与修改的代码，能够清晰解释其业务边界与状态守卫。**
- [ ] **提交人确认：AI 生成不是免责理由，提交人承担本次变更的技术与生产运行责任。**
- [ ] **严禁包含真实未脱敏的联系方式、私钥与敏感生产凭据。**

**提交人**：  
**提交日期**：  

---

## 5. 人工终审（由 Code Owner / 架构师填写）
- **终审结论**：[ ] Approve 放行  [ ] Reject 阻断驳回  [ ] Request changes 需补正
- **人工审查人**：
- **审查依据**：`spec/clue-lens/requirements.md` 与 `AGENTS.md` 架构红线
- **阻断项或放行理由**：
- **签署日期**：
