"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { importCluesAction } from "@/app/actions/clues";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    totalRows: number;
    importedCount: number;
    skippedCount: number;
    skippedRows: { row: number; clueNo?: string; reason: string }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        线索编号: "CLUE-2026-001",
        发现日期: "2026-11-01",
        所属区域: "城东区",
        线索来源: "日常检查",
        线索类型: "许可证异常",
        经营对象: "诚信便民烟酒超市",
        风险等级: "高",
        涉及金额: 120000,
        责任部门: "专卖稽查一队",
        责任人: "张三",
        办理期限: "2026-11-20",
        是否需要复核: "是",
      },
      {
        线索编号: "CLUE-2026-002",
        发现日期: "2026-11-02",
        所属区域: "城东区",
        线索来源: "群众举报",
        线索类型: "经营异常",
        经营对象: "百顺烟酒商行",
        风险等级: "中",
        涉及金额: 35000,
        责任部门: "专卖稽查一队",
        责任人: "李四",
        办理期限: "2026-11-15",
        是否需要复核: "否",
      },
      {
        线索编号: "CLUE-2026-003",
        发现日期: "2026-11-03",
        所属区域: "城南区",
        线索来源: "数据分析",
        线索类型: "价格异常",
        经营对象: "诚信便民烟酒超市",
        风险等级: "中",
        涉及金额: 8000,
        责任部门: "专卖稽查二队",
        责任人: "王五",
        办理期限: "2026-11-05",
        是否需要复核: "是",
      },
      {
        线索编号: "CLUE-2026-004",
        发现日期: "2026-11-04",
        所属区域: "城西区",
        线索来源: "系统预警",
        线索类型: "配送异常",
        经营对象: "宏达便利店",
        风险等级: "低",
        涉及金额: 5000,
        责任部门: "",
        责任人: "",
        办理期限: "",
        是否需要复核: "否",
      },
      {
        线索编号: "CLUE-2026-005",
        发现日期: "2026-11-05",
        所属区域: "城东区",
        线索来源: "部门移交",
        线索类型: "非法收购",
        经营对象: "环球礼品回收店",
        风险等级: "高",
        涉及金额: 150000,
        责任部门: "",
        责任人: "",
        办理期限: "",
        是否需要复核: "是",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "脱敏线索台账模板");
    XLSX.writeFile(wb, "专卖监管线索导入脱敏模板.xlsx");
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg("请先选择或拖拽文件");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await importCluesAction(formData);
    setIsUploading(false);

    if (!res.ok) {
      setErrorMsg(res.error || "导入失败");
    } else {
      setResult({
        totalRows: res.totalRows || 0,
        importedCount: res.importedCount || 0,
        skippedCount: res.skippedCount || 0,
        skippedRows: res.skippedRows || [],
      });
      onSuccess();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>导入脱敏 Excel 线索台账</DialogTitle>
          <DialogDescription>
            支持基于“线索编号”自动 Upsert 增量入库与行级容错
          </DialogDescription>
        </DialogHeader>

        {/* 模板下载 */}
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-xs">
          <span className="text-slate-600 dark:text-slate-300">
            初次使用建议下载标准字段模板：
          </span>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-7 text-xs">
            📥 下载脱敏模板
          </Button>
        </div>

        {/* 文件选择区 */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setFile(e.target.files[0]);
                setErrorMsg(null);
                setResult(null);
              }
            }}
          />
          <div className="text-3xl mb-2">📊</div>
          {file ? (
            <div>
              <div className="font-semibold text-sm text-emerald-600">{file.name}</div>
              <div className="text-xs text-slate-400 mt-1">
                {(file.size / 1024).toFixed(1)} KB · 点击可重新选择
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                点击选择或将 Excel 文件拖拽至此
              </div>
              <div className="text-xs text-slate-400 mt-1">
                支持 .xlsx / .xls / .csv 格式（自动对齐中文字段）
              </div>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        {/* 导入结果面板 */}
        {result && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs space-y-2">
            <div className="font-semibold text-emerald-700 dark:text-emerald-400">
              🎉 导入处理完成：成功入库 {result.importedCount} 条
              {result.skippedCount > 0 && `，跳过异常 ${result.skippedCount} 条`}
            </div>
            {result.skippedRows.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1 border-t border-emerald-200 dark:border-emerald-800 text-[11px] text-slate-600 dark:text-slate-300">
                {result.skippedRows.map((s, i) => (
                  <div key={i}>
                    行 {s.row}
                    {s.clueNo ? ` (${s.clueNo})` : ""}: {s.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isUploading}>
            关闭
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isUploading ? "正在解析导入..." : "开始批量入库"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
