/**
 * Event Timeline Panel — DB-backed user activity history.
 *
 * Replaces the localStorage-only DraftHistoryPanel. Shows the user's
 * cross-device action stream: strategy edits, backtests, marketplace
 * activity, template loads. Local unsynced drafts are surfaced at the
 * bottom in a collapsed section.
 *
 * The panel paginates via cursor on createdAt; tabs filter by category.
 *
 * @module components/history/event-timeline-panel
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useStrategyWorkspaceStore } from "@/lib/stores/strategy-workspace-store";
import {
  USER_EVENT_TYPES,
  type UserEventType,
} from "@/lib/services/user-event-types";
import {
  Clock,
  Code2,
  FlaskConical,
  Store,
  FileText,
  RotateCcw,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEvent {
  id: number;
  userId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

type TabKey = "all" | "edit" | "backtest" | "marketplace" | "drafts";

const TABS: ReadonlyArray<{ key: TabKey; label: string; types?: string[] }> = [
  { key: "all", label: "全部" },
  {
    key: "edit",
    label: "策略编辑",
    types: [
      USER_EVENT_TYPES.strategyCreated,
      USER_EVENT_TYPES.strategyRenamed,
      USER_EVENT_TYPES.strategyCodeChanged,
      USER_EVENT_TYPES.strategyParamChanged,
      USER_EVENT_TYPES.templateLoaded,
    ],
  },
  {
    key: "backtest",
    label: "回测",
    types: [
      USER_EVENT_TYPES.backtestStarted,
      USER_EVENT_TYPES.backtestCompleted,
      USER_EVENT_TYPES.backtestFailed,
    ],
  },
  {
    key: "marketplace",
    label: "市场",
    types: [
      USER_EVENT_TYPES.marketplaceForked,
      USER_EVENT_TYPES.marketplacePublished,
      USER_EVENT_TYPES.marketplaceSubscribed,
      USER_EVENT_TYPES.marketplaceRated,
    ],
  },
  { key: "drafts", label: "本机草稿" },
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function eventLabel(type: string): string {
  switch (type) {
    case USER_EVENT_TYPES.strategyCreated:
      return "创建策略";
    case USER_EVENT_TYPES.strategyRenamed:
      return "重命名策略";
    case USER_EVENT_TYPES.strategyCodeChanged:
      return "代码更新";
    case USER_EVENT_TYPES.strategyParamChanged:
      return "参数调整";
    case USER_EVENT_TYPES.backtestStarted:
      return "回测开始";
    case USER_EVENT_TYPES.backtestCompleted:
      return "回测完成";
    case USER_EVENT_TYPES.backtestFailed:
      return "回测失败";
    case USER_EVENT_TYPES.marketplaceForked:
      return "Fork 市场策略";
    case USER_EVENT_TYPES.marketplacePublished:
      return "发布到市场";
    case USER_EVENT_TYPES.marketplaceSubscribed:
      return "订阅市场策略";
    case USER_EVENT_TYPES.marketplaceRated:
      return "市场策略评分";
    case USER_EVENT_TYPES.templateLoaded:
      return "加载模板";
    default:
      return type;
  }
}

function eventIcon(type: string) {
  if (type.startsWith("strategy.") || type === USER_EVENT_TYPES.templateLoaded) {
    return <Code2 className="w-4 h-4 text-primary" />;
  }
  if (type.startsWith("backtest.")) {
    return <FlaskConical className="w-4 h-4 text-accent" />;
  }
  if (type.startsWith("marketplace.")) {
    return <Store className="w-4 h-4 text-amber-400" />;
  }
  return <Clock className="w-4 h-4 text-neutral-400" />;
}

function dayBucket(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return "今天";
  if (date >= yest) return "昨天";
  if (date >= weekAgo) return "本周";
  return "更早";
}

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventTimelinePanel({ className }: { className?: string }) {
  const [tab, setTab] = useState<TabKey>("all");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drafts = useStrategyWorkspaceStore((s) => s.drafts);
  const loadDraft = useStrategyWorkspaceStore((s) => s.loadDraft);

  const activeTypes = useMemo(() => {
    const def = TABS.find((t) => t.key === tab);
    return def?.types;
  }, [tab]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (!reset && cursor) params.set("cursor", cursor);
        params.set("limit", "30");
        // If a single type filter is conceptually intended, we'd add it; for
        // the multi-type tabs we fetch all and filter client-side so we don't
        // round-trip per type. The filter set is small (≤5 types per tab).
        const res = await fetch(`/api/timeline?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const page = json?.data;
        if (!page) throw new Error("invalid response");
        const incoming = (page.events ?? []) as TimelineEvent[];
        setEvents((prev) => (reset ? incoming : [...prev, ...incoming]));
        setCursor(page.nextCursor ?? undefined);
        setExhausted(!page.nextCursor);
      } catch (err) {
        console.warn("[EventTimelinePanel] fetch failed:", err);
        setError("加载失败");
      } finally {
        setLoading(false);
      }
    },
    [cursor],
  );

  useEffect(() => {
    // Reset and fetch fresh when the tab changes (or on first mount).
    setEvents([]);
    setCursor(undefined);
    setExhausted(false);
    void fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    if (!activeTypes) return events;
    return events.filter((e) => activeTypes.includes(e.eventType));
  }, [events, activeTypes]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const bucket = dayBucket(new Date(e.createdAt));
      const list = map.get(bucket) ?? [];
      list.push(e);
      map.set(bucket, list);
    }
    return map;
  }, [filtered]);

  return (
    <div
      className={cn(
        "flex flex-col bg-surface/50 border border-white/10 rounded-lg",
        className,
      )}
    >
      {/* Header + tabs */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 overflow-x-auto">
        <Clock className="w-4 h-4 text-accent shrink-0" />
        <h3 className="text-sm font-semibold text-white shrink-0">时间轴</h3>
        <div className="flex items-center gap-1 ml-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md transition-colors",
                tab === t.key
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {tab === "drafts" ? (
          <DraftSection drafts={drafts} onLoad={loadDraft} />
        ) : error ? (
          <div className="p-6 text-center text-xs text-loss">{error}</div>
        ) : grouped.size === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FileText className="w-10 h-10 text-white/20 mb-3" />
            <p className="text-sm text-text-secondary">暂无活动</p>
          </div>
        ) : (
          <>
            {Array.from(grouped.entries()).map(([bucket, list]) => (
              <div key={bucket}>
                <div className="px-4 py-2 text-xs font-medium text-neutral-500 bg-white/5 sticky top-0">
                  {bucket}
                </div>
                <ul className="divide-y divide-white/5">
                  {list.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </ul>
              </div>
            ))}
            {/* Load more */}
            {!exhausted && (
              <div className="p-3 flex justify-center border-t border-white/5">
                <button
                  onClick={() => void fetchPage(false)}
                  disabled={loading}
                  className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
                >
                  {loading ? "加载中..." : "加载更多"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: TimelineEvent }) {
  const date = new Date(event.createdAt);
  const meta = event.metadata ?? {};
  let summary = "";
  if (typeof meta.summary === "string") summary = meta.summary;
  else if (typeof meta.prompt === "string") summary = String(meta.prompt).slice(0, 80);
  else if (event.entityType && event.entityId) {
    summary = `${event.entityType}#${event.entityId}`;
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
      <div className="shrink-0">{eventIcon(event.eventType)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-neutral-200">{eventLabel(event.eventType)}</span>
          {summary && <span className="text-neutral-500 truncate">{summary}</span>}
        </div>
      </div>
      <span className="shrink-0 text-xs text-neutral-500 tabular-nums">{formatTime(date)}</span>
    </li>
  );
}

function DraftSection({
  drafts,
  onLoad,
}: {
  drafts: Array<{ id: string; timestamp: Date; workspace: { strategyInput: string } }>;
  onLoad: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  if (drafts.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-neutral-500">无本机草稿</div>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-neutral-400 hover:bg-white/5"
      >
        <span>本机草稿（未上传）· {drafts.length}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <ul className="divide-y divide-white/5">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5"
            >
              <FileText className="w-4 h-4 text-neutral-400" />
              <div className="flex-1 min-w-0 text-xs">
                <div className="text-neutral-200 truncate">
                  {d.workspace.strategyInput || "(空草稿)"}
                </div>
                <div className="text-neutral-500">
                  {new Date(d.timestamp).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => onLoad(d.id)}
                className="p-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20"
                title="恢复"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
