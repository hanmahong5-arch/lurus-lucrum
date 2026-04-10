'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface NotificationPanelProps {
  onClose: () => void;
  onCountChange: (count: number) => void;
}

export function NotificationPanel({ onClose, onCountChange }: NotificationPanelProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        onCountChange(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onCountChange(0);
    } catch {
      // Silently fail
    }
  };

  const markRead = async (id: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      // Refetch count
      const countRes = await fetch('/api/notifications?countOnly=true');
      if (countRes.ok) {
        const countData = await countRes.json();
        onCountChange(countData.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    }
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

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

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-surface border border-border rounded-lg shadow-xl z-[999] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-white">{t('notification.title')}</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-400 transition"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {t('notification.markAllRead')}
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[320px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-white/30">
            {t('notification.empty')}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 transition hover:bg-white/5 ${
                !item.isRead ? 'bg-accent/5' : ''
              }`}
            >
              {/* Unread dot */}
              <div className="mt-1.5 shrink-0">
                {!item.isRead ? (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                ) : (
                  <div className="w-2 h-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!item.isRead ? 'text-white' : 'text-white/60'}`}>
                  {item.title}
                </p>
                {item.body && (
                  <p className="text-xs text-white/40 mt-0.5 truncate">{item.body}</p>
                )}
                <p className="text-xs text-white/30 mt-1 font-mono tabular-nums">
                  {formatTime(item.createdAt)}
                </p>
              </div>

              {/* Mark read button */}
              {!item.isRead && (
                <button
                  onClick={(e) => { e.stopPropagation(); markRead(item.id); }}
                  className="shrink-0 p-1 rounded text-white/30 hover:text-accent hover:bg-accent/10 transition"
                  title={t('notification.markRead')}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
