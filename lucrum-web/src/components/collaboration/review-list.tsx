'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitPullRequest, MessageCircle, Plus, Check } from 'lucide-react';
import { ReviewStatusBadge } from './review-status-badge';
import { useSafeAction } from '@/hooks/use-safe-action';
import { useI18n } from '@/lib/i18n/context';

interface Review {
  id: number;
  title: string;
  description: string | null;
  status: string;
  authorName: string;
  strategyName: string | null;
  approvalCount: number;
  requiredApprovals: number;
  commentCount: number;
  createdAt: string;
}

interface ReviewListProps {
  teamId: number;
  onSelectReview: (review: Review) => void;
  onCreateReview: () => void;
  canCreate: boolean;
}

export function ReviewList({ teamId, onSelectReview, onCreateReview, canCreate }: ReviewListProps) {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open');

  const { execute: fetchReviews, isRunning } = useSafeAction(
    async () => {
      const statusParam = filter === 'all' ? '' : filter === 'closed' ? '&status=approved' : `&status=${filter}`;
      const res = await fetch(`/api/team/${teamId}/reviews?${statusParam}`);
      if (!res.ok) throw new Error('Failed to load reviews');
      return (await res.json()).data as Review[];
    },
    { onSuccess: setReviews }
  );

  useEffect(() => { fetchReviews(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffHr = Math.floor(diffMs / 3600000);
    if (diffHr < 1) return `${Math.floor(diffMs / 60000)}m`;
    if (diffHr < 24) return `${diffHr}h`;
    return `${Math.floor(diffHr / 24)}d`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {(['open', 'closed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2 py-1 rounded transition ${
                filter === f ? 'bg-accent/10 text-accent' : 'text-white/30 hover:text-white/50'
              }`}
            >
              {f === 'open' ? '进行中' : f === 'closed' ? '已关闭' : '全部'}
            </button>
          ))}
        </div>
        {canCreate && (
          <button
            onClick={onCreateReview}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-400 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            提交评审
          </button>
        )}
      </div>

      {/* List */}
      {isRunning ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <GitPullRequest className="w-8 h-8 text-white/10 mb-2" />
          <p className="text-xs text-white/20">暂无评审</p>
          {canCreate && (
            <p className="text-[11px] text-white/10 mt-1">提交策略评审，邀请队友审阅</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {reviews.map((review) => (
            <button
              key={review.id}
              onClick={() => onSelectReview(review)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
            >
              <GitPullRequest className={`w-4 h-4 mt-0.5 shrink-0 ${
                review.status === 'open' ? 'text-accent' : review.status === 'approved' ? 'text-profit' : 'text-white/20'
              }`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white truncate">{review.title}</span>
                  <ReviewStatusBadge status={review.status} />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/30">
                  <span>{review.authorName}</span>
                  {review.strategyName && (
                    <span className="truncate max-w-[150px]">{review.strategyName}</span>
                  )}
                  <span className="font-mono tabular-nums">{formatTime(review.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-[11px] text-white/20">
                <span className="flex items-center gap-0.5 font-mono tabular-nums">
                  <Check className="w-3 h-3" />
                  {review.approvalCount}/{review.requiredApprovals}
                </span>
                <span className="flex items-center gap-0.5 font-mono tabular-nums">
                  <MessageCircle className="w-3 h-3" />
                  {review.commentCount}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

