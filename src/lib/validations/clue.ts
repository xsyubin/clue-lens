import { z } from "zod";

/**
 * 专卖监管线索枚举定义
 */
export const CLUE_STATUSES = [
  "PENDING_ASSIGN", // 待分派
  "IN_PROGRESS",    // 办理中
  "PENDING_REVIEW", // 待复核
  "COMPLETED",      // 已完成
  "CLOSED",         // 已关闭
] as const;

export const RISK_LEVELS = ["高", "中", "低"] as const;

export const CLUE_TYPES = [
  "许可证异常",
  "经营异常",
  "配送异常",
  "价格异常",
  "非法收购",
  "其他",
] as const;

export const CLUE_SOURCES = [
  "日常检查",
  "群众举报",
  "数据分析",
  "系统预警",
  "部门移交",
] as const;

export const OPERATOR_ROLES = [
  "综合管理人员",
  "线索核查人员",
  "部门负责人",
  "情报分析人员",
  "专卖监督管理人员",
] as const;

/**
 * Excel 台账单行解析校验
 */
export const importClueRowSchema = z.object({
  clueNo: z.string().min(1, "线索编号不能为空"),
  discoveryDate: z.string().min(1, "发现日期不能为空"),
  region: z.string().min(1, "所属区域不能为空"),
  source: z.string().default("日常检查"),
  type: z.string().default("经营异常"),
  targetName: z.string().min(1, "经营对象不能为空"),
  riskLevel: z.string().default("中"),
  amount: z.coerce.number().min(0, "涉及金额必须大于等于0").default(0),
  department: z.string().optional().nullable(),
  handler: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  needReview: z.boolean().default(false),
  status: z.enum(CLUE_STATUSES).default("PENDING_ASSIGN"),
  checkDate: z.string().optional().nullable(),
  checkResult: z.string().optional().nullable(),
  measures: z.string().optional().nullable(),
  reviewComment: z.string().optional().nullable(),
});

export type ImportClueRowDTO = z.infer<typeof importClueRowSchema>;

/**
 * 线索分派参数契约
 */
export const dispatchClueSchema = z.object({
  clueId: z.string().uuid("非法线索 ID"),
  department: z.string().min(1, "责任部门必填"),
  handler: z.string().min(1, "责任人必填"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "办理期限格式必须为 YYYY-MM-DD"),
  needReview: z.boolean().default(false),
  operatorRole: z.enum(OPERATOR_ROLES).optional(),
});

export type DispatchClueDTO = z.infer<typeof dispatchClueSchema>;

/**
 * 核查办理填报参数契约
 */
export const submitHandlingSchema = z.object({
  clueId: z.string().uuid("非法线索 ID"),
  checkDate: z.string().min(1, "核查日期必填"),
  checkResult: z.string().min(1, "核查结论必填"),
  measures: z.string().min(1, "处置措施必填"),
  operatorRole: z.enum(OPERATOR_ROLES).optional(),
});

export type SubmitHandlingDTO = z.infer<typeof submitHandlingSchema>;

/**
 * 审批复核参数契约
 */
export const reviewClueSchema = z.object({
  clueId: z.string().uuid("非法线索 ID"),
  action: z.enum(["APPROVE", "REJECT"], {
    error: "复核动作必须为 APPROVE 或 REJECT",
  }),
  comment: z.string().optional().nullable(),
  operatorRole: z.enum(OPERATOR_ROLES).optional(),
}).refine(
  (data) => {
    if (data.action === "REJECT") {
      return !!data.comment && data.comment.trim().length > 0;
    }
    return true;
  },
  {
    message: "复核驳回时必须录入驳回原因",
    path: ["comment"],
  }
);

export type ReviewClueDTO = z.infer<typeof reviewClueSchema>;

/**
 * 归档关闭参数契约
 */
export const closeClueSchema = z.object({
  clueId: z.string().uuid("非法线索 ID"),
  closeReason: z.string().optional().nullable(),
  operatorRole: z.enum(OPERATOR_ROLES).optional(),
});

export type CloseClueDTO = z.infer<typeof closeClueSchema>;

/**
 * 辅助处置建议参数契约
 */
export const generateAdvisorySchema = z.object({
  clueId: z.string().uuid("非法线索 ID"),
  useAi: z.boolean().optional(),
});

export type GenerateAdvisoryDTO = z.infer<typeof generateAdvisorySchema>;

/**
 * 导出参数契约
 */
export const exportCluesSchema = z.object({
  format: z.enum(["XLSX", "MARKDOWN"], {
    error: "导出格式仅支持 XLSX 或 MARKDOWN",
  }),
  filterInput: z.unknown().optional(),
});

export type ExportCluesDTO = z.infer<typeof exportCluesSchema>;

/**
 * 单条线索详情查询契约
 */
export const getClueDetailSchema = z.object({
  clueId: z.string().uuid("非法线索 ID"),
});

export type GetClueDetailDTO = z.infer<typeof getClueDetailSchema>;

/**
 * 演示模式切换角色契约
 */
export const switchDemoRoleSchema = z.object({
  role: z.enum(OPERATOR_ROLES, {
    error: "不支持的目标角色",
  }),
});

export type SwitchDemoRoleDTO = z.infer<typeof switchDemoRoleSchema>;

/**
 * 文件上传元数据契约
 */
export const importFileSchema = z.object({
  name: z.string().regex(/\.(xlsx|xls)$/i, "仅支持上传 .xlsx 或 .xls 格式的 Excel 文件"),
  size: z.number().gt(0, "上传文件不可为空").lte(10 * 1024 * 1024, "文件大小不能超过 10MB"),
});

export type ImportFileDTO = z.infer<typeof importFileSchema>;

/**
 * 多维组合查询筛选契约
 */
export const filterCluesSchema = z.object({
  region: z.string().optional(),
  type: z.string().optional(),
  riskLevel: z.string().optional(),
  status: z.string().optional(),
  keyword: z.string().optional(),
  anomalyTag: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  department: z.string().optional(),
  handler: z.string().optional(),
  onlyMyPending: z.boolean().optional(),
});

export type FilterCluesDTO = z.infer<typeof filterCluesSchema>;
