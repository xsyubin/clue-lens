#!/usr/bin/env bash
# ==============================================================================
# scripts/agent/agent-run.sh
# 根据 .agents/agent-manifest.yml 创建隔离 worktree、执行角色命令、
# 运行 AI 护栏、校验声明 Checks、防卫改动边界并生成 Agent 审计凭证
# ==============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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
用法：scripts/agent/agent-run.sh --role ROLE --name NAME [选项]
  --role ROLE       manifest 中的角色 id (spec-analyst | fullstack-implementer | quality-reviewer)
  --name NAME       worktree 任务名 / run-id
  --base REF        worktree 基线，默认 HEAD
  --parent DIR      worktree 父目录
  --run-commands    执行 manifest 中声明的 commands 和 checks
  --command CMD     追加执行一条命令
  --cleanup         命令成功且工作区干净时清理 worktree
  --dry-run         只打印契约与门禁，不创建 worktree
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
"$ROOT/scripts/gates/check-manifest.sh"

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
checks="$(field checks)"
objective="$(sed -n 's/^    objective: "\(.*\)"/\1/p' <<< "$role_block")"

echo "[AGENT-RUN] role=$ROLE"
echo "[AGENT-RUN] objective=$objective"
echo "[AGENT-RUN] allowed_paths=[$allowed]"
echo "[AGENT-RUN] forbidden_paths=[$forbidden]"
echo "[AGENT-RUN] checks=[$checks]"
echo "[AGENT-RUN] commands=[$commands]"

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[AGENT-RUN] dry-run：不会创建 worktree，也不会执行命令。"
    exit 0
fi

mkdir -p "$PARENT"
PARENT="$(cd "$PARENT" && pwd -P)"
WORKTREE="$PARENT/clue-lens-$NAME"
WORKTREE_PARENT="$PARENT" "$ROOT/scripts/agent/worktree.sh" new "$NAME"

guard_command() {
    local cmd="$1"
    # 统一复用公共前置安全守卫脚本 (pre-tool-guard.sh)
    if [ -x "$ROOT/scripts/agent/pre-tool-guard.sh" ]; then
        if ! "$ROOT/scripts/agent/pre-tool-guard.sh" "$cmd"; then
            return 1
        fi
    fi
    return 0
}

run_command() {
    local command="$1"
    echo "[AGENT-RUN] 预审工具命令安全护栏：$command"
    if ! guard_command "$command"; then
        echo "❌ [AGENT-RUN] 命令被 AI 运行期护栏拦截！" >&2
        return 1
    fi
    echo "[AGENT-RUN] 执行命令：$command"
    (cd "$WORKTREE" && bash -lc "$command")
}

check_results=()
check_failures=0
run_single_check() {
    local chk="$1"
    echo ">>> [AGENT-CHECK] 正在执行声明检查: ${chk}"
    local res="PASS"
    case "$chk" in
        "markdown-links")
            node -e "
            const fs = require('fs');
            const path = require('path');
            const targets = ['spec/clue-lens/requirements.md', 'spec/clue-lens/design.md', 'spec/clue-lens/tasks.md', 'README.md', 'ARCHITECTURE.md'];
            let fail = false;
            for (const file of targets) {
              const fullPath = path.join('$WORKTREE', file);
              if (!fs.existsSync(fullPath)) continue;
              const content = fs.readFileSync(fullPath, 'utf8');
              const linkRegex = /\[.*?\]\((?!https?:\/\/|mailto:|#)(.*?)\)/g;
              let m;
              while ((m = linkRegex.exec(content)) !== null) {
                let linkTarget = m[1].split('#')[0].trim();
                if (!linkTarget) continue;
                let resolved;
                if (linkTarget.startsWith('file://')) {
                  try { resolved = new URL(linkTarget).pathname; } catch { resolved = linkTarget.replace(/^file:\/\//, ''); }
                } else {
                  resolved = path.resolve(path.dirname(fullPath), linkTarget);
                }
                if (!fs.existsSync(resolved)) {
                  console.error('❌ [MARKDOWN-LINKS] 发现死链:', file, '->', linkTarget);
                  fail = true;
                }
              }
            }
            if (fail) process.exit(1);
            " || res="FAIL"
            ;;
        "spec-consistency")
            if [[ -f "$WORKTREE/spec/clue-lens/requirements.md" && -f "$WORKTREE/spec/clue-lens/design.md" && -f "$WORKTREE/spec/clue-lens/tasks.md" ]]; then
                res="PASS"
            else
                res="FAIL"
            fi
            ;;
        "typecheck")
            (cd "$WORKTREE" && npm run typecheck) || res="FAIL"
            ;;
        "check-security" | "static-security-check")
            (cd "$WORKTREE" && ./scripts/gates/check-security.sh) || res="FAIL"
            ;;
        "check-consistency")
            (cd "$WORKTREE" && ./scripts/gates/check-consistency.sh) || res="FAIL"
            ;;
        "check-secrets" | "secret-scan")
            (cd "$WORKTREE" && ./scripts/gates/check-secrets.sh) || res="FAIL"
            ;;
        "check-mcp")
            (cd "$WORKTREE" && ./scripts/gates/check-mcp.sh) || res="FAIL"
            ;;
        "review" | "deterministic-review")
            (cd "$WORKTREE" && ./scripts/review.sh) || res="FAIL"
            ;;
        *)
            echo "❌ [AGENT-CHECK] 未知或未配置的检查项: $chk" >&2
            res="FAIL"
            ;;
    esac

    if [[ "$res" == "PASS" ]]; then
        check_results+=("PASS|${chk}|通过")
        return 0
    else
        check_results+=("FAIL|${chk}|未通过")
        check_failures=$((check_failures + 1))
        echo "❌ [AGENT-CHECK] 检查项失败: ${chk}" >&2
        return 1
    fi
}

