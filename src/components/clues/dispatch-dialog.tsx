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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>分派线索责任人</DialogTitle>
          <DialogDescription>线索编号: {clueNo}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs pt-1">
          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              承办责任部门
            </label>
            <Select value={department} onValueChange={handleDeptChange}>
              <SelectTrigger>
                <SelectValue placeholder="请选择责任部门" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              承办责任人员
            </label>
            <Select value={handler} onValueChange={setHandler}>
              <SelectTrigger>
                <SelectValue placeholder="请选择责任人" />
              </SelectTrigger>
              <SelectContent>
                {(HANDLERS[department] || []).map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
              要求办理期限
            </label>
            <DatePicker
              value={deadline}
              onChange={setDeadline}
              placeholder="请选择办理期限"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="needReviewCheckbox"
              checked={needReview}
              onCheckedChange={(checked) => setNeedReview(Boolean(checked))}
            />
            <label
              htmlFor="needReviewCheckbox"
              className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            >
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
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? "正在分派..." : "确认分派"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
