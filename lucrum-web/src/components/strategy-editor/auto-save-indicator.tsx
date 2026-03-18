/**
 * Auto-Save Indicator Component
 * 自动保存状态指示器
 *
 * Displays the current auto-save status with clear visual feedback
 */

'use client';

import { Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutoSaveStatus } from '@/lib/stores/strategy-workspace-store';

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt?: Date;
  className?: string;
  onClick?: () => void;
}

export function AutoSaveIndicator({
  status,
  lastSavedAt,
  className,
  onClick,
}: AutoSaveIndicatorProps) {
  const getTimeAgo = (date?: Date): string => {
    if (!date) return '';

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}秒前`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-default select-none',
        status === 'saved' && 'bg-profit/10 text-profit',
        status === 'saving' && 'bg-accent/10 text-accent',
        status === 'unsaved' && 'bg-warning/10 text-warning',
        status === 'error' && 'bg-loss/10 text-loss cursor-pointer hover:bg-loss/20',
        className
      )}
      onClick={status === 'error' ? onClick : undefined}
      title={
        status === 'saved'
          ? `最后保存时间: ${lastSavedAt?.toLocaleString('zh-CN')}`
          : status === 'saving'
            ? '正在保存到本地存储...'
            : status === 'unsaved'
              ? '有未保存的更改，将在3秒后自动保存'
              : '自动保存失败，点击重试'
      }
    >
      {status === 'saved' && (
        <>
          <Check className="w-4 h-4" />
          <span>已保存</span>
          {lastSavedAt && (
            <span className="text-xs opacity-70">· {getTimeAgo(lastSavedAt)}</span>
          )}
        </>
      )}

      {status === 'saving' && (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>保存中...</span>
        </>
      )}

      {status === 'unsaved' && (
        <>
          <Clock className="w-4 h-4" />
          <span>未保存更改</span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="w-4 h-4" />
          <span>保存失败 · 点击重试</span>
        </>
      )}
    </div>
  );
}
