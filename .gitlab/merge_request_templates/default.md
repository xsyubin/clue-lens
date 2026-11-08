<!-- Pull Request 提交说明模板（后端工程；AI 初审不等于人工批准） -->
## 1. 需求背景与追溯链
- **关联需求/Issue**：
- **对应规格文件**：
- **涵盖业务规则**：

## 2. AI 参与度声明
- [ ] 纯人工编写（0% AI）
- [ ] AI 辅助生成骨架 + 人工深度校验（AI 占比约：  %）
- [ ] AI 辅助修改既有代码
- [ ] AI 完全自动生成（需说明人工复核范围）

## 3. 门禁验证证据 (Evidence)
- [ ] **路径风险分级**：`./scripts/check-risk-level.sh` (自动判定: [ ] 🟢 LOW  [ ] 🟡 MEDIUM  [ ] 🔴 HIGH)
- [ ] **全量单测**：`mvn clean test`
- [ ] **静态门禁**：`./scripts/static-security-check.sh`
- [ ] **一致性检查**：`./scripts/check-consistency.sh`
- [ ] **AI 初审报告**：`./scripts/ai-review.sh --staged`，链接：
- [ ] **PIT 变异测试**：杀灭率达到项目阈值，报告链接：
- [ ] **MCP/集成测试**（如适用）：命令与结果：

## 4. 开发者理解与责任保证（强制勾选）
- [ ] **提交人已逐行通读所有新增与修改的代码，能够解释其边界条件。**
- [ ] **提交人确认：AI 生成不是免责理由，并承担变更责任。**

**提交人**：
**提交日期**：

## 5. 人工终审（由 Code Owner / 架构师填写）
- **终审结论**：[ ] Approve  [ ] Reject  [ ] Request changes
- **人工审查人**：
- **审查依据**：`evidence/merge-decision-review-template.md`
- **阻断项或放行理由**：
- **签署日期**：
