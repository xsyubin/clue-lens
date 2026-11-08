"use client";

import React from "react";
import type { ClueTimelineLog } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

interface TimelineViewProps {
  timeline: ClueTimelineLog[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_ASSIGN: "待分派",
  IN_PROGRESS: "办理中",
  PENDING_REVIEW: "待复核",
  COMPLETED: "已完成",
  CLOSED: "已关闭",
};

function formatTimelineDate(raw: Date | number | string): string {
  let date: Date;
  if (raw instanceof Date) {
    if (raw.getFullYear() > 3000) {
      date = new Date(Math.floor(raw.getTime() / 1000));
    } else {
      date = raw;
    }
  } else {
    const num = Number(raw);
    if (!isNaN(num)) {
      date = num > 1e11 ? new Date(Math.floor(num / 1000)) : new Date(num * 1000);
    } else {
      date = new Date(raw);
    }
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function TimelineView({ timeline }: TimelineViewProps) {
  if (timeline.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed">
        暂无流转历史记录
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flow-root">
        <ul className="-mb-8">
          {timeline.map((item, idx) => {
            const isLast = idx === timeline.length - 1;
            const isReject = item.action === "REJECT";
            const isApprove = item.action === "APPROVE";
            const isDispatch = item.action === "DISPATCH";
            const isSubmit = item.action === "SUBMIT";

            const dateStr = formatTimelineDate(item.createdAt);

            return (
              <li key={item.id}>
                <div className="relative pb-8">
                  {!isLast && (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-700"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3 items-start">
                    <div>
                      <span
                        className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-slate-900 text-xs shadow-xs ${
                          isReject
                            ? "bg-red-500 text-white"
                            : isApprove
                            ? "bg-emerald-500 text-white"
                            : isDispatch
                            ? "bg-blue-500 text-white"
                            : isSubmit
                            ? "bg-amber-500 text-white"
                            : "bg-slate-500 text-white"
                        }`}
                      >
                        {isReject ? "驳" : isApprove ? "审" : isDispatch ? "派" : isSubmit ? "结" : "入"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                            {item.operatorName}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.operatorRole}
                          </Badge>
                          <Badge
                            variant={
                              isReject
                                ? "danger"
                                : isApprove
                                ? "success"
                                : isDispatch
                                ? "info"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {item.action === "IMPORT" && "数据导入"}
                            {item.action === "DISPATCH" && "分派责任人"}
                            {item.action === "SUBMIT" && "办理办结登记"}
                            {item.action === "APPROVE" && "终审复核通过"}
                            {item.action === "REJECT" && "复核审批驳回"}
                            {item.action === "CLOSE" && "归档结案"}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {dateStr}
                        </span>
                      </div>

                      <div className="mt-2 text-xs">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-400">状态跃迁:</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700">
                            {STATUS_LABELS[item.fromStatus || ""] || item.fromStatus || "初始录入"}
                          </span>
                          <span className="text-slate-400 font-bold">➔</span>
                          <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-medium border border-blue-200 dark:border-blue-900">
                            {STATUS_LABELS[item.toStatus] || item.toStatus}
                          </span>
                        </div>

                        {item.comment && (
                          <div
                            className={`p-2 rounded-lg mt-1 text-xs ${
                              isReject
                                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
                                : "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800"
                            }`}
                          >
                            <span className="font-semibold">
                              {isReject ? "驳回意见: " : "经办备注: "}
                            </span>
                            {item.comment}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
