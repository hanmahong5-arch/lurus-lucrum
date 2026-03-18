/**
 * Streaming Chat Hook
 * 流式对话 Hook
 *
 * Provides a React hook for streaming chat responses from the advisor API.
 * 提供用于从顾问 API 获取流式对话响应的 React Hook
 */

import { useState, useCallback, useRef } from "react";

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
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();

              // Check for stream end
              if (data === "[DONE]") {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.content || "";

                if (content) {
                  fullResponse += content;
                  setCurrentResponse(fullResponse);
                  onChunk?.(content);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // Add complete assistant message
        if (fullResponse) {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: fullResponse,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setCurrentResponse("");
          onComplete?.(fullResponse);
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
