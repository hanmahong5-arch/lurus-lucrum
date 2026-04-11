'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface PresenceUser {
  userId: string;
  name: string;
  avatar: string | null;
  lastSeen: number;
}

interface UsePresenceOptions {
  tenantId: number | undefined;
  resourceType: string;
  resourceId: string;
  enabled?: boolean;
}

interface UsePresenceReturn {
  /** List of users currently present on this resource */
  users: PresenceUser[];
  /** Total count of present users */
  count: number;
  /** Whether SSE is connected */
  connected: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const HEARTBEAT_MS = parseInt(process.env.NEXT_PUBLIC_PRESENCE_HEARTBEAT_MS || '30000', 10);

// ============================================================================
// Hook
// ============================================================================

/**
 * Real-time presence hook.
 * Sends heartbeat every 30s and subscribes to SSE for presence changes.
 * Sends 'leave' on unmount.
 */
export function usePresence({
  tenantId,
  resourceType,
  resourceId,
  enabled = true,
}: UsePresenceOptions): UsePresenceReturn {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  const active = enabled && !!tenantId && !!resourceType && !!resourceId;

  // Heartbeat POST
  const sendHeartbeat = useCallback(async (action?: 'join' | 'leave') => {
    if (!tenantId) return;
    try {
      await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, resourceType, resourceId, action }),
      });
    } catch {
      // Silent — presence is non-critical
    }
  }, [tenantId, resourceType, resourceId]);

  useEffect(() => {
    if (!active) {
      setUsers([]);
      setConnected(false);
      return;
    }

    mountedRef.current = true;

    // Initial heartbeat (join)
    sendHeartbeat('join');

    // Periodic heartbeat
    const heartbeatTimer = setInterval(() => {
      if (mountedRef.current) sendHeartbeat();
    }, HEARTBEAT_MS);

    // SSE subscription
    let eventSource: EventSource | null = null;
    try {
      const params = new URLSearchParams({
        tenantId: String(tenantId),
        resourceType,
        resourceId,
      });
      eventSource = new EventSource(`/api/presence/stream?${params}`);

      eventSource.addEventListener('presence', (e) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          setUsers(data.users ?? []);
        } catch { /* ignore */ }
      });

      eventSource.onopen = () => {
        if (mountedRef.current) setConnected(true);
      };

      eventSource.onerror = () => {
        if (mountedRef.current) setConnected(false);
        // EventSource auto-reconnects
      };
    } catch {
      // SSE not available
    }

    // Cleanup: send leave + close SSE
    return () => {
      mountedRef.current = false;
      sendHeartbeat('leave');
      clearInterval(heartbeatTimer);
      eventSource?.close();
      setConnected(false);
    };
  }, [active, tenantId, resourceType, resourceId, sendHeartbeat]);

  return {
    users,
    count: users.length,
    connected,
  };
}
