import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskMobile } from "../lib/utils";

describe("数据脱敏工具 maskMobile 单元测试", () => {
  it("标准 11 位中国大陆手机号正确脱敏（前3后4，中间4位星号）", () => {
    assert.strictEqual(maskMobile("13812345678"), "138****5678");
    assert.strictEqual(maskMobile("18900001111"), "189****1111");
  });

  it("带首尾空白字符自动修剪并正确脱敏", () => {
    assert.strictEqual(maskMobile("  13912345678  "), "139****5678");
  });

  it("长号码 (>7位但非11位) 保留前3后4脱敏", () => {
    assert.strictEqual(maskMobile("01012345678"), "010****5678");
    assert.strictEqual(maskMobile("02188889999"), "021****9999");
  });

  it("短号码 (4-7位) 保留前2后2脱敏", () => {
    assert.strictEqual(maskMobile("1234"), "12**34");
    assert.strictEqual(maskMobile("123456"), "12**56");
  });

  it("极短号码 (<4位) 全掩码兜底", () => {
    assert.strictEqual(maskMobile("123"), "***");
    assert.strictEqual(maskMobile("8"), "***");
  });

  it("空值与 null / undefined 安全兜底返回空字符串", () => {
    assert.strictEqual(maskMobile(""), "");
    assert.strictEqual(maskMobile(null), "");
    assert.strictEqual(maskMobile(undefined), "");
  });
});
