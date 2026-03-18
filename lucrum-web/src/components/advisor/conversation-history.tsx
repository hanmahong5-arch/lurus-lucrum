"use client";

/**
 * Conversation History Panel
 *
 * Displays a browsable list of saved conversation sessions.
 * Supports restore, delete, and star/unstar operations.
 *
 * @module components/advisor/conversation-history
 */

import { cn } from "@/lib/utils";
import { useConversationStore } from "@/lib/advisor/conversation-store";
import type { ConversationSession } from "@/lib/advisor/conversation-store";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum characters to show for message preview */
const PREVIEW_MAX_LENGTH = 50;

// =============================================================================
// PROPS
// =============================================================================

interface ConversationHistoryProps {
  /** Callback when the panel should close */
  onClose: () => void;
  /** Additional CSS class */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format a timestamp for display (relative or absolute)
 */
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Get a preview of the first user message
 */
function getPreview(session: ConversationSession): string {
  const firstUserMsg = session.messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "空对话";

  const content = firstUserMsg.content;
  if (content.length <= PREVIEW_MAX_LENGTH) return content;
  return content.slice(0, PREVIEW_MAX_LENGTH) + "...";
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ConversationHistory({
  onClose,
  className,
}: ConversationHistoryProps) {
  const sessions = useConversationStore((s) => s.sessions) as ConversationSession[];
  const deleteSession = useConversationStore((s) => s.deleteSession) as (id: string) => void;
  const restoreSession = useConversationStore((s) => s.restoreSession) as (id: string) => void;
  const toggleStarred = useConversationStore((s) => s.toggleStarred) as (id: string) => void;

  // Sort: starred first, then by createdAt descending
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  const handleRestore = (sessionId: string) => {
    restoreSession(sessionId);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent triggering restore
    deleteSession(sessionId);
  };

  const handleToggleStar = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    toggleStarred(sessionId);
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-surface rounded-lg border border-[#1a1f36] max-h-[400px]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1f36]">
        <h3 className="text-sm font-medium text-gray-300">对话历史</h3>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-[#1a1f36] transition-colors"
          aria-label="关闭"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sortedSessions.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            没有对话记录
          </div>
        ) : (
          <div className="divide-y divide-[#1a1f36]">
            {sortedSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleRestore(session.id)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a1f36]/50 cursor-pointer transition-colors group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRestore(session.id);
                }}
              >
                {/* Star button */}
                <button
                  onClick={(e) => handleToggleStar(e, session.id)}
                  className={cn(
                    "flex-shrink-0 p-0.5 rounded transition-colors",
                    session.starred
                      ? "text-yellow-400"
                      : "text-gray-600 hover:text-gray-400"
                  )}
                  aria-label={session.starred ? "取消收藏" : "收藏"}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill={session.starred ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300 truncate">
                    {getPreview(session)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    <span>{formatTime(session.createdAt)}</span>
                    <span>·</span>
                    <span>{session.messages.length} 条消息</span>
                    {session.context?.symbol && (
                      <>
                        <span>·</span>
                        <span className="text-[#f5a623]">
                          {session.context.symbol}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className="flex-shrink-0 p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="删除"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversationHistory;
