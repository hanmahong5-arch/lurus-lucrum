/**
 * Notification SSE Stream API
 * Real-time notification delivery via Server-Sent Events.
 * Uses Redis Pub/Sub when available, falls back to 3s DB polling.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { getUnreadCount } from '@/lib/services/notification-service';
import { subscribeNotifications } from '@/lib/services/notification-service';

export async function GET(request: NextRequest) {
  // Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userId = session.user.id;

  // Set up SSE stream
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send initial unread count
      const unreadCount = await getUnreadCount(userId);
      send('unread', { count: unreadCount });

      // Try Redis Pub/Sub for real-time delivery
      let unsubscribe: (() => void) | null = null;
      try {
        unsubscribe = await subscribeNotifications(userId, (message) => {
          try {
            send('notification', JSON.parse(message));
          } catch {
            send('notification', { raw: message });
          }
        });
      } catch {
        // Redis unavailable
      }

      // Fallback: poll DB every 5s if no Redis
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      if (!unsubscribe) {
        let lastCount = unreadCount;
        pollInterval = setInterval(async () => {
          if (closed) return;
          try {
            const currentCount = await getUnreadCount(userId);
            if (currentCount !== lastCount) {
              lastCount = currentCount;
              send('unread', { count: currentCount });
            }
          } catch {
            // Ignore polling errors
          }
        }, 5000);
      }

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          closed = true;
        }
      }, 30000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        closed = true;
        if (unsubscribe) unsubscribe();
        if (pollInterval) clearInterval(pollInterval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export const dynamic = 'force-dynamic';
