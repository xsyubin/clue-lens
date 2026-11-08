#!/usr/bin/env bash
# ============================================================================
# scripts/worktree-new.sh
# 为并行 AI Coding 任务创建隔离 worktree。默认只创建，不复制或覆盖用户文件。
#
# 用法：
#   ./scripts/worktree-new.sh --name rule-boundary
#   ./scripts/worktree-new.sh --name rule-boundary --base main --dry-run
# ============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "[WORKTREE] 当前目录不在 Git 仓库中。" >&2
  exit 2
fi
cd "${ROOT}"

NAME=""
BASE="HEAD"
PARENT="${ROOT}/../.worktrees"
DRY_RUN=0

usage() {
  cat <<'EOF'
用法：scripts/worktree-new.sh --name NAME [选项]

选项：
  --name NAME     必填，任务名，仅允许字母、数字、点、下划线、短横线
  --base REF      起始提交/分支，默认 HEAD
  --parent DIR    worktree 父目录，默认仓库同级 .worktrees
  --dry-run       只打印将要执行的命令，不创建目录或 worktree
  -h, --help      显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) [[ $# -ge 2 ]] || { echo "--name 需要参数" >&2; exit 2; }; NAME="$2"; shift 2 ;;
    --base) [[ $# -ge 2 ]] || { echo "--base 需要参数" >&2; exit 2; }; BASE="$2"; shift 2 ;;
    --parent) [[ $# -ge 2 ]] || { echo "--parent 需要参数" >&2; exit 2; }; PARENT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "${NAME}" || ! "${NAME}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "[WORKTREE] --name 必填，且只能包含字母、数字、点、下划线、短横线。" >&2
  exit 2
fi

if [[ -d "${PARENT}" ]]; then
  PARENT="$(cd "${PARENT}" && pwd -P)"
fi
WORKTREE="${PARENT%/}/ticket-lite-${NAME}"
BRANCH="ai/${NAME}"

if [[ -e "${WORKTREE}" ]]; then
  echo "[WORKTREE] 目标路径已存在，拒绝覆盖：${WORKTREE}" >&2
  exit 3
fi
if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "[WORKTREE] 分支已存在，拒绝覆盖：${BRANCH}" >&2
  exit 3
fi

echo "[WORKTREE] 仓库：${ROOT}"
echo "[WORKTREE] 基线：${BASE}"
echo "[WORKTREE] 分支：${BRANCH}"
echo "[WORKTREE] 路径：${WORKTREE}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  printf '+ mkdir -p %q\n' "${PARENT}"
  printf '+ git worktree add -b %q %q %q\n' "${BRANCH}" "${WORKTREE}" "${BASE}"
  exit 0
fi

mkdir -p "${PARENT}"
git worktree add -b "${BRANCH}" "${WORKTREE}" "${BASE}"
echo "[WORKTREE] 创建成功。进入该目录后再执行 scripts/init-hooks.sh。"
