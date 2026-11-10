"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { generateAdvisoryAction } from "@/app/actions/clues";
import type { AdvisoryResult } from "@/lib/advisory-engine";

interface AdvisoryCardProps {
  clueId: string;
  clueStatus?: string;
  onAdoptMeasures?: (measures: string) => void;
}

export function AdvisoryCard({ clueId, clueStatus, onAdoptMeasures }: AdvisoryCardProps) {
  const [loading, setLoading] = useState(false);
  const [advisory, setAdvisory] = useState<AdvisoryResult | null>(null);
  const [useAi, setUseAi] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adopted, setAdopted] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handleAdopt = () => {
    if (!advisory) return;

    if (clueStatus && clueStatus !== "IN_PROGRESS") {
      const STATUS_NAMES: Record<string, string> = {
        PENDING_ASSIGN: "待分派",
        PENDING_REVIEW: "待复核",
        COMPLETED: "已完成",
        CLOSED: "已关闭",
      };
      setStatusNotice(
        `当前线索处于【${STATUS_NAMES[clueStatus] || clueStatus}】状态。处置措施需在线索进入【办理中】状态时填报（可先在左侧执行分派）。`
      );
      setTimeout(() => setStatusNotice(null), 4000);
      return;
    }

    if (onAdoptMeasures) {
      onAdoptMeasures(advisory.measures);
      setAdopted(true);
      setStatusNotice(null);
      setTimeout(() => setAdopted(false), 2500);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await generateAdvisoryAction(clueId, useAi);
    setLoading(false);

    if (!res.ok || !res.advisory) {
      setErrorMsg(res.error || "生成建议失败");
    } else {
      setAdvisory(res.advisory);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
            双模辅助处置建议
          </h4>
          {advisory && (
            <Badge variant={advisory.source === "AI_ENHANCED" ? "default" : "secondary"} className="text-[10px]">
              {advisory.source === "AI_ENHANCED" ? "🤖 AI 深度研判" : "📚 内置专家规则"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 select-none">
            <Checkbox
              id="useAiCheckbox"
              checked={useAi}
              onCheckedChange={(checked) => setUseAi(Boolean(checked))}
            />
            <label htmlFor="useAiCheckbox" className="cursor-pointer text-xs">
              尝试 AI 大模型研判
            </label>
          </div>

          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={loading}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? "正在推理分析..." : advisory ? "重新生成建议" : "生成处置建议"}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md text-red-600 text-xs">
          {errorMsg}
        </div>
      )}

      {advisory ? (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3 border border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-slate-400 font-medium text-[11px]">处置建议主攻方向：</div>
            <div className="font-bold text-sm text-slate-800 dark:text-slate-100 mt-0.5">
              {advisory.direction}
            </div>
          </div>

          <div>
            <div className="text-slate-400 font-medium text-[11px]">执法排查与处置措施：</div>
            <div className="text-slate-700 dark:text-slate-200 mt-0.5 leading-relaxed whitespace-pre-line">
              {advisory.measures}
            </div>
          </div>

          <div>
            <div className="text-slate-400 font-medium text-[11px]">适用法律法规依据：</div>
            <div className="text-slate-600 dark:text-slate-300 mt-0.5 font-mono text-[11px]">
              {advisory.legalBasis}
            </div>
          </div>

          {advisory.focusPoints && advisory.focusPoints.length > 0 && (
            <div>
              <div className="text-slate-400 font-medium text-[11px]">现场重点排查要素：</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {advisory.focusPoints.map((pt, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    🔍 {pt}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {statusNotice && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-md text-amber-700 dark:text-amber-300 text-xs">
              {statusNotice}
            </div>
          )}

          {onAdoptMeasures && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdopt}
                className={`text-xs h-7 transition-all ${
                  adopted
                    ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 font-semibold"
                    : "border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {adopted ? "✓ 建议已采纳并自动填入左侧表单" : "📥 采纳建议填入处置措施"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-slate-400 text-center py-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
          点击右上角“生成处置建议”按钮，系统将根据线索类型、风险等级匹配专家库或调用 AI 输出建议方案。
        </div>
      )}
    </div>
  );
}
