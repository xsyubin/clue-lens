/**
 * MCP 运行安全上下文与 RBAC 权限控制
 */

export const ROLES = {
  GUEST: "GUEST",
  DEVELOPER: "DEVELOPER",
  ARCHITECT: "ARCHITECT",
} as const;

export type McpRole = (typeof ROLES)[keyof typeof ROLES];

let currentOperator: string | null = null;
let currentRole: McpRole | null = null;

export function getCurrentOperatorId(): string {
  if (currentOperator) return currentOperator;
  const envOp = process.env.CLUE_MCP_OPERATOR || process.env.TICKET_MCP_OPERATOR;
  return envOp ? envOp.trim() : "DEV_AGENT_01";
}

export function getCurrentRole(): McpRole {
  if (currentRole) return currentRole;
  const envRole = (process.env.CLUE_MCP_ROLE || process.env.TICKET_MCP_ROLE || "DEVELOPER").trim().toUpperCase();
  if (envRole === "GUEST") return ROLES.GUEST;
  if (envRole === "ARCHITECT") return ROLES.ARCHITECT;
  return ROLES.DEVELOPER;
}

export function setSecurityContext(operatorId: string, role: McpRole): void {
  currentOperator = operatorId;
  currentRole = role;
}

export function clearSecurityContext(): void {
  currentOperator = null;
  currentRole = null;
}

export function checkRbacAccess(requiredRole: McpRole = ROLES.DEVELOPER): void {
  const role = getCurrentRole();
  if (role === ROLES.GUEST) {
    throw new Error(`[RBAC 拒绝] 访客角色 [GUEST] 禁止调用任何内部运维与开发诊断工具`);
  }
  if (requiredRole === ROLES.ARCHITECT && role !== ROLES.ARCHITECT) {
    throw new Error(`[RBAC 拒绝] 该操作仅限架构师角色 [ARCHITECT] 访问，当前角色: [${role}]`);
  }
}
