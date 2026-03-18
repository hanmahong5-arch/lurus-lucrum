/**
 * Conversation Store
 *
 * Zustand store for managing AI advisor conversation sessions.
 * Persists sessions to localStorage with FIFO eviction (max 10 sessions).
 * Starred sessions are protected from eviction.
 *
 * @module lib/advisor/conversation-store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { estimateMessageTokens } from "./token-tracker";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum number of conversation sessions to retain in localStorage */
export const MAX_SESSIONS = 10;

/** localStorage key for persistence */
const STORAGE_KEY = "lucrum-advisor-conversations";

/** Maximum characters for first message preview */
const PREVIEW_MAX_LENGTH = 60;

// =============================================================================
// TYPES
// =============================================================================

/** A single message in a conversation */
export interface ConversationMessage {
  /** Unique message identifier */
  id: string;
  /** Message author role */
  role: "user" | "assistant";
  /** Message text content */
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Optional metadata (agent name, response time, etc.) */
  metadata?: Record<string, unknown>;
}

/** Optional context attached to a conversation session */
export interface SessionContext {
  /** Stock symbol being discussed */
  symbol?: string;
  /** Stock display name */
  stockName?: string;
  /** Strategy name or description */
  strategyName?: string;
  /** Advisor mode used */
  mode?: string;
}

/** A complete conversation session */
export interface ConversationSession {
  /** Unique session identifier */
  id: string;
  /** Messages in chronological order */
  messages: ConversationMessage[];
  /** Creation timestamp (ms) */
  createdAt: number;
  /** Estimated total token usage */
  tokenUsage: number;
  /** Whether this session is starred (protected from eviction) */
  starred: boolean;
  /** Optional context metadata */
  context: SessionContext;
}

/** Summary of a session for list display */
export interface SessionSummary {
  id: string;
  createdAt: number;
  messageCount: number;
  tokenUsage: number;
  starred: boolean;
  firstMessagePreview: string;
  context: SessionContext;
}

// =============================================================================
// STORE STATE
// =============================================================================

interface ConversationStoreState {
  /** All persisted sessions */
  sessions: ConversationSession[];
  /** Currently active session ID */
  activeSessionId: string | null;

  // --- Actions ---

  /** Create a new session and set it as active */
  createSession: (context?: SessionContext) => string;
  /** Add a message to a specific session */
  addMessage: (sessionId: string, message: ConversationMessage) => void;
  /** Delete a session by ID */
  deleteSession: (sessionId: string) => void;
  /** Restore (activate) a session by ID */
  restoreSession: (sessionId: string) => void;
  /** Toggle the starred flag on a session */
  toggleStarred: (sessionId: string) => void;
  /** Remove all sessions and clear active */
  clearAllSessions: () => void;
  /** Get the currently active session object */
  getActiveSession: () => ConversationSession | null;
  /** Get a summary for a specific session */
  getSessionSummary: (sessionId: string) => SessionSummary | null;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Compute total token usage for a message list
 */
function computeTokenUsage(messages: ConversationMessage[]): number {
  return messages.reduce(
    (sum, msg) => sum + estimateMessageTokens(msg.content),
    0
  );
}

/**
 * Truncate text to a maximum length for preview
 */
function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_MAX_LENGTH) return text;
  return text.slice(0, PREVIEW_MAX_LENGTH) + "...";
}

/**
 * Evict the oldest unstarred session if sessions exceed MAX_SESSIONS.
 * Returns a new sessions array with eviction applied.
 */
function evictIfNeeded(sessions: ConversationSession[]): ConversationSession[] {
  if (sessions.length <= MAX_SESSIONS) return sessions;

  // Sort by createdAt ascending to find the oldest
  const sorted = [...sessions].sort((a, b) => a.createdAt - b.createdAt);

  // Find the oldest unstarred session
  const evictIndex = sorted.findIndex((s) => !s.starred);
  if (evictIndex === -1) {
    // All sessions are starred; drop the oldest anyway to enforce limit
    sorted.shift();
    return sorted;
  }

  // Remove the eviction target
  sorted.splice(evictIndex, 1);
  return sorted;
}

// =============================================================================
// STORE
// =============================================================================

export const useConversationStore = create<ConversationStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (context?: SessionContext): string => {
        const id = generateSessionId();
        const newSession: ConversationSession = {
          id,
          messages: [],
          createdAt: Date.now(),
          tokenUsage: 0,
          starred: false,
          context: context ?? {},
        };

        set((state) => {
          const updated = [...state.sessions, newSession];
          const evicted = evictIfNeeded(updated);
          return {
            sessions: evicted,
            activeSessionId: id,
          };
        });

        return id;
      },

      addMessage: (sessionId: string, message: ConversationMessage) => {
        set((state) => {
          const sessionIndex = state.sessions.findIndex(
            (s) => s.id === sessionId
          );
          if (sessionIndex === -1) return state;

          const session = state.sessions[sessionIndex]!;
          const updatedMessages = [...session.messages, message];
          const updatedTokenUsage = computeTokenUsage(updatedMessages);

          const updatedSessions = [...state.sessions];
          updatedSessions[sessionIndex] = {
            ...session,
            messages: updatedMessages,
            tokenUsage: updatedTokenUsage,
          };

          return { sessions: updatedSessions };
        });
      },

      deleteSession: (sessionId: string) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          activeSessionId:
            state.activeSessionId === sessionId
              ? null
              : state.activeSessionId,
        }));
      },

      restoreSession: (sessionId: string) => {
        const exists = get().sessions.some((s) => s.id === sessionId);
        if (!exists) return;
        set({ activeSessionId: sessionId });
      },

      toggleStarred: (sessionId: string) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, starred: !s.starred } : s
          ),
        }));
      },

      clearAllSessions: () => {
        set({ sessions: [], activeSessionId: null });
      },

      getActiveSession: (): ConversationSession | null => {
        const { sessions, activeSessionId } = get();
        if (!activeSessionId) return null;
        return sessions.find((s) => s.id === activeSessionId) ?? null;
      },

      getSessionSummary: (sessionId: string): SessionSummary | null => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return null;

        const firstUserMessage = session.messages.find(
          (m) => m.role === "user"
        );
        const preview = firstUserMessage
          ? truncatePreview(firstUserMessage.content)
          : "";

        return {
          id: session.id,
          createdAt: session.createdAt,
          messageCount: session.messages.length,
          tokenUsage: session.tokenUsage,
          starred: session.starred,
          firstMessagePreview: preview,
          context: session.context,
        };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => {
        // Guard against SSR where localStorage is not available
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      // Only persist data, not functions
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
