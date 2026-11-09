---
description: "任何涉及代码修改、特性开发或大改造，必须在 .worktrees 下的隔离 worktree + 新分支中进行，验证全绿后快进合并到 main"
globs: "**"
alwaysApply: true
---

# Worktree 隔离工作流规范

## 1. 硬约束

**任何要提交的代码改动（全栈功能开发、缺陷修复、架构重构、依赖变更）严禁直接在主工作区的 `main` 分支上动手。**
只读调研（查看源码、查阅文档、探查 DB Schema、排查日志）不受此约束。

操作流程严格固定为三步，机械步骤全部由 `scripts/agent/worktree.sh`（或根目录软链 `scripts/agent-worktree.sh`）驱动：

1. **开（New）**：`./scripts/agent/worktree.sh new <slug>`
   - 自动拉出分支 `agent/<slug>`，并创建工作目录 `../.worktrees/clue-lens-<slug>`；
   - 自动软链主工程的 `node_modules`，免去重复安装依赖；
   - 自动克隆独立私有的 SQLite 沙盒数据库 `data/app.db`，从物理层杜绝并发锁死与污染；
   - 自动同步 `.env` 环境配置。
2. **改 + 测（Dev & Test）**：
   - 所有的代码编辑（`edit_file` / `write_file`）、编译与测试运行，**一律在 `../.worktrees/clue-lens-<slug>/` 路径下执行**；
   - 保证所有单元测试、RBAC 鉴权测试和 GWT 场景测试在 worktree 内通过并完成原子化提交（`git commit`）。
3. **合（Merge）**：
   - 验证全部通过后，在主工程或 worktree 中运行 `./scripts/agent/worktree.sh merge <slug>`；
   - 脚本会自动跑全套确定性前置审查门禁（`./scripts/review.sh`）；
   - 若 `main` 分支有演进，自动变基并强制退出（退出码 3），要求重新跑测试验证，坚决防止并发代码绕过测试；
   - 门禁全绿后自动快进合并（`--ff-only`）到 `main` 并清理 worktree 与分支；
   - 若放弃改动，执行 `./scripts/agent/worktree.sh drop <slug>`。

---

## 2. 智能体行为与避坑守则

- **路径边界红线**：
  执行 `new` 之后，所有的文件读写操作（`read_file`, `edit_file`, `write_file`）必须以 `.worktrees/<slug>/...` 为工作根目录。严禁将改动写回主工作区路径！
- **依赖软链只读共享**：
  `node_modules` 是通过软链指向主工作区的同一份依赖。日常开发严禁在 worktree 内部手动删除或随意修改该软链。
- **沙盒数据库独占**：
  每个 worktree 都有独立的 `data/app.db` 副本，既保证真实数据的有效性，又彻底消除了多 Agent 并发时的 `database is locked` 异常。
- **合并方式只有快进**：
  严禁在 `main` 上生成无意义的 merge commit，严格采用 `--ff-only` 快进合并，保留清晰、可追溯的原子化提交历史。
