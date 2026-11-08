import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseCluesExcel } from "../lib/excel-parser";

test("Excel 解析与行级容错测试", async (t) => {
  await t.test("正常解析与中文字段对齐", () => {
    const mockData = [
      {
        线索编号: "CLUE-2026-001",
        发现日期: "2026-11-01",
        所属区域: "城东区",
        线索来源: "日常检查",
        线索类型: "许可证异常",
        经营对象: "诚信烟酒超市",
        风险等级: "高",
        涉及金额: 50000,
        责任部门: "稽查一队",
        责任人: "张三",
        办理期限: "2026-11-20",
        是否需要复核: "是",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(mockData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "线索台账");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const result = parseCluesExcel(buffer);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.validRows.length, 1);
    assert.strictEqual(result.skippedRows.length, 0);

    const first = result.validRows[0];
    assert.strictEqual(first?.clueNo, "CLUE-2026-001");
    assert.strictEqual(first?.targetName, "诚信烟酒超市");
    assert.strictEqual(first?.needReview, true);
    assert.strictEqual(first?.amount, 50000);
  });

  await t.test("行级容错跳过与错误明细记录", () => {
    const mockData = [
      {
        线索编号: "CLUE-VALID-01",
        发现日期: "2026-11-01",
        所属区域: "城东区",
        经营对象: "合规超市",
      },
      {
        // 缺少线索编号（必填项缺失）
        线索编号: "",
        发现日期: "2026-11-01",
        所属区域: "城东区",
        经营对象: "非法商贩",
      },
      {
        // 负数涉及金额（数值非法）
        线索编号: "CLUE-INVALID-02",
        发现日期: "2026-11-01",
        所属区域: "城东区",
        经营对象: "违规商贩",
        涉及金额: -500,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(mockData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "台账");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const result = parseCluesExcel(buffer);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.validRows.length, 1);
    assert.strictEqual(result.skippedRows.length, 2);

    assert.strictEqual(result.validRows[0]?.clueNo, "CLUE-VALID-01");
    assert.strictEqual(result.skippedRows[0]?.row, 3); // 第2条数据行对应第3行
    assert.strictEqual(result.skippedRows[1]?.clueNo, "CLUE-INVALID-02");
  });
});
