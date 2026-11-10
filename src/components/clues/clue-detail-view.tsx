"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MonopolyClue, ClueTimelineLog } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/components/role-switcher";
import { DispatchDialog } from "./dispatch-dialog";
import { HandlingForm } from "./handling-form";
import { ReviewDialog } from "./review-dialog";
import { AdvisoryCard } from "./advisory-card";
import { TimelineView } from "./timeline-view";
import { closeClueAction } from "@/app/actions/clues";

interface ClueDetailViewProps {
  clue: MonopolyClue;
  timeline: ClueTimelineLog[];
}

const STATUS_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  PENDING_ASSIGN: {
    label: "待分派",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    desc: "线索已建档录入，等待综合管理人员指定核查部门与责任人",
  },
  IN_PROGRESS: {
    label: "办理中",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    desc: "核查人员现场勘查核验中，待提交核查结论与处置措施",
  },
  PENDING_REVIEW: {
    label: "待复核",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    desc: "核查结论已提交，等待部门负责人审批复核",
  },
  COMPLETED: {
    label: "已完成",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    desc: "核查并复核完毕，等待终审归档结案",
  },
  CLOSED: {
    label: "已关闭",
    color: "bg-slate-100 text-slate-600 border-slate-300",
    desc: "线索已全生命周期结案归档",
  },
};

