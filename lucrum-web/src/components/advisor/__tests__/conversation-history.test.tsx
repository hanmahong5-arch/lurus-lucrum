/**
 * Tests for ConversationHistory Component
 *
 * Validates session list rendering, restore/delete actions,
 * starred session display, and empty state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationHistory } from "../conversation-history";

// =============================================================================
// MOCKS
// =============================================================================

const { mockSessions, mockDeleteSession, mockRestoreSession, mockToggleStarred } =
  vi.hoisted(() => ({
    mockSessions: vi.fn(),
    mockDeleteSession: vi.fn(),
    mockRestoreSession: vi.fn(),
    mockToggleStarred: vi.fn(),
  }));

vi.mock("@/lib/advisor/conversation-store", () => ({
  useConversationStore: (selector: (state: unknown) => unknown) => {
    const state = {
      sessions: mockSessions(),
      activeSessionId: null,
      deleteSession: mockDeleteSession,
      restoreSession: mockRestoreSession,
      toggleStarred: mockToggleStarred,
    };
    return selector(state);
  },
}));

// =============================================================================
// TESTS
// =============================================================================

describe("ConversationHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no sessions exist", () => {
    mockSessions.mockReturnValue([]);
    render(<ConversationHistory onClose={vi.fn()} />);

    expect(screen.getByText(/没有对话记录/)).toBeInTheDocument();
  });

  it("renders session list with entries", () => {
    mockSessions.mockReturnValue([
      {
        id: "session-1",
        createdAt: Date.now() - 3600000,
        messages: [
          { id: "m1", role: "user", content: "Hello", timestamp: Date.now() },
          {
            id: "m2",
            role: "assistant",
            content: "Hi there",
            timestamp: Date.now(),
          },
        ],
        tokenUsage: 150,
        starred: false,
        context: { symbol: "600519" },
      },
      {
        id: "session-2",
        createdAt: Date.now() - 7200000,
        messages: [
          {
            id: "m3",
            role: "user",
            content: "Analyze Moutai",
            timestamp: Date.now(),
          },
        ],
        tokenUsage: 80,
        starred: true,
        context: {},
      },
    ]);

    render(<ConversationHistory onClose={vi.fn()} />);

    // Should show session count or entries
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(screen.getByText(/Analyze Moutai/)).toBeInTheDocument();
  });

  it("calls restoreSession when a session row is clicked", () => {
    const onClose = vi.fn();
    mockSessions.mockReturnValue([
      {
        id: "session-1",
        createdAt: Date.now(),
        messages: [
          { id: "m1", role: "user", content: "Hello", timestamp: Date.now() },
        ],
        tokenUsage: 50,
        starred: false,
        context: {},
      },
    ]);

    render(<ConversationHistory onClose={onClose} />);

    const sessionRow = screen.getByText(/Hello/);
    fireEvent.click(sessionRow);

    expect(mockRestoreSession).toHaveBeenCalledWith("session-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls deleteSession when delete button is clicked", () => {
    mockSessions.mockReturnValue([
      {
        id: "session-1",
        createdAt: Date.now(),
        messages: [
          { id: "m1", role: "user", content: "Hello", timestamp: Date.now() },
        ],
        tokenUsage: 50,
        starred: false,
        context: {},
      },
    ]);

    render(<ConversationHistory onClose={vi.fn()} />);

    const deleteButton = screen.getByLabelText(/删除/);
    fireEvent.click(deleteButton);

    expect(mockDeleteSession).toHaveBeenCalledWith("session-1");
  });

  it("shows star indicator for starred sessions", () => {
    mockSessions.mockReturnValue([
      {
        id: "session-1",
        createdAt: Date.now(),
        messages: [
          { id: "m1", role: "user", content: "Hello", timestamp: Date.now() },
        ],
        tokenUsage: 50,
        starred: true,
        context: {},
      },
    ]);

    render(<ConversationHistory onClose={vi.fn()} />);

    const starButton = screen.getByLabelText(/取消收藏/);
    expect(starButton).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    mockSessions.mockReturnValue([]);

    render(<ConversationHistory onClose={onClose} />);

    const closeButton = screen.getByLabelText(/关闭/);
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
