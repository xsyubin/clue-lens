import Link from "next/link";
import { notFound } from "next/navigation";
import { getClueDetailAction } from "@/app/actions/clues";
import { ClueDetailView } from "@/components/clues/clue-detail-view";

interface ClueDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClueDetailPage({ params }: ClueDetailPageProps) {
  const { id } = await params;
  const res = await getClueDetailAction(id);

  if (!res.ok || !res.clue) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <p className="text-4xl">🔎</p>
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
          未找到该专卖监管线索
        </h2>
        <p className="text-xs text-slate-500">该线索可能已被移除或编号错误</p>
        <div>
          <Link
            href="/clues"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
          >
            返回线索工作台
          </Link>
        </div>
      </div>
    );
  }

  return <ClueDetailView clue={res.clue} timeline={res.timeline || []} />;
}
