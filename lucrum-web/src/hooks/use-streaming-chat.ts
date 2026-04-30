/**
 * Streaming Chat Hook
 * 流式对话 Hook
 *
 * Provides a React hook for streaming chat responses from the advisor API.
 * 提供用于从顾问 API 获取流式对话响应的 React Hook
 */

import { useState, useCallback, useRef, useEffect } from "react";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface StreamingChatOptions {
  mode?: "standard" | "quick" | "deep";
  context?: {
    symbol?: string;
    sector?: string;
    timeframe?: string;
    riskTolerance?: string;
  };
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface UseStreamingChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (message: string, options?: StreamingChatOptions) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  currentResponse: string;
}

// =============================================================================
// HOOK / Hook
// =============================================================================

export function useStreamingChat(): UseStreamingChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort streaming on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Stop the current streaming request
   * 停止当前流式请求
   */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /**
   * Clear all messages
   * 清除所有消息
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse("");
    setError(null);
  }, []);

  /**
   * Send a message and handle streaming response
   * 发送消息并处理流式响应
   */
  const sendMessage = useCallback(
    async (message: string, options: StreamingChatOptions = {}) => {
      const { mode = "standard", context, onChunk, onComplete, onError } = options;

      // Add user message
      const userMessage: ChatMessage = {
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Reset state
      setError(null);
      setCurrentResponse("");
      setIsStreaming(true);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        // Build history from previous messages (last 10)
        const history = messages.slice(-10).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        // Make streaming request
        const response = await fetch("/api/advisor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            mode,
            stream: true,
            context,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Check if response is SSE
        const contentType = response.headers.get("Content-Type");
        if (!contentType?.includes("text/event-stream")) {
          // Non-streaming response fallback
          const data = await response.json();
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: data.response,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setIsStreaming(false);
          onComplete?.(data.response);
          return;
        }

        // Process SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let fullResponse = "";
        let buffer = "";
        // Track terminal frames separately. The server emits exactly one of
        // `[DONE]` (clean end) or `{error:{...}}` (terminal failure). If we
        // see neither and the stream just closes, that's a truncation.
        let sawDone = false;
        let streamError: { title?: string; description?: string; code?: string } | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events in buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = (line.startsWith("data: ") ? line.slice(6) : line.slice(5)).trim();

            if (data === "[DONE]") {
              sawDone = true;
              continue;
            }

            let parsed: { content?: string; error?: { title?: string; description?: string; code?: string } };
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            // Terminal error frame from server (mid-stream upstream failure
            // or truncation). Stop accumulating and surface to caller.
            if (parsed.error) {
              streamError = parsed.error;
              break;
            }

            const content = parsed.content || "";
            if (content) {
              fullResponse += content;
              setCurrentResponse(fullResponse);
              onChunk?.(content);
            }
          }

          if (streamError) break;
        }

        if (streamError) {
          // Mid-stream failure: don't save partial response as a "message" —
          // it's misleading. Surface as an error and let the user retry.
          const msg = streamError.description || streamError.title || streamError.code || "AI 服务异常";
          setError(msg);
          setCurrentResponse("");
          onError?.(new Error(msg));
        } else if (fullResponse) {
          if (!sawDone) {
            // Connection closed without [DONE] *and* without an explicit
            // error frame — likely a network drop after the server already
            // wrote partial output. Save what we have but flag truncation
            // so the UI can offer "继续" / retry chrome.
            console.warn("[StreamingChat] Stream closed without [DONE] marker — possible truncation");
          }
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: fullResponse,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setCurrentResponse("");
          onComplete?.(fullResponse);
        } else if (!sawDone) {
          // No content, no [DONE], no explicit error — surface as a generic
          // failure rather than letting the user stare at silence.
          const msg = "AI 未返回响应，请重试";
          setError(msg);
          onError?.(new Error(msg));
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled
          console.log("[StreamingChat] Request cancelled");
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages]
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages,
    currentResponse,
  };
}

export default useStreamingChat;
