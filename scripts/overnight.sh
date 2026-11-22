#!/usr/bin/env bash
# clue-lens overnight SDD runner.
#
# SPEC_PATH is intentionally positional. A missing or invalid specification path
# must stop before any worktree, branch, lock, or agent is created.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

usage() {
  cat >&2 <<'EOF'
用法：
  scripts/overnight.sh <SPEC_PATH> [run|resume|status|stop|install-launchd|install-systemd]

示例：
  scripts/overnight.sh spec/clue-lens run
  scripts/overnight.sh spec/clue-lens status

SPEC_PATH 必须在启动时显式传入，且必须是仓库内相对规格目录。
EOF
  exit 2
}

[[ $# -ge 1 && $# -le 2 ]] || usage
SPEC_PATH="$1"
MODE="${2:-run}"
export SPEC_PATH

case "$MODE" in
  run|resume|status|stop|install-launchd|install-systemd) ;;
  *) usage ;;
esac

cd -- "$PROJECT_ROOT"
exec node scripts/automation/overnight.mjs "$MODE"
