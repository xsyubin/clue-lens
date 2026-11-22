# Overnight SDD 自动调度

统一入口是 `scripts/overnight.sh`。规格目录必须在启动时显式传入，调度器不会猜测根目录文件。

```bash
scripts/overnight.sh spec/clue-lens run
scripts/overnight.sh spec/clue-lens status
scripts/overnight.sh spec/clue-lens resume
```

调度器会在规格目录生成运行时 `automation-state.json`，使用 `.automation.lock` 防止并发运行，并把每个任务的实现和审查提交合并到 `overnight/<run-id>` 集成分支。`main` 只保留人工终审入口。

可选配置通过环境变量传入：

```bash
OVERNIGHT_BASELINE=main \
OVERNIGHT_MAX_ATTEMPTS=3 \
OVERNIGHT_TIMEOUT_MS=2700000 \
OVERNIGHT_FULLSTACK_IMPLEMENTER_CHAIN='codex:gpt-6.2-sol,claude:sonnet,codex:gpt-6.2-sol' \
OVERNIGHT_QUALITY_REVIEWER_CHAIN='claude:sonnet,codex:gpt-6.2-sol,claude:sonnet' \
scripts/overnight.sh spec/clue-lens run
```

任务完成后，早上先查看状态、日志、证据和集成分支，再由 Code Owner 决定是否进入 `main`。

macOS 使用 `scripts/overnight.sh spec/clue-lens install-launchd` 生成 LaunchAgent 配置。Linux 使用 `install-systemd` 生成 systemd user service。两个服务都在进程异常退出时重启，任务成功完成时不会无限重启。
