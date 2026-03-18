/**
 * Conversation Store (Zustand + MMKV)
 *
 * Manages advisor chat sessions with persistence.
 * Adapted from lucrum-web, replaces localStorage with MMKV.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "@/lib/storage/mmkv";
import type { ChatMessage } from "@/lib/hooks/use-streaming-chat";

const MAX_SESSIONS = 15;

interface SessionContext {
  symbol?: string;
  stockName?: string;
  strategyName?: string;
  mode?: string;
}

export interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  starred: boolean;
  context?: SessionContext;
}

interface ConversationState {
  sessions: ConversationSession[];
  activeSessionId: string | null;

  createSession: (context?: SessionContext) => string;
  setActiveSession: (id: string | null) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  deleteSession: (id: string) => void;
  toggleStarred: (id: string) => void;
  clearAll: () => void;
  getActiveSession: () => ConversationSession | undefined;
}

function generateSessionId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  return first.content.slice(0, 40) + (first.content.length > 40 ? "..." : "");
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (context) => {
        const id = generateSessionId();
        const session: ConversationSession = {
          id,
          title: "New Chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          starred: false,
          context,
        };

        set((state) => {
          let sessions = [session, ...state.sessions];
          // FIFO eviction of oldest unstarred if over limit
          if (sessions.length > MAX_SESSIONS) {
            const starredCount = sessions.filter((s) => s.starred).length;
            if (sessions.length - starredCount > MAX_SESSIONS) {
              sessions = sessions.filter((s, i) => {
                if (s.starred) return true;
                return i < MAX_SESSIONS;
              });
            }
          }
          return { sessions, activeSessionId: id };
        });

        return id;
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      addMessage: (sessionId, message) => {
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            const messages = [...s.messages, message];
            return {
              ...s,
              messages,
              title: deriveTitle(messages),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        }));
      },

      toggleStarred: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, starred: !s.starred } : s,
          ),
        }));
      },

      clearAll: () => set({ sessions: [], activeSessionId: null }),

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId);
      },
    }),
    {
      name: "lucrum-conversations",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    },
  ),
);
