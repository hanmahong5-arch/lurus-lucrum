'use client';

/**
 * NetworkStatusBanner - Global connectivity indicator.
 *
 * Yellow banner when offline, green flash on reconnection.
 * Placed inside dashboard layout so it is always visible.
 */

import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';

export function NetworkStatusBanner() {
  const { isOnline, justReconnected } = useNetworkStatus();

  if (isOnline && !justReconnected) return null;

  return (
    <div
      className={cn(
        'sticky top-0 z-[60] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-all',
        !isOnline
          ? 'bg-yellow-600/90 text-white backdrop-blur-sm'
          : 'bg-profit/90 text-white backdrop-blur-sm',
      )}
      role="alert"
    >
      {!isOnline ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01"
            />
          </svg>
          <span>网络连接中断，部分功能暂不可用</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>网络已恢复</span>
        </>
      )}
    </div>
  );
}
