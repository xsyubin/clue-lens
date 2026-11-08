#!/usr/bin/env bash
# ============================================================================
# scripts/worktree-clean.sh
# 安全移除本工程创建的 worktree；默认拒绝删除有未提交改动的目录。
# ============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "[WORKTREE] 当前目录不在 Git 仓库中。" >&2
  exit 2
fi
cd "${ROOT}"

NAME=""
PARENT="${ROOT}/../.worktrees"
FORCE=0
DRY_RUN=0

usage() {
  cat <<'EOF'
用法：scripts/worktree-clean.sh --name NAME [选项]

选项：
  --name NAME     必填，只允许清理 clue-lens-NAME
  --parent DIR    worktree 父目录，默认仓库同级 .worktrees
  --force         即使 worktree 有未提交改动也移除（需谨慎）
  --dry-run       只打印将要执行的命令，不移除任何内容
  -h, --help      显示帮助
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) [[ $# -ge 2 ]] || { echo "--name 需要参数" >&2; exit 2; }; NAME="$2"; shift 2 ;;
    --parent) [[ $# -ge 2 ]] || { echo "--parent 需要参数" >&2; exit 2; }; PARENT="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
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
WORKTREE="${PARENT%/}/clue-lens-${NAME}"
if [[ "${WORKTREE}" != "${PARENT%/}"/* || "${WORKTREE}" == "${PARENT%/}" ]]; then
  echo "[WORKTREE] 目标路径校验失败，拒绝执行。" >&2
  exit 3
fi
if ! git worktree list --porcelain | grep -Fqx "worktree ${WORKTREE}"; then
  echo "[WORKTREE] 目标不是当前仓库登记的 worktree：${WORKTREE}" >&2
  exit 3
fi

if [[ "${FORCE}" -eq 0 && -n "$(git -C "${WORKTREE}" status --porcelain 2>/dev/null || true)" ]]; then
  echo "[WORKTREE] 目标有未提交改动，拒绝删除；确认放弃后再加 --force：${WORKTREE}" >&2
  exit 4
fi

echo "[WORKTREE] 目标：${WORKTREE}"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  if [[ "${FORCE}" -eq 1 ]]; then
    printf '+ git worktree remove --force %q\n' "${WORKTREE}"
  else
    printf '+ git worktree remove %q\n' "${WORKTREE}"
  fi
  exit 0
fi

if [[ "${FORCE}" -eq 1 ]]; then
  git worktree remove --force "${WORKTREE}"
else
  git worktree remove "${WORKTREE}"
fi
echo "[WORKTREE] 清理成功。分支仍保留，可按需通过 git branch -d ${BRANCH:-ai/${NAME}} 删除。"
