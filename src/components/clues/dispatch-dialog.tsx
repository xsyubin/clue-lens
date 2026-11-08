"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dispatchClueAction } from "@/app/actions/clues";
import { useCurrentRole } from "@/components/role-switcher";

interface DispatchDialogProps {
  clueId: string;
  clueNo: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEPARTMENTS = [
  "专卖稽查一队",
  "专卖稽查二队",
  "专卖稽查三队",
  "城区分局专卖所",
  "市郊专卖监督所",
];

const HANDLERS: Record<string, string[]> = {
  专卖稽查一队: ["张三", "李四", "赵六"],
  专卖稽查二队: ["王五", "孙七", "周八"],
  专卖稽查三队: ["吴九", "郑十"],
  城区分局专卖所: ["陈所长", "刘专员"],
  市郊专卖监督所: ["林专员", "黄专员"],
};

export function DispatchDialog({
  clueId,
  clueNo,
  isOpen,
  onClose,
  onSuccess,
}: DispatchDialogProps) {
  const { currentRole } = useCurrentRole();
  const [department, setDepartment] = useState(DEPARTMENTS[0] || "");
  const [handler, setHandler] = useState(HANDLERS[DEPARTMENTS[0] || ""]?.[0] || "");
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!
  );
  const [needReview, setNeedReview] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeptChange = (dept: string) => {
    setDepartment(dept);
    const available = HANDLERS[dept] || [];
    setHandler(available[0] || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await dispatchClueAction({
      clueId,
      department,
      handler,
      deadline,
      needReview,
    });

    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || "分派失败");
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
              分派线索责任人
            </h3>
            <p className="text-xs text-slate-500">线索编号: {clueNo}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              承办责任部门
            </label>
            <select
              value={department}
              onChange={(e) => handleDeptChange(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              承办责任人员
            </label>
            <select
              value={handler}
              onChange={(e) => setHandler(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
            >
              {(HANDLERS[department] || []).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              要求办理期限 (YYYY-MM-DD)
            </label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="needReviewCheckbox"
              checked={needReview}
              onChange={(e) => setNeedReview(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="needReviewCheckbox" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              办结后需要部门负责人复核（推荐高/中风险线索勾选）
            </label>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md text-red-600 dark:text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? "正在分派..." : "确认分派"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
