"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterBar, type FilterState } from "./filter-bar";
import { ImportModal } from "./import-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/components/role-switcher";
import { exportCluesAction, type ClueWithTags } from "@/app/actions/clues";

interface CluesWorkbenchProps {
  initialClues: ClueWithTags[];
  regions: string[];
  types: string[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING_ASSIGN: { label: "待分派", color: "bg-blue-50 text-blue-700 border-blue-200" },
  IN_PROGRESS: { label: "办理中", color: "bg-amber-50 text-amber-700 border-amber-200" },
  PENDING_REVIEW: { label: "待复核", color: "bg-purple-50 text-purple-700 border-purple-200" },
  COMPLETED: { label: "已完成", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CLOSED: { label: "已关闭", color: "bg-slate-100 text-slate-600 border-slate-300" },
};

const RISK_MAP: Record<string, string> = {
  高: "bg-red-50 text-red-600 border-red-200",
  中: "bg-amber-50 text-amber-600 border-amber-200",
  低: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

const TAG_TYPE_CLASSES: Record<string, string> = {
  danger: "bg-red-50 text-red-600 border-red-200",
  warning: "bg-amber-50 text-amber-600 border-amber-200",
  info: "bg-blue-50 text-blue-600 border-blue-200",
};

export function CluesWorkbench({ initialClues, regions, types }: CluesWorkbenchProps) {
  const router = useRouter();
  const { currentRole } = useCurrentRole();
  const [, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    region: "",
    type: "",
    riskLevel: "",
    status: "",
    anomalyTag: "",
    keyword: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // 客户端即时过滤
  const filteredClues = initialClues.filter((c) => {
    if (filters.region && c.region !== filters.region) return false;
    if (filters.type && c.type !== filters.type) return false;
    if (filters.riskLevel && c.riskLevel !== filters.riskLevel) return false;
    if (filters.status && c.status !== filters.status) return false;
    if (filters.keyword) {
      const kw = filters.keyword.trim().toLowerCase();
      const match =
        c.clueNo.toLowerCase().includes(kw) ||
        c.targetName.toLowerCase().includes(kw) ||
        c.region.toLowerCase().includes(kw);
      if (!match) return false;
    }
    if (filters.anomalyTag) {
      if (!c.anomalyTags.some((t) => t.code === filters.anomalyTag)) return false;
    }
    return true;
  });

  // 分页计算
  const totalItems = filteredClues.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const displayedClues = filteredClues.slice(startIndex, endIndex);

  // 导出处理
  const handleExport = async (format: "XLSX" | "MARKDOWN") => {
    try {
      setIsExporting(true);
      setExportError(null);
      const res = await exportCluesAction(format, filters);
      if (!res.ok) {
        setExportError(res.error || "导出失败");
        return;
      }

      if (format === "XLSX" && res.fileBase64) {
        const byteCharacters = atob(res.fileBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: res.contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "线索台账.xlsx";
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "MARKDOWN" && res.content) {
        const blob = new Blob([res.content], { type: res.contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "专卖监管线索研判报告.md";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "导出异常";
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部操作栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
              专卖监管线索工作台
            </h1>
            <Badge variant="outline" className="text-xs">
              共 {filteredClues.length} 条线索
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            线索全息档案汇聚 · 异常标签穿透分析 · 协同流转闭环跟踪
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 视图切换按钮 */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📋 表格
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === "card"
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              🗂️ 卡片
            </button>
          </div>

          {/* 导入台账按钮 */}
          <Button
            onClick={() => setIsImportOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-3.5 shadow-xs"
          >
            📥 导入台账
          </Button>

          {/* 导出下拉按钮组 */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              disabled={isExporting}
              onClick={() => handleExport("XLSX")}
              className="text-xs h-9 px-3 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              📊 导出 Excel
            </Button>
            <Button
              variant="outline"
              disabled={isExporting}
              onClick={() => handleExport("MARKDOWN")}
              className="text-xs h-9 px-3 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
            >
              📝 研判初稿 (MD)
            </Button>
          </div>
        </div>
      </div>

      {exportError && (
        <div className="p-3 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg">
          导出失败：{exportError}
        </div>
      )}

      {/* 复合筛选栏 */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        regions={regions}
        types={types}
      />

      {/* 列表主体区域 */}
      {filteredClues.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            暂无符合条件的监管线索
          </p>
          <p className="text-xs mt-1">您可以调整筛选条件，或通过右上角【导入台账】新增数据</p>
        </div>
      ) : viewMode === "table" ? (
        /* 表格视图 */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">线索编号</th>
                  <th className="py-3 px-4">经营对象</th>
                  <th className="py-3 px-4">区域 / 来源</th>
                  <th className="py-3 px-4">类型 / 金额</th>
                  <th className="py-3 px-4">风险 / 状态</th>
                  <th className="py-3 px-4">异常识别标签</th>
                  <th className="py-3 px-4">经办人 / 期限</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedClues.map((c) => {
                  const statusInfo = STATUS_MAP[c.status] || {
                    label: c.status,
                    color: "bg-slate-100 text-slate-700",
                  };
                  const riskColor = RISK_MAP[c.riskLevel] || "bg-slate-100 text-slate-700";

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {c.clueNo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {c.targetName}
                        </div>
                        <div className="text-[11px] text-slate-400">发现于 {c.discoveryDate}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300">{c.region}</div>
                        <div className="text-[11px] text-slate-400">{c.source}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300">{c.type}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {c.amount ? `¥${c.amount.toLocaleString()}` : "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${riskColor}`}
                          >
                            {c.riskLevel}风险
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {c.anomalyTags.length > 0 ? (
                            c.anomalyTags.map((tag) => (
                              <span
                                key={tag.code}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  TAG_TYPE_CLASSES[tag.type] || "bg-slate-100 text-slate-600"
                                }`}
                                title={tag.detail || tag.label}
                              >
                                {tag.label}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">无异常</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300">
                          {c.handler ? `${c.department || ""} · ${c.handler}` : "待指派"}
                        </div>
                        <div
                          className={`text-[11px] ${
                            c.anomalyTags.some((t) => t.code === "OVERDUE")
                              ? "text-red-500 font-semibold"
                              : "text-slate-400"
                          }`}
                        >
                          {c.deadline ? `截止: ${c.deadline}` : "无期限"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/clues/${c.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-xs transition-colors"
                        >
                          办理详情 ➔
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 卡片视图 */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedClues.map((c) => {
            const statusInfo = STATUS_MAP[c.status] || {
              label: c.status,
              color: "bg-slate-100 text-slate-700",
            };
            const riskColor = RISK_MAP[c.riskLevel] || "bg-slate-100 text-slate-700";

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      {c.clueNo}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {c.targetName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span>📍 {c.region}</span>
                      <span>·</span>
                      <span>{c.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${riskColor}`}
                    >
                      {c.riskLevel}风险
                    </span>
                    {c.amount ? (
                      <span className="text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                        ¥{c.amount.toLocaleString()}
                      </span>
                    ) : null}
                  </div>

                  {/* 异常标签 */}
                  <div className="flex flex-wrap gap-1">
                    {c.anomalyTags.map((t) => (
                      <span
                        key={t.code}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          TAG_TYPE_CLASSES[t.type] || "bg-slate-100 text-slate-600"
                        }`}
                        title={t.detail || t.label}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>

                  {/* 办理人与期限 */}
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span>经办：{c.handler || "未分派"}</span>
                    <span
                      className={
                        c.anomalyTags.some((t) => t.code === "OVERDUE")
                          ? "text-red-500 font-semibold"
                          : ""
                      }
                    >
                      {c.deadline ? `时限: ${c.deadline}` : "未设时限"}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={`/clues/${c.id}`}
                    className="w-full inline-flex justify-center items-center py-2 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-semibold border border-slate-200 hover:border-blue-200 transition-colors"
                  >
                    查看详情与办理流转 ➔
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 分页控制栏 */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <span>
              显示第 <strong className="text-slate-800 dark:text-slate-200">{startIndex + 1}</strong> 至{" "}
              <strong className="text-slate-800 dark:text-slate-200">{endIndex}</strong> 条，共{" "}
              <strong className="text-slate-800 dark:text-slate-200">{totalItems}</strong> 条
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <span>每页显示:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 text-xs cursor-pointer focus:outline-none"
              >
                <option value={5}>5 条</option>
                <option value={10}>10 条</option>
                <option value={20}>20 条</option>
                <option value={50}>50 条</option>
              </select>
            </div>
          </div>

          {/* 页码与翻页控制 */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="h-7 px-2 text-xs"
            >
              首页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2.5 text-xs"
            >
              ‹ 上一页
            </Button>

            <div className="flex items-center gap-1 px-1.5 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-100 font-mono">
                {safeCurrentPage}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-500 font-mono">{totalPages}</span>
              <span className="text-slate-400">页</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 px-2.5 text-xs"
            >
              下一页 ›
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="h-7 px-2 text-xs"
            >
              末页
            </Button>
          </div>
        </div>
      )}

      {/* 导入台账弹窗 */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          setIsImportOpen(false);
          startTransition(() => {
            router.refresh();
          });
        }}
      />
    </div>
  );
}
