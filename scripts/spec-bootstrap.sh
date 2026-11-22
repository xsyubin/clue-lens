#!/usr/bin/env bash
# Build SDD specification drafts from a one-sentence requirement.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

usage() {
  cat >&2 <<'EOF'
用法：
  scripts/spec-bootstrap.sh <SPEC_PATH> run --requirement "一句话原始需求"
  scripts/spec-bootstrap.sh <SPEC_PATH> run --file requirement.txt
  scripts/spec-bootstrap.sh <SPEC_PATH> resume
  scripts/spec-bootstrap.sh <SPEC_PATH> status
  scripts/spec-bootstrap.sh <SPEC_PATH> approve

run 会在隔离 worktree 中依次生成 clarification.md、requirements.md、design.md 和 tasks.md。
approve 只确认规格草稿可以交给实现阶段，不会直接修改 main。
EOF
  exit 2
}

[[ $# -ge 2 ]] || usage
SPEC_PATH="$1"
MODE="$2"
shift 2
export SPEC_PATH

cd -- "$PROJECT_ROOT"
exec node scripts/automation/spec-bootstrap.mjs "$SPEC_PATH" "$MODE" "$@"
