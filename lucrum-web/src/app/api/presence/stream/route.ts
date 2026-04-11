/**
 * Presence SSE Stream API
 * Pushes presence changes for a specific resource every 5s.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { getPresence, type PresenceInfo } from '@/lib/services/presence-service';

export async function GET(request: NextRequest) {
  // Authenticate
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const tenantId = parseInt(searchParams.get('tenantId') || '0', 10);
  const resourceType = searchParams.get('resourceType') || '';
  const resourceId = searchParams.get('resourceId') || '';

  if (!tenantId || !resourceType || !resourceId) {
    return new Response('Missing tenantId, resourceType, or resourceId', { status: 400 });
  }

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

      // Send initial presence
      const initial = await getPresence(tenantId, resourceType, resourceId);
      send('presence', initial);

      // Poll every 5s for presence changes
      let lastHash = hashPresence(initial);

      const pollInterval = setInterval(async () => {
        if (closed) return;
        try {
          const current = await getPresence(tenantId, resourceType, resourceId);
          const currentHash = hashPresence(current);

          // Only send if changed
          if (currentHash !== lastHash) {
            lastHash = currentHash;
            send('presence', current);
          }
        } catch {
          // Ignore polling errors
        }
      }, 5000);

      // Heartbeat every 30s
      const heartbeatInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          closed = true;
        }
      }, 30000);

      // Cleanup
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
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

/**
 * Simple hash of presence state for change detection.
 * Sorts user IDs to ensure stable comparison.
 */
function hashPresence(info: PresenceInfo): string {
  return info.users
    .map((u) => u.userId)
    .sort()
    .join(',');
}

export const dynamic = 'force-dynamic';
