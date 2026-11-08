import * as XLSX from "xlsx";
import { importClueRowSchema, type ImportClueRowDTO } from "./validations/clue";

export interface ParseResult {
  success: boolean;
  totalRows: number;
  validRows: ImportClueRowDTO[];
  skippedRows: { row: number; clueNo?: string; reason: string }[];
  error?: string;
}

/**
 * 中文字段与标准模型映射词典
 */
const HEADER_MAPPINGS: Record<string, keyof ImportClueRowDTO> = {
  线索编号: "clueNo",
  编号: "clueNo",
  clueNo: "clueNo",
  clueno: "clueNo",

  发现日期: "discoveryDate",
  发现时间: "discoveryDate",
  日期: "discoveryDate",
  discoveryDate: "discoveryDate",

  所属区域: "region",
  区域: "region",
  辖区: "region",
  region: "region",

  线索来源: "source",
  来源: "source",
  source: "source",

  线索类型: "type",
  类型: "type",
  异常类型: "type",
  type: "type",

  经营对象: "targetName",
  经营主体: "targetName",
  涉案对象: "targetName",
  商户名称: "targetName",
  targetName: "targetName",

  风险等级: "riskLevel",
  等级: "riskLevel",
  风险: "riskLevel",
  riskLevel: "riskLevel",

  涉及金额: "amount",
  涉案金额: "amount",
  金额: "amount",
  amount: "amount",

  责任部门: "department",
  部门: "department",
  department: "department",

  责任人: "handler",
  承办人: "handler",
  handler: "handler",

  办理期限: "deadline",
  时限: "deadline",
  截止日期: "deadline",
  deadline: "deadline",

  是否需要复核: "needReview",
  需复核: "needReview",
  复核: "needReview",
  needReview: "needReview",

  办理状态: "status",
  状态: "status",
  status: "status",

  核查时间: "checkDate",
  核查日期: "checkDate",
  checkDate: "checkDate",

  核查结果: "checkResult",
  核查结论: "checkResult",
  checkResult: "checkResult",

  处置措施: "measures",
  处理方式: "measures",
  措施: "measures",
  measures: "measures",

  复核意见: "reviewComment",
  复核结论: "reviewComment",
  reviewComment: "reviewComment",
};

/**
 * 流式解析 Excel / CSV 二进制内容
 */
export function parseCluesExcel(fileBuffer: Buffer | ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { success: false, totalRows: 0, validRows: [], skippedRows: [], error: "Excel 中未包含有效工作表" };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    // 读取为原始对象数组
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

    if (!rawData || rawData.length === 0) {
      return { success: false, totalRows: 0, validRows: [], skippedRows: [], error: "Excel 文件内容为空" };
    }

    const validRows: ImportClueRowDTO[] = [];
    const skippedRows: { row: number; clueNo?: string; reason: string }[] = [];

    // 逐行对齐表头并校验
    rawData.forEach((row, index) => {
      const rowNumber = index + 2; // 表头通常在第 1 行，数据从第 2 行开始
      const normalizedRow: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(row)) {
        const cleanKey = key.trim();
        const mappedField = HEADER_MAPPINGS[cleanKey];
        if (mappedField) {
          // 处理日期格式转换为 YYYY-MM-DD
          if (val instanceof Date) {
            normalizedRow[mappedField] = val.toISOString().split("T")[0];
          } else if (typeof val === "string") {
            normalizedRow[mappedField] = val.trim();
          } else {
            normalizedRow[mappedField] = val;
          }
        }
      }

      // 处理布尔型 needReview
      if (typeof normalizedRow.needReview === "string") {
        const strVal = (normalizedRow.needReview as string).toLowerCase();
        normalizedRow.needReview = strVal === "是" || strVal === "true" || strVal === "1";
      }

      // 执行 Zod 安全校验
      const parsed = importClueRowSchema.safeParse(normalizedRow);
      if (parsed.success) {
        validRows.push(parsed.data);
      } else {
        const errorMsg = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
        skippedRows.push({
          row: rowNumber,
          clueNo: (normalizedRow.clueNo as string) || undefined,
          reason: errorMsg || "数据字段格式非法",
        });
      }
    });

    return {
      success: true,
      totalRows: rawData.length,
      validRows,
      skippedRows,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "文件解析故障";
    return {
      success: false,
      totalRows: 0,
      validRows: [],
      skippedRows: [],
      error: `Excel 解析失败: ${message}`,
    };
  }
}
