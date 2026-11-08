"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitHandlingAction } from "@/app/actions/clues";
import { useCurrentRole } from "@/components/role-switcher";

interface HandlingFormProps {
  clueId: string;
  initialMeasures?: string;
  needReview: boolean;
  onSuccess: () => void;
}

export function HandlingForm({
  clueId,
  initialMeasures = "",
  needReview,
  onSuccess,
}: HandlingFormProps) {
  const { currentRole } = useCurrentRole();
  const [checkDate, setCheckDate] = useState(new Date().toISOString().split("T")[0]!);
  const [checkResult, setCheckResult] = useState("");
  const [measures, setMeasures] = useState(initialMeasures);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justAdopted, setJustAdopted] = useState(false);

  React.useEffect(() => {
    if (initialMeasures) {
      setMeasures(initialMeasures);
      setJustAdopted(true);
      const timer = setTimeout(() => setJustAdopted(false), 3000);
      const el = document.getElementById("handling-measures-input");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
      return () => clearTimeout(timer);
    }
  }, [initialMeasures]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkResult.trim()) {
      setErrorMsg("核查结论必填");
      return;
    }
    if (!measures.trim()) {
      setErrorMsg("处置措施必填");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await submitHandlingAction({
      clueId,
      checkDate,
      checkResult,
      measures,
      operatorRole: currentRole,
    });

    setIsSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || "提交失败");
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
          现场核查与处置登记
        </h4>
        <span className="text-[11px] text-slate-500">
          流转流向: {needReview ? "提交后将流转至【待复核】" : "无需复核，提交后将直接【办结已完成】"}
        </span>
      </div>

      <div>
        <label className="font-medium text-slate-700 dark:text-slate-300 mb-1 block">
          核查调查日期
        </label>
        <Input
          type="date"
          value={checkDate}
          onChange={(e) => setCheckDate(e.target.value)}
          className="h-8 text-xs max-w-xs"
          required
        />
      </div>

      <div>
        <label className="font-medium text-slate-700 dark:text-slate-300 mb-1 block">
          现场核查事实结论
        </label>
        <textarea
          rows={3}
          value={checkResult}
          onChange={(e) => setCheckResult(e.target.value)}
          placeholder="例如：经现场实地核查，当事人涉嫌无烟草专卖零售许可证销售卷烟，现场查扣涉案红双喜卷烟 12 条..."
          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-slate-700 dark:text-slate-300">
            采取处置措施
          </label>
          {justAdopted && (
            <span className="text-[11px] text-emerald-600 font-semibold animate-pulse">
              ✓ 已采纳建议并自动填入
            </span>
          )}
        </div>
        <textarea
          id="handling-measures-input"
          rows={4}
          value={measures}
          onChange={(e) => setMeasures(e.target.value)}
          placeholder="例如：下达限期责令整改通知书，现场查封扣押涉案卷烟，拟立案处罚..."
          className={`w-full rounded-md border p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none transition-all ${
            justAdopted
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20"
              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-primary"
          }`}
          required
        />
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md text-red-600 dark:text-red-400 text-xs">
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSubmitting ? "正在登记提交..." : "提交办理结果"}
        </Button>
      </div>
    </form>
  );
}
