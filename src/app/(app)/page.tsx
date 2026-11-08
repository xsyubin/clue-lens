import Link from "next/link";
import { getDashboardDataAction } from "@/app/actions/clues";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const data = await getDashboardDataAction();
  const stats = data.stats || {
    total: 0,
    highRisk: 0,
    pending: 0,
    overdue: 0,
    areaDistribution: [],
    typeDistribution: [],
  };
  const clues = data.clues || [];

  // 提取高危重复出现主体
  const targetMap = new Map<string, number>();
  for (const c of clues) {
    targetMap.set(c.targetName, (targetMap.get(c.targetName) || 0) + 1);
  }
  const repeatTargets = Array.from(targetMap.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 提取超期事项
  const overdueClues = clues.filter((c) =>
    c.anomalyTags.some((t) => t.code === "OVERDUE")
  );

  return (
    <div className="space-y-6">
      {/* 头部标题与快捷入口 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
            专卖监管线索宏观态势大盘
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            实时汇聚监管线索台账 · 自动识别异常特征 · 穿透全生命周期闭环办理
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/clues"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            📋 进入线索工作台
          </Link>
        </div>
      </div>

      {/* 4 大核心指标卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500 font-medium">全库线索总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
              {stats.total}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">台账集中纳管</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500 font-medium">高风险线索</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-red-600 dark:text-red-400">
              {stats.highRisk}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              占比约 {stats.total > 0 ? ((stats.highRisk / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500 font-medium">流转待办理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {stats.pending}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">待分派 / 办理 / 待复核</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-600 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-slate-500 font-medium">办理超期预警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {stats.overdue}
            </div>
            <p className="text-[11px] text-rose-500 mt-1">
              {stats.overdue > 0 ? "需重点督促催办" : "暂无超期事项"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 区域与类型分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 问题类型 TOP 榜 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center justify-between">
            <span>📊 线索类型分布 (TOP 榜)</span>
            <span className="text-xs font-normal text-slate-400">按数量降序</span>
          </h3>

          <div className="space-y-3">
            {stats.typeDistribution.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">暂无数据</div>
            ) : (
              stats.typeDistribution
                .sort((a, b) => b.count - a.count)
                .slice(0, 6)
                .map((item, idx) => {
                  const pct = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
                  return (
                    <div key={item.type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {idx + 1}. {item.type}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {item.count} 条 ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* 区域分布柱状展示 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center justify-between">
            <span>🗺️ 区域线索分布与集聚度</span>
            <span className="text-xs font-normal text-slate-400">各片区执法热度</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stats.areaDistribution.length === 0 ? (
              <div className="col-span-full text-center py-8 text-xs text-slate-400">
                暂无区域数据
              </div>
            ) : (
              stats.areaDistribution.map((item) => (
                <div
                  key={item.area}
                  className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center space-y-1"
                >
                  <div className="text-xs text-slate-500">{item.area}</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {item.count} <span className="text-[10px] font-normal text-slate-400">条</span>
                  </div>
                  {item.count >= 5 && (
                    <Badge variant="warning" className="text-[10px]">
                      集中出现
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 预警与重点监控专区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 重复经营主体 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>🔥 重点监控涉案商户 (累犯频次 $\ge 2$)</span>
            </h3>
            <span className="text-xs text-slate-400">规则引擎自动侦测</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {repeatTargets.length === 0 ? (
              <div className="py-6 text-center text-slate-400">暂无重复涉案主体</div>
            ) : (
              repeatTargets.map(([name, count]) => (
                <div key={name} className="py-2.5 flex items-center justify-between">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {name}
                  </div>
                  <Badge variant="danger" className="text-xs">
                    累计涉案 {count} 次
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 办理超期警示 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>🚨 办理超期催办清单</span>
            </h3>
            <span className="text-xs text-rose-500 font-medium">
              共 {overdueClues.length} 项超期
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {overdueClues.length === 0 ? (
              <div className="py-6 text-center text-slate-400">太棒了，目前没有超期线索！</div>
            ) : (
              overdueClues.slice(0, 5).map((clue) => (
                <Link
                  key={clue.id}
                  href={`/clues/${clue.id}`}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1.5 transition-colors"
                >
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {clue.clueNo} · {clue.targetName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      承办人: {clue.handler || "未指定"} · 截止时限: {clue.deadline}
                    </div>
                  </div>
                  <Badge variant="danger" className="text-[10px]">
                    立即办理 $\rightarrow$
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
