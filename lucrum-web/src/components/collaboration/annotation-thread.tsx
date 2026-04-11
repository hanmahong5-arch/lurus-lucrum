'use client';

import { useState } from 'react';
import { MessageCircle, Check, Reply } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSafeAction } from '@/hooks/use-safe-action';

interface Annotation {
  id: number;
  userName: string;
  lineNumber: number | null;
  content: string;
  resolved: boolean;
  createdAt: string;
  replies?: Annotation[];
}

interface AnnotationThreadProps {
  annotation: Annotation;
  teamId: number;
  strategyId: number;
  canResolve: boolean;
  onUpdated: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

export function AnnotationThread({
  annotation,
  teamId,
  strategyId,
  canResolve,
  onUpdated,
}: AnnotationThreadProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  const { execute: submitReply, isRunning: replying } = useSafeAction(
    async () => {
      const res = await fetch(`/api/team/${teamId}/strategies/${strategyId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyText.trim(),
          parentId: annotation.id,
          lineNumber: annotation.lineNumber,
          tenantId: teamId,
        }),
      });
      if (!res.ok) throw new Error('Failed to reply');
    },
    {
      onSuccess: () => {
        setReplyText('');
        setReplyOpen(false);
        onUpdated();
      },
    }
  );

  const { execute: toggleResolve, isRunning: resolving } = useSafeAction(
    async () => {
      const res = await fetch(`/api/team/${teamId}/strategies/${strategyId}/annotations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annotationId: annotation.id,
          resolved: !annotation.resolved,
          tenantId: teamId,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    { onSuccess: onUpdated }
  );

  return (
    <div className={`rounded-lg border transition-colors ${
      annotation.resolved
        ? 'border-white/5 bg-white/[0.01] opacity-60'
        : 'border-accent/15 bg-accent/[0.03]'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        {annotation.lineNumber !== null && (
          <Badge variant="outline" className="text-[10px] font-mono tabular-nums px-1.5 py-0 h-4">
            L{annotation.lineNumber}
          </Badge>
        )}
        <span className="text-xs font-medium text-white/70">{annotation.userName}</span>
        <span className="text-[10px] text-white/20 font-mono tabular-nums">
          {formatRelativeTime(annotation.createdAt)}
        </span>
        <div className="flex-1" />
        {canResolve && (
          <button
            onClick={() => toggleResolve()}
            disabled={resolving}
            className={`p-0.5 rounded transition ${
              annotation.resolved
                ? 'text-profit hover:text-white'
                : 'text-white/20 hover:text-profit'
            }`}
            title={annotation.resolved ? '标记为未解决' : '标记为已解决'}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2 text-sm text-white/80 whitespace-pre-wrap">
        {annotation.content}
      </div>

      {/* Replies */}
      {annotation.replies && annotation.replies.length > 0 && (
        <div className="border-t border-white/5">
          {annotation.replies.map((reply) => (
            <div key={reply.id} className="px-3 py-2 border-b border-white/[0.03] last:border-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-medium text-white/50">{reply.userName}</span>
                <span className="text-[10px] text-white/15 font-mono tabular-nums">
                  {formatRelativeTime(reply.createdAt)}
                </span>
              </div>
              <p className="text-xs text-white/60">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      <div className="border-t border-white/5 px-3 py-2">
        {replyOpen ? (
          <div className="space-y-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-accent/30 resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setReplyOpen(false)} className="h-6 text-[11px] px-2">
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => submitReply()}
                disabled={replying || !replyText.trim()}
                className="h-6 text-[11px] px-2"
              >
                回复
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setReplyOpen(true)}
            className="flex items-center gap-1 text-[11px] text-white/20 hover:text-accent transition"
          >
            <Reply className="w-3 h-3" />
            回复
          </button>
        )}
      </div>
    </div>
  );
}
