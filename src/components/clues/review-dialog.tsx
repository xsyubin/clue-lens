"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { reviewClueAction } from "@/app/actions/clues";

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
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (action === "REJECT" && !comment.trim()) {
      setErrorMsg("驳回退回时，必须填写驳回原因说明");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await reviewClueAction({
      clueId,
      action,
      comment,
    });

    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || "复核失败");
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>线索办理结果终审复核</DialogTitle>
          <DialogDescription>线索编号: {clueNo}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs pt-1">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              复核裁决意见
            </label>
            <RadioGroup
              value={action}
              onValueChange={(val) => setAction(val as "APPROVE" | "REJECT")}
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2 cursor-pointer select-none">
                <RadioGroupItem
                  value="APPROVE"
                  id="review-approve"
                  variantColor="emerald"
                />
                <label
                  htmlFor="review-approve"
                  className="font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer flex items-center gap-1"
                >
                  <span>✅</span> 复核通过 (流转至已完成)
                </label>
              </div>

              <div className="flex items-center gap-2 cursor-pointer select-none">
                <RadioGroupItem
                  value="REJECT"
                  id="review-reject"
                  variantColor="red"
                />
                <label
                  htmlFor="review-reject"
                  className="font-semibold text-red-700 dark:text-red-400 cursor-pointer flex items-center gap-1"
                >
                  <span>❌</span> 驳回退回 (退回办理中)
                </label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              复核意见说明 {action === "REJECT" && <span className="text-red-500 font-bold">* (驳回必填)</span>}
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
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
      </DialogContent>
    </Dialog>
  );
}
