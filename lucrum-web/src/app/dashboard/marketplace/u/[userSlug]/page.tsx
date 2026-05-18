"use client";

/**
 * Author profile (stub).
 *
 * Lists a marketplace author's active strategies + their aggregate fork
 * and subscriber counts. Skeleton page — currently only `system:lucrum-curator`
 * has rows; user-published profiles will populate as the marketplace grows.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import type { MarketplaceStrategy } from "@/components/marketplace/strategy-card";
import { PanelSkeleton } from "@/components/ui/loading-skeleton";

interface AuthorData {
  authorUserId: string;
  totalForks: number;
  totalSubscribers: number;
  strategies: MarketplaceStrategy[];
}

export default function AuthorProfilePage() {
  const params = useParams<{ userSlug: string }>();
  const slug = params?.userSlug;
  const [data, setData] = useState<AuthorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    // The author page reuses /api/lurus/marketplace/list, filtering client-side
    // by authorUserId. A dedicated endpoint can replace this if the catalog grows.
    fetch(`/api/lurus/marketplace/list?limit=50`)
      .then((r) => r.json())
      .then((res) => {
        const list = (res.strategies ?? []) as MarketplaceStrategy[];
        const decoded = decodeURIComponent(slug);
        const mine = list.filter((s) => s.authorUserId === decoded);
        const totalForks = mine.reduce((acc, s) => acc + (s.forkCount ?? 0), 0);
        const totalSubscribers = mine.reduce(
          (acc, s) => acc + (s.totalSubscribers ?? 0),
          0,
        );
        setData({
          authorUserId: decoded,
          totalForks,
          totalSubscribers,
          strategies: mine,
        });
      })
      .catch((err) => {
        console.warn("[author-profile] fetch failed:", err);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading || !data ? (
          <PanelSkeleton />
        ) : (
          <>
            <header className="mb-6">
              <h1 className="text-xl font-bold text-white mb-1">作者主页</h1>
              <p className="text-sm text-white/50 break-all">{data.authorUserId}</p>
              <div className="flex gap-6 mt-3 text-sm">
                <div>
                  <span className="text-white/40">策略</span>{" "}
                  <span className="text-white font-mono tabular-nums">
                    {data.strategies.length}
                  </span>
                </div>
                <div>
                  <span className="text-white/40">累计 Fork</span>{" "}
                  <span className="text-white font-mono tabular-nums">
                    {data.totalForks}
                  </span>
                </div>
                <div>
                  <span className="text-white/40">订阅数</span>{" "}
                  <span className="text-white font-mono tabular-nums">
                    {data.totalSubscribers}
                  </span>
                </div>
              </div>
            </header>

            {data.strategies.length === 0 ? (
              <p className="text-sm text-white/40">该作者尚未发布策略。</p>
            ) : (
              <ul className="divide-y divide-white/5 border border-white/10 rounded-lg">
                {data.strategies.map((s) => (
                  <li key={s.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">{s.title}</div>
                      {s.description && (
                        <div className="text-xs text-white/50 mt-1 line-clamp-2">
                          {s.description}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                        {s.school && <span>{s.school}</span>}
                        <span>Fork {s.forkCount ?? 0}</span>
                        <span>订阅 {s.totalSubscribers ?? 0}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-primary">
                      {s.priceType === "free" ? "免费" : `${s.pricePerRun ?? 0} LB/次`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
