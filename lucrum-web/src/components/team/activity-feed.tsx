'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/dictionaries/zh';

interface ActivityItem {
  id: number;
  actorName: string;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_I18N: Record<string, TranslationKey> = {
  strategy_created: 'activity.strategy_created',
  strategy_updated: 'activity.strategy_updated',
  backtest_run: 'activity.backtest_run',
  member_invited: 'activity.member_invited',
  member_joined: 'activity.member_joined',
  member_removed: 'activity.member_removed',
  member_role_changed: 'activity.member_role_changed',
  team_updated: 'activity.team_updated',
};

interface ActivityFeedProps {
  teamId: number;
}

export function ActivityFeed({ teamId }: ActivityFeedProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);

  const fetchActivity = useCallback(async (cursor?: number) => {
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (cursor) params.set('before', String(cursor));
      const res = await fetch(`/api/team/${teamId}/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setItems((prev) => [...prev, ...(data.items ?? [])]);
        } else {
          setItems(data.items ?? []);
        }
        setHasMore(data.hasMore ?? false);
        setNextCursor(data.nextCursor ?? null);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}天前`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-white/30">
        {t('activity.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item, idx) => {
        const actionKey = ACTION_I18N[item.actionType];
        const actionLabel = actionKey ? t(actionKey) : item.actionType;

        return (
          <div key={item.id} className="flex gap-3 px-4 py-3">
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-accent/50 mt-1.5" />
              {idx < items.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-3">
              <p className="text-sm text-white/80">
                <span className="font-medium text-white">{item.actorName}</span>
                {' '}
                <span className="text-white/50">{actionLabel}</span>
              </p>
              <p className="text-xs text-white/30 mt-0.5 font-mono tabular-nums">
                {formatTime(item.createdAt)}
              </p>
            </div>
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && nextCursor && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => fetchActivity(nextCursor)}
            className="text-xs text-accent hover:text-accent-400 transition"
          >
            {t('common.loading')}
          </button>
        </div>
      )}
    </div>
  );
}
