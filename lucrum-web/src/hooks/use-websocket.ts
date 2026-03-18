"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * WebSocket message types
 * WebSocket 消息类型
 */
export type WSMessageType =
  | "tick"           // Market tick data
  | "order"          // Order update
  | "trade"          // Trade execution
  | "position"       // Position change
  | "account"        // Account update
  | "backtest_progress" // Backtest progress
  | "job_completed"  // Job completion
  | "error"          // Error message
  | "pong";          // Heartbeat response

/**
 * WebSocket message interface
 * WebSocket 消息接口
 */
export interface WSMessage {
  type: WSMessageType;
  [key: string]: unknown;
}

/**
 * WebSocket connection state
 * WebSocket 连接状态
 */
export type WSState = "connecting" | "connected" | "disconnected" | "error";

/**
 * WebSocket hook options
 * WebSocket Hook 配置选项
 */
interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

/**
 * WebSocket hook return type
 * WebSocket Hook 返回类型
 */
interface UseWebSocketReturn {
  state: WSState;
  lastMessage: WSMessage | null;
  send: (data: object) => void;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Default WebSocket URL
 * 默认 WebSocket URL
 */
const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://gushen.lurus.cn/ws";

/**
 * Custom hook for WebSocket connection with auto-reconnect and heartbeat
 * 自定义 WebSocket Hook，支持自动重连和心跳
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = DEFAULT_WS_URL,
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<WSState>("disconnected");
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());

  // Clear all timers
  // 清除所有定时器
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // Start heartbeat
  // 启动心跳
  const startHeartbeat = useCallback(() => {
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  // Connect to WebSocket
  // 连接 WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    clearTimers();
    setState("connecting");

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setState("connected");
        reconnectCountRef.current = 0;
        startHeartbeat();

        // Re-subscribe to symbols
        // 重新订阅品种
        if (subscribedSymbolsRef.current.size > 0) {
          ws.send(JSON.stringify({
            type: "subscribe",
            symbols: Array.from(subscribedSymbolsRef.current),
          }));
        }

        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          setLastMessage(message);
          onMessage?.(message);
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = (event) => {
        setState("error");
        onError?.(event);
      };

      ws.onclose = () => {
        setState("disconnected");
        clearTimers();
        onDisconnect?.();

        // Auto reconnect with exponential backoff
        // 使用指数退避自动重连
        if (reconnectCountRef.current < maxReconnectAttempts) {
          const delay = reconnectInterval * Math.pow(1.5, reconnectCountRef.current);
          reconnectCountRef.current++;

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, Math.min(delay, 30000)); // Max 30 seconds
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setState("error");
    }
  }, [url, clearTimers, startHeartbeat, maxReconnectAttempts, reconnectInterval, onConnect, onMessage, onError, onDisconnect]);

  // Disconnect from WebSocket
  // 断开 WebSocket 连接
  const disconnect = useCallback(() => {
    clearTimers();
    reconnectCountRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState("disconnected");
  }, [clearTimers, maxReconnectAttempts]);

  // Send message
  // 发送消息
  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket is not connected");
    }
  }, []);

  // Subscribe to symbols
  // 订阅品种
  const subscribe = useCallback((symbols: string[]) => {
    symbols.forEach((s) => subscribedSymbolsRef.current.add(s));
    send({ type: "subscribe", symbols });
  }, [send]);

  // Unsubscribe from symbols
  // 取消订阅品种
  const unsubscribe = useCallback((symbols: string[]) => {
    symbols.forEach((s) => subscribedSymbolsRef.current.delete(s));
    send({ type: "unsubscribe", symbols });
  }, [send]);

  // Auto connect on mount
  // 挂载时自动连接
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    state,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

/**
 * Hook for subscribing to specific message types
 * 订阅特定消息类型的 Hook
 */
export function useWSSubscription<T = unknown>(
  ws: UseWebSocketReturn,
  messageType: WSMessageType,
  callback: (data: T) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (ws.lastMessage?.type === messageType) {
      callbackRef.current(ws.lastMessage as unknown as T);
    }
  }, [ws.lastMessage, messageType]);
}
