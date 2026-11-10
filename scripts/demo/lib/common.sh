#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/lib/common.sh
# 教学演示公共辅助库：统一“一句话需求”开发对比框架
# ==============================================================================

DEMO_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$(cd "${DEMO_LIB_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${DEMO_DIR}/../.." && pwd)"

# ANSI 颜色定义
BOLD="\033[1m"
DIM="\033[2m"
RED="\033[1;31m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
BLUE="\033[1;34m"
MAGENTA="\033[1;35m"
CYAN="\033[1;36m"
WHITE="\033[1;37m"
RESET="\033[0m"

# 场景主横幅
demo_header() {
  local num="$1"
  local title="$2"
  local block="$3"
  echo ""
  echo -e "${CYAN}================================================================================${RESET}"
  echo -e "${BOLD}${WHITE}🎬 教学场景 ${num}：${title}${RESET}"
  echo -e "${DIM}📌 对应培训提纲：${block}${RESET}"
  echo -e "${CYAN}================================================================================${RESET}"
}

# 一句话需求发布
demo_feature() {
  local req="$1"
  echo ""
  echo -e "${YELLOW}┌──────────────────────────────────────────────────────────────────────────────┐${RESET}"
  echo -e "${YELLOW}│ 🎯 ${BOLD}【一句话开发需求发布】${RESET}${YELLOW}                                                    │${RESET}"
  echo -e "${YELLOW}│    \"${WHITE}${BOLD}${req}${RESET}${YELLOW}\"${RESET}"
  echo -e "${YELLOW}└──────────────────────────────────────────────────────────────────────────────┘${RESET}"
  echo ""
}

# 分步标题
demo_act() {
  local act_num="$1"
  local act_title="$2"
  local color="$3"
  echo ""
  echo -e "${color}${BOLD}--------------------------------------------------------------------------------${RESET}"
  echo -e "${color}${BOLD}【${act_num}】${act_title}${RESET}"
  echo -e "${color}${BOLD}--------------------------------------------------------------------------------${RESET}"
}

demo_step() {
  echo -e "${BLUE}👉 [步骤说明]${RESET} $1"
}

demo_run() {
  echo -e "${MAGENTA}🚀 [真实执行]${RESET} ${BOLD}$1${RESET}"
}

demo_fail() {
  echo -e "${RED}${BOLD}❌ [开发效果·翻车]${RESET} ${RED}$1${RESET}"
}

demo_pass() {
  echo -e "${GREEN}${BOLD}✅ [开发效果·通过]${RESET} ${GREEN}$1${RESET}"
}

demo_quote() {
  echo ""
  echo -e "${YELLOW}┌──────────────────────────────────────────────────────────────────────────────┐${RESET}"
  echo -e "${YELLOW}│ 💡 ${BOLD}架构师金句：${RESET}${YELLOW}                                                          │${RESET}"
  echo -e "${YELLOW}│    ${BOLD}\"$1\"${RESET}${YELLOW}│${RESET}"
  echo -e "${YELLOW}└──────────────────────────────────────────────────────────────────────────────┘${RESET}"
  echo ""
}

demo_pause() {
  if [ "${DEMO_AUTO:-0}" = "1" ]; then
    sleep 1.2
    return
  fi
  echo ""
  echo -e "${DIM}按 [Enter] 键继续下一步对比演练...${RESET}"
  read -r _
}
