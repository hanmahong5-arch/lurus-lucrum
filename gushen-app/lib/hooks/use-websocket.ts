/**
 * WebSocket Hook (adapted from gushen-web)
 *
 * Auto-connect, auto-reconnect with exponential backoff,
 * heartbeat, and typed message subscriptions.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { API_CONFIG } from "@/constants/api";

type WSMessageType =
  | "tick"
  | "order"
  | "trade"
  | "position"
  | "account"
  | "backtest_progress"
  | "job_completed"
  | "error"
  | "pong";

interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp?: number;
}

type MessageHandler = (data: unknown) => void;

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = API_CONFIG.WS_URL,
    autoConnect = true,
    reconnectInterval = API_CONFIG.WS_RECONNECT_INTERVAL,
    maxReconnectAttempts = API_CONFIG.WS_MAX_RECONNECT_ATTEMPTS,
    heartbeatInterval = 30_000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval>>();
  const listenersRef = useRef(new Map<WSMessageType, Set<MessageHandler>>());
  const subscribedSymbolsRef = useRef(new Set<string>());

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  const connect = useCallback(() => {
    cleanup();

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
        startHeartbeat();

        // Re-subscribe to tracked symbols
        subscribedSymbolsRef.current.forEach((symbol) => {
          ws.send(JSON.stringify({ type: "subscribe", symbol }));
        });
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data as string);
          const handlers = listenersRef.current.get(msg.type);
          handlers?.forEach((handler) => handler(msg.data));
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        setConnected(false);
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

        // Auto-reconnect with exponential backoff
        if (reconnectCountRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * 2 ** reconnectCountRef.current,
            30_000,
          );
          reconnectCountRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  }, [url, cleanup, startHeartbeat, reconnectInterval, maxReconnectAttempts]);

  // Subscribe to a symbol for real-time ticks
  const subscribe = useCallback((symbol: string) => {
    subscribedSymbolsRef.current.add(symbol);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", symbol }));
    }
  }, []);

  const unsubscribe = useCallback((symbol: string) => {
    subscribedSymbolsRef.current.delete(symbol);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", symbol }));
    }
  }, []);

  // Auto-connect on mount + handle app state
  useEffect(() => {
    if (autoConnect) connect();

    const handleAppState = (state: AppStateStatus) => {
      if (state === "active" && autoConnect) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectCountRef.current = 0;
          connect();
        }
      } else if (state === "background") {
        cleanup();
      }
    };

    const sub = AppState.addEventListener("change", handleAppState);
    return () => {
      sub.remove();
      cleanup();
    };
  }, [autoConnect, connect, cleanup]);

  return {
    connected,
    error,
    connect,
    disconnect: cleanup,
    subscribe,
    unsubscribe,

    /**
     * Register a handler for a specific message type.
     * Returns an unsubscribe function.
     */
    on: (type: WSMessageType, handler: MessageHandler): (() => void) => {
      if (!listenersRef.current.has(type)) {
        listenersRef.current.set(type, new Set());
      }
      listenersRef.current.get(type)!.add(handler);
      return () => {
        listenersRef.current.get(type)?.delete(handler);
      };
    },
  };
}

/**
 * Subscribe to a specific WebSocket message type.
 * Automatically cleans up on unmount.
 */
export function useWSSubscription(
  ws: ReturnType<typeof useWebSocket>,
  type: WSMessageType,
  handler: MessageHandler,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = ws.on(type, (data) => handlerRef.current(data));
    return unsub;
  }, [ws, type]);
}
