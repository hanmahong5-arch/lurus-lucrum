'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquarePlus, Filter } from 'lucide-react';
import { AnnotationThread } from './annotation-thread';
import { Button } from '@/components/ui/button';
import { useSafeAction } from '@/hooks/use-safe-action';
import { useI18n } from '@/lib/i18n/context';

interface Annotation {
  id: number;
  userName: string;
  lineNumber: number | null;
  content: string;
  resolved: boolean;
  createdAt: string;
  replies?: Annotation[];
}

interface AnnotationPanelProps {
  teamId: number;
  strategyId: number;
  canComment: boolean;
  selectedLine?: number | null;
  onLineSelect?: (line: number | null) => void;
}

export function AnnotationPanel({
  teamId,
  strategyId,
  canComment,
  selectedLine,
  onLineSelect,
}: AnnotationPanelProps) {
  const { t } = useI18n();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [composing, setComposing] = useState(false);

  const fetchAnnotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/${teamId}/strategies/${strategyId}/annotations`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.data ?? []);
      }
    } catch { /* silent */ }
  }, [teamId, strategyId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  const { execute: submitAnnotation, isRunning } = useSafeAction(
    async () => {
      const res = await fetch(`/api/team/${teamId}/strategies/${strategyId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          lineNumber: selectedLine ?? null,
          tenantId: teamId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create annotation');
    },
    {
      onSuccess: () => {
        setNewComment('');
        setComposing(false);
        fetchAnnotations();
      },
    }
  );

  const filtered = showResolved
    ? annotations
    : annotations.filter((a) => !a.resolved);

  const lineFiltered = selectedLine !== null && selectedLine !== undefined
    ? filtered.filter((a) => a.lineNumber === selectedLine)
    : filtered;

  const unresolvedCount = annotations.filter((a) => !a.resolved).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">标注</span>
          {unresolvedCount > 0 && (
            <span className="text-[10px] font-mono tabular-nums bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
              {unresolvedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`p-1 rounded text-xs transition ${
              showResolved ? 'text-accent bg-accent/10' : 'text-white/30 hover:text-white/50'
            }`}
            title={showResolved ? '隐藏已解决' : '显示已解决'}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          {canComment && (
            <button
              onClick={() => setComposing(true)}
              className="p-1 rounded text-white/30 hover:text-accent hover:bg-accent/10 transition"
              title="新建标注"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected line indicator */}
      {selectedLine !== null && selectedLine !== undefined && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-accent/5 border-b border-accent/10">
          <span className="text-[11px] text-accent/60 font-mono">Line {selectedLine}</span>
          <button
            onClick={() => onLineSelect?.(null)}
            className="text-[11px] text-white/30 hover:text-white/50"
          >
            清除
          </button>
        </div>
      )}

      {/* New annotation composer */}
      {composing && (
        <div className="px-4 py-3 border-b border-border space-y-2 animate-in fade-in duration-200">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={selectedLine ? `Line ${selectedLine} 的标注...` : '写一条标注...'}
            className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-accent/30 resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setComposing(false); setNewComment(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => submitAnnotation()}
              disabled={isRunning || !newComment.trim()}
            >
              {isRunning ? t('common.loading') : t('common.submit')}
            </Button>
          </div>
        </div>
      )}

      {/* Annotation list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {lineFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquarePlus className="w-8 h-8 text-white/10 mb-2" />
            <p className="text-xs text-white/20">
              {selectedLine ? `Line ${selectedLine} 暂无标注` : '暂无标注'}
            </p>
            {canComment && (
              <p className="text-[11px] text-white/10 mt-1">点击代码行号开始标注</p>
            )}
          </div>
        ) : (
          lineFiltered.map((annotation) => (
            <AnnotationThread
              key={annotation.id}
              annotation={annotation}
              teamId={teamId}
              strategyId={strategyId}
              canResolve={canComment}
              onUpdated={fetchAnnotations}
            />
          ))
        )}
      </div>
    </div>
  );
}
