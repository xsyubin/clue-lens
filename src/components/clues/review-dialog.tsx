"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { reviewClueAction } from "@/app/actions/clues";
import { useCurrentRole } from "@/components/role-switcher";

interface ReviewDialogProps {
  clueId: string;
  clueNo: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewDialog({
  clueId,
  clueNo,
  isOpen,
  onClose,
  onSuccess,
}: ReviewDialogProps) {
  const { currentRole } = useCurrentRole();
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (action === "REJECT" && !comment.trim()) {
      setErrorMsg("复核驳回时必须录入驳回原因");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await reviewClueAction({
      clueId,
      action,
      comment: comment.trim() || undefined,
    });

    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || "审批失败");
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
              线索办理结果终审复核
            </h3>
            <p className="text-xs text-slate-500">线索编号: {clueNo}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              复核裁决意见
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="reviewAction"
                  checked={action === "APPROVE"}
                  onChange={() => setAction("APPROVE")}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  ✅ 复核通过 (流转至已完成)
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="reviewAction"
                  checked={action === "REJECT"}
                  onChange={() => setAction("REJECT")}
                  className="text-red-600 focus:ring-red-500"
                />
                <span className="font-semibold text-red-700 dark:text-red-400">
                  ❌ 驳回退回 (退回办理中)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              复核意见说明 {action === "REJECT" && <span className="text-red-500">* (驳回必填)</span>}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                action === "APPROVE"
                  ? "选填：经查材料齐全、执法程序规范，准予通过办结..."
                  : "必填：请说明驳回原因，例如：缺少现场抽样笔录、涉案卷烟未鉴别真伪..."
              }
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
              required={action === "REJECT"}
            />
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
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className={
                action === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {isSubmitting ? "正在提交..." : action === "APPROVE" ? "确认通过" : "确认驳回"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
