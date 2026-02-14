/**
 * Tests for Conversation Store
 *
 * Validates session creation, message management, FIFO eviction,
 * starred session protection, localStorage persistence, and restoration.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";

// Mock localStorage before importing the store
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Import after mocking
import {
  useConversationStore,
  MAX_SESSIONS,
  type ConversationSession,
  type ConversationMessage,
} from "../conversation-store";

// =============================================================================
// HELPERS
// =============================================================================

function createMessage(
  role: "user" | "assistant",
  content: string
): ConversationMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

function resetStore() {
  const store = useConversationStore.getState();
  store.clearAllSessions();
}

// =============================================================================
// TESTS
// =============================================================================

describe("useConversationStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // Session creation
  // ---------------------------------------------------------------------------

  describe("createSession", () => {
    it("creates a new session with unique ID", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe("string");

      const sessions = useConversationStore.getState().sessions;
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe(sessionId);
    });

    it("creates a session with optional context", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession({
        symbol: "600519",
        strategyName: "KDJ Golden Cross",
      });

      const session = useConversationStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      expect(session?.context?.symbol).toBe("600519");
      expect(session?.context?.strategyName).toBe("KDJ Golden Cross");
    });

    it("sets the new session as active", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();
      expect(useConversationStore.getState().activeSessionId).toBe(sessionId);
    });

    it("initializes with empty messages and zero token usage", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();
      const session = useConversationStore
        .getState()
        .sessions.find((s) => s.id === sessionId);

      expect(session?.messages).toEqual([]);
      expect(session?.tokenUsage).toBe(0);
      expect(session?.starred).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Message management
  // ---------------------------------------------------------------------------

  describe("addMessage", () => {
    it("adds a message to the active session", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      act(() => {
        useConversationStore.getState().addMessage(sessionId, createMessage("user", "Hello"));
      });

      const session = useConversationStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      expect(session?.messages).toHaveLength(1);
      expect(session?.messages[0]?.content).toBe("Hello");
    });

    it("updates token usage when adding messages", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      act(() => {
        useConversationStore
          .getState()
          .addMessage(sessionId, createMessage("user", "Tell me about value investing"));
      });

      const session = useConversationStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      expect(session?.tokenUsage).toBeGreaterThan(0);
    });

    it("does nothing for a non-existent session", () => {
      const store = useConversationStore.getState();
      store.createSession();

      const before = useConversationStore.getState().sessions;
      act(() => {
        useConversationStore
          .getState()
          .addMessage("non-existent", createMessage("user", "Hello"));
      });
      const after = useConversationStore.getState().sessions;

      expect(before).toEqual(after);
    });
  });

  // ---------------------------------------------------------------------------
  // FIFO eviction
  // ---------------------------------------------------------------------------

  describe("FIFO eviction", () => {
    it("evicts oldest unstarred session when exceeding MAX_SESSIONS", () => {
      const store = useConversationStore.getState();

      // Create MAX_SESSIONS sessions
      const sessionIds: string[] = [];
      for (let i = 0; i < MAX_SESSIONS; i++) {
        sessionIds.push(store.createSession());
      }

      expect(useConversationStore.getState().sessions).toHaveLength(
        MAX_SESSIONS
      );

      // Create one more - should evict the oldest
      const newId = useConversationStore.getState().createSession();

      const sessions = useConversationStore.getState().sessions;
      expect(sessions).toHaveLength(MAX_SESSIONS);
      expect(sessions.find((s) => s.id === sessionIds[0])).toBeUndefined(); // First session evicted
      expect(sessions.find((s) => s.id === newId)).toBeDefined(); // New session present
    });

    it("does not evict starred sessions", () => {
      const store = useConversationStore.getState();

      // Create first session and star it
      const starredId = store.createSession();
      useConversationStore.getState().toggleStarred(starredId);

      // Fill up remaining slots
      for (let i = 1; i < MAX_SESSIONS; i++) {
        useConversationStore.getState().createSession();
      }

      // Create one more - should NOT evict the starred session
      useConversationStore.getState().createSession();

      const sessions = useConversationStore.getState().sessions;
      expect(sessions).toHaveLength(MAX_SESSIONS);
      expect(sessions.find((s) => s.id === starredId)).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Star/Unstar
  // ---------------------------------------------------------------------------

  describe("toggleStarred", () => {
    it("toggles starred status on a session", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      expect(
        useConversationStore.getState().sessions.find((s) => s.id === sessionId)
          ?.starred
      ).toBe(false);

      act(() => {
        useConversationStore.getState().toggleStarred(sessionId);
      });

      expect(
        useConversationStore.getState().sessions.find((s) => s.id === sessionId)
          ?.starred
      ).toBe(true);

      act(() => {
        useConversationStore.getState().toggleStarred(sessionId);
      });

      expect(
        useConversationStore.getState().sessions.find((s) => s.id === sessionId)
          ?.starred
      ).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Delete session
  // ---------------------------------------------------------------------------

  describe("deleteSession", () => {
    it("removes a session by ID", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      act(() => {
        useConversationStore.getState().deleteSession(sessionId);
      });

      expect(useConversationStore.getState().sessions).toHaveLength(0);
    });

    it("clears activeSessionId if the deleted session was active", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      expect(useConversationStore.getState().activeSessionId).toBe(sessionId);

      act(() => {
        useConversationStore.getState().deleteSession(sessionId);
      });

      expect(useConversationStore.getState().activeSessionId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Restore session
  // ---------------------------------------------------------------------------

  describe("restoreSession", () => {
    it("sets the active session ID", () => {
      const store = useConversationStore.getState();
      const id1 = store.createSession();
      const id2 = useConversationStore.getState().createSession();

      expect(useConversationStore.getState().activeSessionId).toBe(id2);

      act(() => {
        useConversationStore.getState().restoreSession(id1);
      });

      expect(useConversationStore.getState().activeSessionId).toBe(id1);
    });

    it("does nothing for a non-existent session", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      act(() => {
        useConversationStore.getState().restoreSession("non-existent");
      });

      // Active session remains unchanged
      expect(useConversationStore.getState().activeSessionId).toBe(sessionId);
    });
  });

  // ---------------------------------------------------------------------------
  // Get active session
  // ---------------------------------------------------------------------------

  describe("getActiveSession", () => {
    it("returns the active session", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession();

      const active = useConversationStore.getState().getActiveSession();
      expect(active?.id).toBe(sessionId);
    });

    it("returns null when no active session", () => {
      const active = useConversationStore.getState().getActiveSession();
      expect(active).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Clear all sessions
  // ---------------------------------------------------------------------------

  describe("clearAllSessions", () => {
    it("removes all sessions and clears active", () => {
      const store = useConversationStore.getState();
      store.createSession();
      useConversationStore.getState().createSession();

      act(() => {
        useConversationStore.getState().clearAllSessions();
      });

      expect(useConversationStore.getState().sessions).toHaveLength(0);
      expect(useConversationStore.getState().activeSessionId).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Session summary
  // ---------------------------------------------------------------------------

  describe("getSessionSummary", () => {
    it("returns summary for a session with messages", () => {
      const store = useConversationStore.getState();
      const sessionId = store.createSession({ symbol: "600519" });

      act(() => {
        useConversationStore
          .getState()
          .addMessage(
            sessionId,
            createMessage("user", "Tell me about Moutai")
          );
        useConversationStore
          .getState()
          .addMessage(
            sessionId,
            createMessage("assistant", "Moutai is a premium baijiu brand...")
          );
      });

      const summary = useConversationStore
        .getState()
        .getSessionSummary(sessionId);

      expect(summary).toBeTruthy();
      expect(summary?.messageCount).toBe(2);
      expect(summary?.firstMessagePreview).toContain("Moutai");
    });

    it("returns null for non-existent session", () => {
      const summary = useConversationStore
        .getState()
        .getSessionSummary("non-existent");
      expect(summary).toBeNull();
    });
  });
});
