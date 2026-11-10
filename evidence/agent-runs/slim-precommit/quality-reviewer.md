# 角色审计凭据: quality-reviewer

- **任务名称**: `slim-precommit`
- **执行时间**: 2026-11-10
- **门禁判定**: 🟢 合规通过
- **变更说明**:
  1. 将 `scripts/gates/check-build.mjs` 移出日常 `scripts/review-checks.list`（即 `.githooks/pre-commit` 门禁清单），日常提交仅运行 7 项轻量确定性审查（类型检查、单元/GWT 测试、安全与密钥门禁等）。
  2. 在 `next.config.ts` 中配置 `distDir: process.env.NEXT_DIST_DIR || ".next"`，支持构建输出目录隔离。
  3. 改造 `scripts/gates/check-build.mjs` 使用 `.next-build-gate` 隔离沙盒目录进行构建并自毁清理，彻底杜绝构建清空常驻 `next dev` 的 `.next` 缓存。
  4. 新增 `npm run check:build` 显式构建检查入口。
- **全量测试结果**: 58/58 单元与端到端测试 PASS，11/11 MCP 契约测试 PASS。
