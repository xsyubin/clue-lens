#!/usr/bin/env bash
# ==============================================================================
# scripts/demo/run-all.sh
# 一键贯穿巡礼：连续运行 6 大对比演示场景
# ==============================================================================
DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${DEMO_DIR}/lib/common.sh"

echo ""
echo -e "${MAGENTA}================================================================================${RESET}"
echo -e "${BOLD}${WHITE}       🚀 clue-lens AI Coding 工程化交付沙盘：全套对比场景巡礼启动        ${RESET}"
echo -e "${MAGENTA}================================================================================${RESET}"

for script in \
  "${DEMO_DIR}/01-context-architecture.sh" \
  "${DEMO_DIR}/02-sdd-clarification.sh" \
  "${DEMO_DIR}/03-pre-tool-guard.sh" \
  "${DEMO_DIR}/04-worktree-isolation.sh" \
  "${DEMO_DIR}/05-mcp-inspection.sh" \
  "${DEMO_DIR}/06-quality-gate.sh"
do
  bash "$script"
  echo ""
  echo -e "${DIM}--------------------------------------------------------------------------------${RESET}"
done

echo ""
echo -e "${GREEN}${BOLD}================================================================================${RESET}"
echo -e "${GREEN}${BOLD}🎉 恭喜！全部 6 项 Harness 资产对比演练圆满完成！${RESET}"
echo -e "${GREEN}${BOLD}================================================================================${RESET}"
echo ""
