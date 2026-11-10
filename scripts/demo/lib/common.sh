#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/lib/common.sh
# 教学演示公共辅助库：ANSI 颜色排版、三幕式画框、交互控制
# ==============================================================================

# 自动定位工程根目录
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
BG_RED="\033[41;37m"
BG_GREEN="\033[42;30m"
RESET="\033[0m"

# 打印横幅头部
demo_header() {
  local num="$1"
  local title="$2"
  local block="$3"
  echo ""
  echo -e "${CYAN}================================================================================${RESET}"
  echo -e "${BOLD}${WHITE}🎬 教学场景 ${num}：${title}${RESET}"
  echo -e "${DIM}📌 对应培训提纲：${block}${RESET}"
  echo -e "${CYAN}================================================================================${RESET}"
  echo ""
}

# 打印分幕标题
demo_act() {
  local act_num="$1"
  local act_title="$2"
  local color="$3"
  echo ""
  echo -e "${color}${BOLD}--------------------------------------------------------------------------------${RESET}"
  echo -e "${color}${BOLD}【第 ${act_num} 幕】${act_title}${RESET}"
  echo -e "${color}${BOLD}--------------------------------------------------------------------------------${RESET}"
}

# 打印动作步骤
demo_step() {
  local text="$1"
  echo -e "${BLUE}👉 [步骤说明]${RESET} ${text}"
}

# 打印模拟过程
demo_simulate() {
  local text="$1"
  echo -e "${YELLOW}⚡ [模拟执行]${RESET} ${DIM}${text}${RESET}"
}

# 打印真实命令
demo_run() {
  local text="$1"
  echo -e "${MAGENTA}🚀 [真实命令]${RESET} ${BOLD}${text}${RESET}"
}

# 打印警告 / 翻车提示
demo_fail() {
  local text="$1"
  echo -e "${RED}${BOLD}💥 [翻车警告]${RESET} ${RED}${text}${RESET}"
}

# 打印成功 / 防御提示
demo_pass() {
  local text="$1"
  echo -e "${GREEN}${BOLD}🛡️ [成功防卫]${RESET} ${GREEN}${text}${RESET}"
}

# 打印金句
demo_quote() {
  local quote="$1"
  echo ""
  echo -e "${YELLOW}┌──────────────────────────────────────────────────────────────────────────────┐${RESET}"
  echo -e "${YELLOW}│ 💡 ${BOLD}架构师金句：${RESET}${YELLOW}                                                          │${RESET}"
  echo -e "${YELLOW}│    ${BOLD}\"${quote}\"${RESET}${YELLOW}│${RESET}"
  echo -e "${YELLOW}└──────────────────────────────────────────────────────────────────────────────┘${RESET}"
  echo ""
}

# 交互暂停（支持 DEMO_AUTO=1 自动继续）
demo_pause() {
  if [ "${DEMO_AUTO:-0}" = "1" ]; then
    sleep 1.2
    return
  fi
  echo ""
  echo -e "${DIM}按 [Enter] 键继续下一步演练...${RESET}"
  read -r _
}
