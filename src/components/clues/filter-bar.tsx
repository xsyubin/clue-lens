"use client";

import React from "react";
import { CLUE_STATUSES, CLUE_TYPES, RISK_LEVELS } from "@/lib/validations/clue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FilterState {
  region: string;
  type: string;
  riskLevel: string;
  status: string;
  anomalyTag: string;
  keyword: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  regions: string[];
  types: string[];
}

export function FilterBar({ filters, onChange, regions, types }: FilterBarProps) {
  const handleFieldChange = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const handleReset = () => {
    onChange({
      region: "",
      type: "",
      riskLevel: "",
      status: "",
      anomalyTag: "",
      keyword: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 关键字搜索 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">对象/编号搜索</label>
          <Input
            placeholder="搜索商户名或编号..."
            value={filters.keyword}
            onChange={(e) => handleFieldChange("keyword", e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* 所属区域 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">所属区域</label>
          <select
            value={filters.region}
            onChange={(e) => handleFieldChange("region", e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部区域</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* 线索类型 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">线索类型</label>
          <select
            value={filters.type}
            onChange={(e) => handleFieldChange("type", e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部类型</option>
            {(types.length > 0 ? types : CLUE_TYPES).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* 风险等级 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">风险等级</label>
          <select
            value={filters.riskLevel}
            onChange={(e) => handleFieldChange("riskLevel", e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部风险</option>
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}风险
              </option>
            ))}
          </select>
        </div>

        {/* 办理状态 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">办理状态</label>
          <select
            value={filters.status}
            onChange={(e) => handleFieldChange("status", e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部状态</option>
            {CLUE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st === "PENDING_ASSIGN" && "待分派"}
                {st === "IN_PROGRESS" && "办理中"}
                {st === "PENDING_REVIEW" && "待复核"}
                {st === "COMPLETED" && "已完成"}
                {st === "CLOSED" && "已关闭"}
              </option>
            ))}
          </select>
        </div>

        {/* 异常预警标签 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">异常预警特征</label>
          <select
            value={filters.anomalyTag}
            onChange={(e) => handleFieldChange("anomalyTag", e.target.value)}
            className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部标签</option>
            <option value="REPEAT_TARGET">🔥 重复经营对象</option>
            <option value="REGION_CONCENTRATED">⚠️ 区域短期集中</option>
            <option value="TYPE_REPEATED">📌 同类问题连发</option>
            <option value="AMOUNT_ABNORMAL">💰 涉案金额异常</option>
            <option value="OVERDUE">🚨 办理超期预警</option>
            <option value="HIGH_RISK_UNASSIGNED">⚡ 高危待派线索</option>
          </select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-400">已应用自定义筛选条件</span>
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs text-slate-600">
            清空重置
          </Button>
        </div>
      )}
    </div>
  );
}