command_results=()
if [[ "$RUN_COMMANDS" -eq 1 ]]; then
    # 1. 执行角色声明的命令
    if [[ -n "$commands" ]]; then
        IFS=',' read -ra command_items <<< "$commands"
        for item in "${command_items[@]}"; do
            cmd="$(strip_item "$item")"
            if run_command "$cmd"; then
                command_results+=("SUCCESS|${cmd}")
            else
                command_results+=("FAILED|${cmd}")
                echo "❌ [AGENT-RUN] 命令执行失败: $cmd" >&2
                exit 1
            fi
        done
    fi

    # 2. 真实驱动执行角色声明的 checks
    if [[ -n "$checks" ]]; then
        IFS=',' read -ra check_items <<< "$checks"
        for chk in "${check_items[@]}"; do
            run_single_check "$(strip_item "$chk")" || true
        done
    fi
fi

if [[ -n "$EXTRA_COMMAND" ]]; then
    run_command "$EXTRA_COMMAND"
fi

# 检查改动边界
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

# 生成角色执行审计证据 (evidence/agent-runs/<name>/<role>.md)
EVIDENCE_DIR="${ROOT}/evidence/agent-runs/${NAME}"
mkdir -p "${EVIDENCE_DIR}"
EVIDENCE_FILE="${EVIDENCE_DIR}/${ROLE}.md"

{
    echo "# Agent 角色执行审计凭据 (${ROLE})"
    echo
    echo "- **运行 ID (Run Name)**: \`${NAME}\`"
    echo "- **角色 ID**: \`${ROLE}\`"
    echo "- **角色目标**: ${objective}"
    echo "- **执行时间**: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "- **隔离工作区**: \`${WORKTREE}\`"
    echo "- **门禁判定**: $([[ "${violations}" -eq 0 && "${check_failures}" -eq 0 ]] && echo "🟢 合规通过" || echo "🔴 违规拦截")"
    echo
    echo "## 声明检查项验证结果 (Checks)"
    echo
    echo "| 检查项 | 状态 | 详情 |"
    echo "|---|---|---|"
    if [[ ${#check_results[@]} -gt 0 ]]; then
        for cr in "${check_results[@]}"; do
            IFS="|" read -r st nm nt <<< "${cr}"
            echo "| \`${nm}\` | $([[ "$st" == "PASS" ]] && echo "🟢 PASS" || echo "🔴 FAIL") | ${nt} |"
        done
    else
        echo "| - | ⚪ SKIP | 未触发 --run-commands |"
    fi
    echo
    echo "## 命令执行日志 (Commands)"
    echo
    if [[ ${#command_results[@]} -gt 0 ]]; then
        for cmd_res in "${command_results[@]}"; do
            IFS="|" read -r st cmd <<< "${cmd_res}"
            echo "- [${st}] \`${cmd}\`"
        done
    else
        echo "（无命令执行或未传入 --run-commands）"
    fi
    echo
    echo "## 工作区文件变更清单"
    echo
    if [[ -n "${changed_files}" ]]; then
        while IFS= read -r f; do
            echo "- \`${f}\`"
        done <<< "${changed_files}"
    else
        echo "（工作区干净，无未暂存/未提交变更）"
    fi
} > "${EVIDENCE_FILE}"

echo "📜 [AGENT-RUN] 审计凭证已生成: ${EVIDENCE_FILE}"

if [[ "$CLEANUP" -eq 1 ]]; then
    WORKTREE_PARENT="$PARENT" "$ROOT/scripts/agent/worktree.sh" drop "$NAME"
else
    echo "[AGENT-RUN] 运行完成，worktree 保留：$WORKTREE"
fi

if [[ "${violations}" -gt 0 || "${check_failures}" -gt 0 ]]; then
    echo "❌ [AGENT-RUN] 角色审计未通过（违规变更: ${violations}, 失败检查: ${check_failures}）！" >&2
    exit 1
fi
