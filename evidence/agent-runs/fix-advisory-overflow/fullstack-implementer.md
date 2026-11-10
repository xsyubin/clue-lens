# 角色审计凭据: fullstack-implementer

- **任务名称**: `fix-advisory-overflow`
- **执行时间**: 2026-11-10
- **门禁判定**: 🟢 合规通过
- **变更说明**:
  1. 修复两列 Grid 与 Flexbox 窄容器下右侧卡片内容撑开溢出的缺陷：在 `clue-detail-view.tsx` 和 `advisory-card.tsx` 的容器及文本元素上补充 `min-w-0`、`overflow-hidden`、`break-words` 与 `[overflow-wrap:anywhere]`。
  2. 增强 `cleanAdvisoryText` 正则清洗函数：彻底消除带有换行符、双括号、嵌套注脚的复杂 URL 引用（如 `([samr.gov.cn]\n(https://...))`），防止任何长 URL 字符破坏排版。
  3. 修复 `parseMeasuresToList` 步骤拆分逻辑：支持行内序号（如 `。2.`、`；2.`、`1、`、`①` 等）拆分为独立步骤列表项，彻底解决多项举措全部挤压在单一条目的问题。
- **全量测试结果**: 64/64 单元与 GWT 测试 PASS，11/11 MCP 契约测试 PASS。
