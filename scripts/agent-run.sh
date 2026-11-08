#!/usr/bin/env bash
# 根据 .agents/agent-manifest.yml 创建隔离 worktree、执行角色命令并检查改动边界。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${AGENT_MANIFEST_FILE:-${ROOT}/.agents/agent-manifest.yml}"
ROLE=""
NAME=""
BASE="HEAD"
PARENT="$ROOT/../.worktrees"
DRY_RUN=0
RUN_COMMANDS=0
CLEANUP=0
EXTRA_COMMAND=""

usage() {
    cat <<'EOF'
用法：scripts/agent-run.sh --role ROLE --name NAME [选项]
  --role ROLE       manifest 中的角色 id
  --name NAME       worktree 任务名
  --base REF        worktree 基线，默认 HEAD
  --parent DIR      worktree 父目录
  --run-commands    执行 manifest 中声明的 commands
  --command CMD     追加执行一条命令
  --cleanup         命令成功且工作区干净时清理 worktree
  --dry-run         只打印契约，不创建 worktree
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --role) [[ $# -ge 2 ]] || { echo "--role 需要参数" >&2; exit 2; }; ROLE="$2"; shift 2 ;;
        --name) [[ $# -ge 2 ]] || { echo "--name 需要参数" >&2; exit 2; }; NAME="$2"; shift 2 ;;
        --base) [[ $# -ge 2 ]] || { echo "--base 需要参数" >&2; exit 2; }; BASE="$2"; shift 2 ;;
        --parent) [[ $# -ge 2 ]] || { echo "--parent 需要参数" >&2; exit 2; }; PARENT="$2"; shift 2 ;;
        --run-commands) RUN_COMMANDS=1; shift ;;
        --command) [[ $# -ge 2 ]] || { echo "--command 需要参数" >&2; exit 2; }; EXTRA_COMMAND="$2"; shift 2 ;;
        --cleanup) CLEANUP=1; shift ;;
        --dry-run) DRY_RUN=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
    esac
done

[[ -n "$ROLE" && -n "$NAME" ]] || { usage >&2; exit 2; }
"$ROOT/scripts/validate-agent-manifest.sh"

role_block="$(awk -v role="$ROLE" '
    $0 == "  - id: " role {inside=1}
    inside && $0 ~ /^  - id: / && $0 != "  - id: " role {exit}
    inside && $0 ~ /^execution:/ {exit}
    inside {print}
' "$MANIFEST")"
[[ -n "$role_block" ]] || { echo "角色不存在：$ROLE" >&2; exit 2; }

field() {
    sed -n "s/^    $1: \[\(.*\)\]/\1/p" <<< "$role_block"
}
strip_item() {
    printf '%s\n' "$1" | sed -E 's/^[[:space:]]*"?//; s/"?[[:space:]]*$//'
}
path_matches() {
    local file="$1"
    local pattern="$2"
    local regex="${pattern//./\.}"
    regex="${regex//\*/.*}"
    [[ "$file" =~ ^${regex} ]]
}

allowed="$(field allowed_paths)"
forbidden="$(field forbidden_paths)"
commands="$(field commands)"
objective="$(sed -n 's/^    objective: "\(.*\)"/\1/p' <<< "$role_block")"

echo "[AGENT-RUN] role=$ROLE"
echo "[AGENT-RUN] objective=$objective"
echo "[AGENT-RUN] allowed_paths=[$allowed]"
echo "[AGENT-RUN] forbidden_paths=[$forbidden]"
echo "[AGENT-RUN] commands=[$commands]"

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[AGENT-RUN] dry-run：不会创建 worktree，也不会执行命令。"
    exit 0
fi

mkdir -p "$PARENT"
PARENT="$(cd "$PARENT" && pwd -P)"
WORKTREE="$PARENT/ticket-lite-$NAME"
"$ROOT/scripts/worktree-new.sh" --name "$NAME" --base "$BASE" --parent "$PARENT"

run_command() {
    local command="$1"
    echo "[AGENT-RUN] 执行：$command"
    (cd "$WORKTREE" && bash -lc "$command")
}

if [[ "$RUN_COMMANDS" -eq 1 ]]; then
    IFS=',' read -ra command_items <<< "$commands"
    for item in "${command_items[@]}"; do
        run_command "$(strip_item "$item")"
    done
fi
[[ -z "$EXTRA_COMMAND" ]] || run_command "$EXTRA_COMMAND"

changed_files="$(git -C "$WORKTREE" status --porcelain=v1 | sed -E 's/^.. //')"
violations=0
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    allowed_match=0
    IFS=',' read -ra allowed_items <<< "$allowed"
    for item in "${allowed_items[@]}"; do
        prefix="$(strip_item "$item")"
        path_matches "$file" "$prefix" && allowed_match=1
    done
    IFS=',' read -ra forbidden_items <<< "$forbidden"
    for item in "${forbidden_items[@]}"; do
        prefix="$(strip_item "$item")"
        if path_matches "$file" "$prefix"; then
            echo "❌ [AGENT-RUN] 命中 forbidden_paths：$file" >&2
            violations=$((violations + 1))
        fi
    done
    if [[ "$allowed_match" -eq 0 ]]; then
        echo "❌ [AGENT-RUN] 改动超出 allowed_paths：$file" >&2
        violations=$((violations + 1))
    fi
done <<< "$changed_files"

if [[ "$violations" -gt 0 ]]; then
    echo "[AGENT-RUN] 路径门禁失败；保留 worktree：$WORKTREE" >&2
    exit 1
fi

if [[ "$CLEANUP" -eq 1 ]]; then
    "$ROOT/scripts/worktree-clean.sh" --name "$NAME" --parent "$PARENT"
else
    echo "[AGENT-RUN] 运行完成，worktree 保留：$WORKTREE"
fi