const RISK_MAP: Record<string, string> = {
  高: "bg-red-50 text-red-600 border-red-200",
  中: "bg-amber-50 text-amber-600 border-amber-200",
  低: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

export function ClueDetailView({ clue, timeline }: ClueDetailViewProps) {
  const router = useRouter();
  const { currentRole } = useCurrentRole();

  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // 辅助处置建议一键采纳填入措施
  const [adoptedMeasures, setAdoptedMeasures] = useState<string>("");

  const statusInfo = STATUS_LABELS[clue.status] || {
    label: clue.status,
    color: "bg-slate-100 text-slate-700",
    desc: "",
  };

  const handleClose = async () => {
    setIsClosing(true);
    setCloseError(null);
    const res = await closeClueAction({
      clueId: clue.id,
      closeReason: closeReason.trim() || "核查处置完成，符合结案归档规范",
    });
    setIsClosing(false);

    if (!res.ok) {
      setCloseError(res.error || "归档失败");
    } else {
      setShowCloseModal(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部导航与操作指示 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/clues"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            ← 返回台账工作台
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
            {clue.clueNo}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              RISK_MAP[clue.riskLevel] || ""
            }`}
          >
            {clue.riskLevel}风险
          </span>
        </div>

        <div className="text-xs text-slate-500">
          当前演示身份：
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {currentRole}
          </span>
        </div>
      </div>

      {/* 核心两列布局：左侧信息与工作流，右侧处置建议与时间轴 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* 左侧 2 列：线索基础信息与办理操作 */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* 基础档案卡片 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {clue.targetName}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  线索来源：{clue.source} · 发现日期：{clue.discoveryDate}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">涉案金额</div>
                <div className="text-base font-mono font-bold text-red-600 dark:text-red-400">
                  {clue.amount ? `¥${clue.amount.toLocaleString()}` : "未涉案"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">所属区域</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {clue.region}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">线索类型</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {clue.type}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">责任部门</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {clue.department || "未指定"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">责任经办人</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {clue.handler || "未分派"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">办理期限</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {clue.deadline || "未限定"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">是否需要复核</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {clue.needReview ? "是（办结后经负责人复核）" : "否（办结即闭环）"}
                </span>
              </div>
            </div>

            {/* 核查与办理既有记录 */}
            {(clue.checkResult || clue.measures || clue.reviewComment) && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  核查办理已登记信息
                </h4>
                {clue.checkDate && (
                  <div className="text-xs text-slate-500">
                    核查日期：<span className="font-medium text-slate-700">{clue.checkDate}</span>
                  </div>
                )}
                {clue.checkResult && (
                  <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      现场核查结论：
                    </span>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">{clue.checkResult}</p>
                  </div>
                )}
                {clue.measures && (
                  <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      采取处置措施：
                    </span>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">{clue.measures}</p>
                  </div>
                )}
                {clue.reviewComment && (
                  <div className="text-xs bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg border border-purple-200 dark:border-purple-900/50">
                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      复核审批意见：
                    </span>
                    <p className="mt-1 text-purple-800 dark:text-purple-200">{clue.reviewComment}</p>
                  </div>
                )}
                {clue.closeReason && (
                  <div className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-700">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      归档结案理由：
                    </span>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">{clue.closeReason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 状态流转操作台 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  工作流办理操作
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{statusInfo.desc}</p>
              </div>
            </div>

            {/* 1. 待分派阶段 */}
            {clue.status === "PENDING_ASSIGN" && (
              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-xs text-blue-900 dark:text-blue-300">
                    👉 需综合管理人员分派任务
                  </div>
                  <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
                    设定责任部门、办理时限及复核流程
                  </div>
                </div>
                <Button
                  onClick={() => setIsDispatchOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4"
                >
                  🚀 执行分派
                </Button>
              </div>
            )}

            {/* 2. 办理中阶段 */}
            {clue.status === "IN_PROGRESS" && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                  📝 请填写现场核查记录。如右侧生成了处置建议，可点击“采纳处置措施”一键填入。
                </div>
                <HandlingForm
                  clueId={clue.id}
                  initialMeasures={adoptedMeasures}
                  needReview={Boolean(clue.needReview)}
                  onSuccess={() => {
                    router.refresh();
                  }}
                />
              </div>
            )}

            {/* 3. 待复核阶段 */}
            {clue.status === "PENDING_REVIEW" && (
              <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-xs text-purple-900 dark:text-purple-300">
                    🔍 待部门负责人审批复核
                  </div>
                  <div className="text-[11px] text-purple-700 dark:text-purple-400 mt-1">
                    核验核查结果与措施；通过则准予办结，驳回则回退核查人二次整改
                  </div>
                </div>
                <Button
                  onClick={() => setIsReviewOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4"
                >
                  ⚖️ 审批复核
                </Button>
              </div>
            )}

            {/* 4. 已完成阶段 */}
            {clue.status === "COMPLETED" && (
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-xs text-emerald-900 dark:text-emerald-300">
                    ✅ 核查已完毕，待归档结案
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                    全流程规范符合结案标准，部门负责人可终审闭环
                  </div>
                </div>
                <Button
                  onClick={() => setShowCloseModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4"
                >
                  📦 终审归档
                </Button>
              </div>
            )}

            {/* 5. 已关闭终态 */}
            {clue.status === "CLOSED" && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                🔒 本线索已全部闭环归档，所有流转记录均已不可逆审计留痕。
              </div>
            )}
          </div>
        </div>

        {/* 右侧 1 列：处置建议与流转时间轴 */}
        <div className="space-y-6 min-w-0">
          {/* 双模建议卡片 */}
          <AdvisoryCard
            clueId={clue.id}
            clueStatus={clue.status}
            onAdoptMeasures={(m) => {
              setAdoptedMeasures(m);
            }}
          />

          {/* 流转时间轴 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                全生命周期流转时间轴
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {timeline.length} 条记录
              </Badge>
            </div>
            <TimelineView timeline={timeline} />
          </div>
        </div>
      </div>

      {/* 分派弹窗 */}
      <DispatchDialog
        clueId={clue.id}
        clueNo={clue.clueNo}
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        onSuccess={() => {
          setIsDispatchOpen(false);
          router.refresh();
        }}
      />

      {/* 复核审批弹窗 */}
      <ReviewDialog
        clueId={clue.id}
        clueNo={clue.clueNo}
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onSuccess={() => {
          setIsReviewOpen(false);
          router.refresh();
        }}
      />

      {/* 归档结案弹窗 */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              确认归档结案
            </h3>
            <p className="text-xs text-slate-500">
              归档后线索状态将变更为终态【已关闭】，不可再发起办理流转。
            </p>

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                归档备注说明
              </label>
              <textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="例如：现场核查与复核程序已全部履行完毕，准予归档"
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {closeError && (
              <div className="p-2.5 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200">
                {closeError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                disabled={isClosing}
                onClick={() => setShowCloseModal(false)}
                className="text-xs"
              >
                取消
              </Button>
              <Button
                disabled={isClosing}
                onClick={handleClose}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {isClosing ? "归档中..." : "确认归档"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
