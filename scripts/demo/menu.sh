#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/menu.sh
# 教学演示交互式主控制台 (支持键盘 1~6/A/Q 选择执行)
# ==============================================================================
DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DEMO_DIR}/lib/common.sh"

show_menu() {
  clear
  echo -e "${CYAN}================================================================================${RESET}"
  echo -e "${BOLD}${WHITE}       clue-lens AI Coding 工程化交付沙盘：Harness 资产对比演示控制台        ${RESET}"
  echo -e "${DIM}             中国信通院《驾驭工程》范式落地 · 政企信息中心架构师实战            ${RESET}"
  echo -e "${CYAN}================================================================================${RESET}"
  echo ""
  echo -e "  ${BOLD}${YELLOW}[1]${RESET} 场景一：【上下文治理】大上下文溺水 vs 架构地图渐进式索引"
  echo -e "  ${BOLD}${YELLOW}[2]${RESET} 场景二：【意图契约】讨好型脑补 vs SDD 规格反向排雷与 GWT"
  echo -e "  ${BOLD}${YELLOW}[3]${RESET} 场景三：【运行期安全】提示词软叮嘱失窃 vs Pre-tool Hook 毫秒掐断"
  echo -e "  ${BOLD}${YELLOW}[4]${RESET} 场景四：【环境隔离】main 分支踩踏死锁 vs Worktree 物理沙盒"
  echo -e "  ${BOLD}${YELLOW}[5]${RESET} 场景五：【门禁定界】假单测闭眼合并 vs 确定性静态安全亮红阻断"
  echo -e "  ${BOLD}${YELLOW}[6]${RESET} 场景六：【企业集成】数据库字段幻觉 vs 受控 MCP + RBAC 越权拦截"
  echo ""
  echo -e "  ----------------------------------------------------------------------"
  echo -e "  ${BOLD}${GREEN}[A]${RESET} 一键贯穿巡礼 (Run All 6 Scenarios)"
  echo -e "  ${BOLD}${RED}[Q]${RESET} 退出控制台 (Quit)"
  echo -e "${CYAN}================================================================================${RESET}"
  echo -n -e "${BOLD}请选择要演示的场景编号 [1-6/A/Q]: ${RESET}"
}

while true; do
  show_menu
  read -r choice
  case "$choice" in
    1)
      bash "${DEMO_DIR}/01-context-architecture.sh"
      demo_pause
      ;;
    2)
      bash "${DEMO_DIR}/02-sdd-clarification.sh"
      demo_pause
      ;;
    3)
      bash "${DEMO_DIR}/03-pre-tool-guard.sh"
      demo_pause
      ;;
    4)
      bash "${DEMO_DIR}/04-worktree-isolation.sh"
      demo_pause
      ;;
    5)
      bash "${DEMO_DIR}/05-quality-gate.sh"
      demo_pause
      ;;
    6)
      bash "${DEMO_DIR}/06-mcp-inspection.sh"
      demo_pause
      ;;
    [aA])
      bash "${DEMO_DIR}/run-all.sh"
      demo_pause
      ;;
    [qQ])
      echo -e "\n${GREEN}感谢演练，祝培训演示圆满成功！${RESET}\n"
      exit 0
      ;;
    *)
      echo -e "\n${RED}输入无效，请输入 1-6 或 A、Q${RESET}"
      sleep 1
      ;;
  esac
done
