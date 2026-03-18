/**
 * Streaming Chat Hook (SSE)
 *
 * Uses react-native-sse (EventSource polyfill) for real-time
 * AI advisor responses. Native fetch does not support ReadableStream
 * on React Native, so we use EventSource instead.
 */

import { useState, useRef, useCallback } from "react";
import EventSource, { type MessageEvent, type ErrorEvent, type TimeoutEvent, type ExceptionEvent } from "react-native-sse";
import { API_CONFIG } from "@/constants/api";
import { tokenStore } from "@/lib/auth/token-store";

export type ChatMode = "quick" | "deep" | "debate" | "diagnose";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  mode?: ChatMode;
}

interface AdvisorContext {
  symbol?: string;
  symbolName?: string;
  sector?: string;
  timeframe?: string;
  riskTolerance?: string;
}

interface SendOptions {
  mode?: ChatMode;
  context?: AdvisorContext;
  history?: ChatMessage[];
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string, suggestedQuestions: string[]) => void;
  onError?: (error: string) => void;
}

export function useStreamingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(
    async (message: string, options: SendOptions = {}) => {
      const { mode = "quick", context, history, onChunk, onComplete, onError } = options;

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: Date.now(),
        mode,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setError(null);
      setCurrentResponse("");
      setSuggestedQuestions([]);

      // Close any previous EventSource
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      try {
        const token = await tokenStore.getAccessToken();
        const chatHistory = (history ?? messages).slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const url = `${API_CONFIG.LUCRUM_API_URL}/advisor/chat`;
        let fullText = "";

        const es = new EventSource(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message,
            history: chatHistory,
            mode,
            stream: true,
            context,
          }),
        });
        esRef.current = es;

        es.addEventListener("message", (event: MessageEvent) => {
          const payload = event.data;
          if (!payload) return;

          if (payload === "[DONE]") {
            es.close();
            esRef.current = null;

            const { cleanText, questions } = extractQuestions(fullText);
            const assistantMsg: ChatMessage = {
              id: `ai-${Date.now()}`,
              role: "assistant",
              content: cleanText,
              timestamp: Date.now(),
              mode,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setCurrentResponse("");
            setSuggestedQuestions(questions);
            setIsStreaming(false);
            onComplete?.(cleanText, questions);
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            const content = parsed.content ?? parsed.text ?? "";
            if (content) {
              fullText += content;
              setCurrentResponse((prev) => prev + content);
              onChunk?.(content);
            }
          } catch {
            // Non-JSON data — treat as raw text
            if (payload) {
              fullText += payload;
              setCurrentResponse((prev) => prev + payload);
              onChunk?.(payload);
            }
          }
        });

        es.addEventListener("error", (event: ErrorEvent | TimeoutEvent | ExceptionEvent) => {
          es.close();
          esRef.current = null;

          // If we got partial content, finalize it
          if (fullText) {
            const { cleanText, questions } = extractQuestions(fullText);
            const assistantMsg: ChatMessage = {
              id: `ai-${Date.now()}`,
              role: "assistant",
              content: cleanText,
              timestamp: Date.now(),
              mode,
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setCurrentResponse("");
            setSuggestedQuestions(questions);
            onComplete?.(cleanText, questions);
          } else {
            const errMsg = "message" in event ? event.message : "SSE connection failed";
            setError(errMsg);
            onError?.(errMsg);
          }
          setIsStreaming(false);
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Chat failed";
        setError(errMsg);
        onError?.(errMsg);
        setIsStreaming(false);
      }
    },
    [messages],
  );

  const stopStreaming = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (currentResponse) {
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: currentResponse + "\n\n[Stopped]",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setCurrentResponse("");
    }
    setIsStreaming(false);
  }, [currentResponse]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse("");
    setError(null);
    setSuggestedQuestions([]);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    currentResponse,
    suggestedQuestions,
    sendMessage,
    stopStreaming,
    clearMessages,
    setMessages,
  };
}

// ============================================================
// Question Extraction
// ============================================================

function extractQuestions(text: string): { cleanText: string; questions: string[] } {
  // Extract hidden question markers: <!--QUESTIONS:["q1","q2","q3"]-->
  const match = text.match(/<!--QUESTIONS:(.*?)-->/);
  if (!match) return { cleanText: text, questions: [] };

  try {
    const questions = JSON.parse(match[1]!);
    const cleanText = text.replace(/<!--QUESTIONS:.*?-->/, "").trim();
    return { cleanText, questions: Array.isArray(questions) ? questions : [] };
  } catch {
    return { cleanText: text, questions: [] };
  }
}
