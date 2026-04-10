'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationPanel } from './notification-panel';
import { useCurrentUser } from '@/hooks/use-user-workspace';

export function NotificationBell() {
  const { user, isAuthenticated } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/notifications?countOnly=true');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    }
  }, [isAuthenticated]);

  // Poll unread count every 30s + SSE for real-time
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 30000);

    // Try SSE connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/notifications/stream');
      eventSource.addEventListener('unread', (e) => {
        try {
          const data = JSON.parse(e.data);
          setUnreadCount(data.count ?? 0);
        } catch { /* ignore parse errors */ }
      });
      eventSource.addEventListener('notification', () => {
        // New notification arrived — bump count
        setUnreadCount((prev) => prev + 1);
      });
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
      };
    } catch {
      // SSE not available
    }

    return () => {
      clearInterval(interval);
      eventSource?.close();
    };
  }, [isAuthenticated, fetchUnreadCount]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-1.5 rounded-md transition',
          isOpen ? 'text-accent bg-accent/10' : 'text-white/40 hover:text-white hover:bg-white/5'
        )}
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center px-0.5 rounded-full bg-loss text-white text-[9px] font-bold font-mono tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel
          onClose={() => setIsOpen(false)}
          onCountChange={setUnreadCount}
        />
      )}
    </div>
  );
}
