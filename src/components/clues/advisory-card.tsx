"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { generateAdvisoryAction } from "@/app/actions/clues";
import { cleanAdvisoryText, type AdvisoryResult } from "@/lib/advisory-engine";

interface AdvisoryCardProps {
  clueId: string;
  clueStatus?: string;
  onAdoptMeasures?: (measures: string) => void;
}

/**
 * 智能拆分处置措施段落为带编号的步骤清单（支持换行、行内序号、中文序号与圆圈序号）
 */
function parseMeasuresToList(text: string): string[] {
  if (!text) return [];

  // 先清洗脏 URL 和外链
  const cleaned = cleanAdvisoryText(text);

  // 在标点或换行后的步骤序号前插入分隔符（支持行首或行内 "。2."、"；2."、"(2)" 等）
  const normalized = cleaned.replace(
    /([。；;\n]|^)\s*(?:(\d+)[\.、\s]+|(?:\((\d+)\)|（(\d+)）|\[(\d+)\])\s*|([①②③④⑤⑥⑦⑧⑨⑩])\s*|第([一二三四五六七八九十])条?[\.、：:\s]+)/g,
    (match, p1) => {
      const prefix = p1 ? (p1 === "\n" ? "" : p1 + "\n") : "";
      return prefix + "___STEP_BREAK___" + match.replace(/^[。；;\s]+/, "");
    }
  );

  let items = normalized
    .split("___STEP_BREAK___")
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length > 1) {
    return items.map((item) =>
      item
        .replace(
          /^(?:\d+[\.、\s]+|(?:\(\d+\)|（\d+）|\[\d+\])\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*|第[一二三四五六七八九十]条?[\.、：:\s]+)/,
          ""
        )
        .trim()
    );
  }

  // 兜底：按换行拆分
  const lines = cleaned
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return lines.length > 0
    ? lines.map((item) =>
        item
          .replace(
            /^(?:\d+[\.、\s]+|(?:\(\d+\)|（\d+）|\[\d+\])\s*|[①②③④⑤⑥⑦⑧⑨⑩]\s*)/,
            ""
          )
          .trim()
      )
    : [cleaned.trim()];
}

export function AdvisoryCard({ clueId, clueStatus, onAdoptMeasures }: AdvisoryCardProps) {
  const [loading, setLoading] = useState(false);
  const [advisory, setAdvisory] = useState<AdvisoryResult | null>(null);
  const [useAi, setUseAi] = useState(true);
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
      onAdoptMeasures(cleanAdvisoryText(advisory.measures));
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

  const measureItems = advisory ? parseMeasuresToList(advisory.measures) : [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3.5 text-xs min-w-0 overflow-hidden">
      {/* 头部区：自适应双行布局，杜绝窄容器挤压折行 */}
      <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/50 text-sm">
              💡
            </div>
            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
              双模辅助处置建议
            </h4>
          </div>

          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={loading}
            className="h-7.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shrink-0 px-3 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {useAi ? "AI推理中..." : "匹配中..."}
              </span>
            ) : advisory ? (
              "重新生成建议"
            ) : (
              "生成处置建议"
            )}
          </Button>
        </div>

        {/* 状态与模式切换条 */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-800 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] text-slate-400 font-medium shrink-0">研判来源：</span>
            {advisory ? (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 font-normal truncate max-w-full ${
                  advisory.source === "AI_ENHANCED"
                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800"
                    : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {advisory.source === "AI_ENHANCED"
                  ? `🤖 AI (${advisory.modelName || "大模型"})`
                  : "📚 内置专家规则"}
              </Badge>
            ) : (
              <span className="text-[11px] text-slate-400">尚未触发</span>
            )}
          </div>

          <label
            htmlFor="useAiCheckbox"
            className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 select-none whitespace-nowrap text-[11px] shrink-0"
          >
            <Checkbox
              id="useAiCheckbox"
              checked={useAi}
              onCheckedChange={(checked) => setUseAi(Boolean(checked))}
            />
            <span>启用 AI 大模型</span>
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-md text-red-600 text-xs flex items-center gap-1.5 min-w-0 break-words">
          <span>⚠️</span>
          <span className="min-w-0 break-words">{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-3 animate-pulse min-w-0">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="h-14 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="text-center text-[11px] text-slate-400 pt-1">
            {useAi ? "大模型正在深度研判涉案主体、金额量刑与排查举措..." : "正在匹配专卖知识库规约..."}
          </div>
        </div>
      ) : advisory ? (
        <div className="space-y-3.5 min-w-0">
          {advisory.fallbackReason && (
            <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg text-amber-800 dark:text-amber-300 text-xs flex items-start gap-1.5 min-w-0 break-words [overflow-wrap:anywhere]">
              <span className="text-sm leading-none shrink-0">⚠️</span>
              <span className="min-w-0 flex-1 break-words">{advisory.fallbackReason}</span>
            </div>
          )}

          {/* 1. 主攻方向卡片 */}
          <div className="rounded-xl bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900 border border-blue-100 dark:border-blue-900/40 p-3.5 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-semibold text-[11px]">
              <span>🎯</span>
              <span>处置主攻方向</span>
            </div>
            <div className="font-medium text-xs text-slate-800 dark:text-slate-100 leading-relaxed break-words [overflow-wrap:anywhere]">
              {cleanAdvisoryText(advisory.direction)}
            </div>
          </div>

          {/* 2. 执法排查步骤列表卡片 */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
              <span>📋</span>
              <span>执法排查与处置举措</span>
            </div>
            <div className="space-y-2 min-w-0">
              {measureItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs leading-relaxed min-w-0 overflow-hidden"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="text-slate-700 dark:text-slate-200 flex-1 min-w-0 break-words [overflow-wrap:anywhere]">
                    {cleanAdvisoryText(item)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. 适用法律法规卡片 */}
          <div className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 space-y-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
              <span>⚖️</span>
              <span>适用法律法规与追刑考量依据</span>
            </div>
            <div className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed break-words [overflow-wrap:anywhere]">
              {cleanAdvisoryText(advisory.legalBasis)}
            </div>
          </div>

          {/* 4. 现场重点排查要素 */}
          {advisory.focusPoints && advisory.focusPoints.length > 0 && (
            <div className="space-y-1.5 pt-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                <span>🔍</span>
                <span>现场重点排查要素</span>
              </div>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {advisory.focusPoints.map((pt, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 max-w-full break-words [overflow-wrap:anywhere]"
                  >
                    • {cleanAdvisoryText(pt)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {statusNotice && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-md text-amber-700 dark:text-amber-300 text-xs min-w-0 break-words">
              {statusNotice}
            </div>
          )}

          {onAdoptMeasures && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end min-w-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdopt}
                className={`text-xs h-7.5 px-3 transition-all cursor-pointer ${
                  adopted
                    ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 font-medium"
                    : "border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                }`}
              >
                {adopted ? "✓ 建议已采纳并填入表单" : "📥 采纳建议填入处置措施"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-slate-400 text-center py-6 px-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1 min-w-0">
          <div className="text-sm">💡</div>
          <div className="text-slate-500 font-medium">尚未生成处置建议</div>
          <div className="text-[11px] text-slate-400">
            点击上方“生成处置建议”，系统将根据案件特征调用大模型或专家库输出方案。
          </div>
        </div>
      )}
    </div>
  );
}
