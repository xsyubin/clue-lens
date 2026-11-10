"use client";

import React from "react";
import { CLUE_STATUSES, CLUE_TYPES, RISK_LEVELS } from "@/lib/validations/clue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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
      keyword: "",
      region: "",
      type: "",
      riskLevel: "",
      status: "",
      anomalyTag: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => Boolean(v));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 关键字搜索 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">关键字检索</label>
          <Input
            placeholder="搜索线索编号/经营对象/案由..."
            value={filters.keyword}
            onChange={(e) => handleFieldChange("keyword", e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        {/* 所属区域 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">所属区域</label>
          <Select
            value={filters.region || "ALL"}
            onValueChange={(val) => handleFieldChange("region", val === "ALL" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部区域" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部区域</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 线索类型 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">线索类型</label>
          <Select
            value={filters.type || "ALL"}
            onValueChange={(val) => handleFieldChange("type", val === "ALL" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部类型</SelectItem>
              {(types.length > 0 ? types : CLUE_TYPES).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 风险等级 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">风险等级</label>
          <Select
            value={filters.riskLevel || "ALL"}
            onValueChange={(val) => handleFieldChange("riskLevel", val === "ALL" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部风险" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部风险</SelectItem>
              {RISK_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}风险
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 办理状态 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">办理状态</label>
          <Select
            value={filters.status || "ALL"}
            onValueChange={(val) => handleFieldChange("status", val === "ALL" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部状态</SelectItem>
              {CLUE_STATUSES.map((st) => (
                <SelectItem key={st} value={st}>
                  {st === "PENDING_ASSIGN" && "待分派"}
                  {st === "IN_PROGRESS" && "办理中"}
                  {st === "PENDING_REVIEW" && "待复核"}
                  {st === "COMPLETED" && "已完成"}
                  {st === "CLOSED" && "已关闭"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 异常预警标签 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">异常预警特征</label>
          <Select
            value={filters.anomalyTag || "ALL"}
            onValueChange={(val) => handleFieldChange("anomalyTag", val === "ALL" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部标签</SelectItem>
              <SelectItem value="REPEAT_TARGET">🔥 重复经营对象</SelectItem>
              <SelectItem value="REGION_CONCENTRATED">⚠️ 区域短期集中</SelectItem>
              <SelectItem value="TYPE_REPEATED">📌 同类问题连发</SelectItem>
              <SelectItem value="AMOUNT_ABNORMAL">💰 涉案金额异常</SelectItem>
              <SelectItem value="OVERDUE">🚨 办理超期预警</SelectItem>
              <SelectItem value="HIGH_RISK_UNASSIGNED">⚡ 高危待派线索</SelectItem>
            </SelectContent>
          </Select>
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
