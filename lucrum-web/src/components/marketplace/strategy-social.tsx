"use client";

/**
 * Strategy Social Components
 *
 * Like button + comment section for marketplace strategies.
 * Used in the marketplace strategy card and detail views.
 */

import { useState, useCallback } from "react";
import { Heart, MessageCircle, Share2, Send } from "lucide-react";
import { useAchievementStore } from "@/lib/stores/achievement-store";

// =============================================================================
// TYPES
// =============================================================================

interface Comment {
  id: number;
  userId: string;
  userName: string | null;
  content: string;
  parentId: number | null;
  createdAt: string;
}

// =============================================================================
// LIKE BUTTON
// =============================================================================

export function LikeButton({
  strategyId,
  initialLiked = false,
  initialCount = 0,
}: {
  strategyId: number;
  initialLiked?: boolean;
  initialCount?: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    // Optimistic update
    setLiked((prev) => !prev);
    setCount((prev) => (liked ? prev - 1 : prev + 1));

    try {
      const res = await fetch("/api/lurus/marketplace/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId }),
      });

      if (!res.ok) {
        // Revert optimistic update
        setLiked((prev) => !prev);
        setCount((prev) => (liked ? prev + 1 : prev - 1));
        return;
      }

      const data = (await res.json()) as { liked: boolean; totalLikes: number };
      setLiked(data.liked);
      setCount(data.totalLikes);
    } catch {
      // Revert
      setLiked((prev) => !prev);
      setCount((prev) => (liked ? prev + 1 : prev - 1));
    } finally {
      setLoading(false);
    }
  }, [strategyId, liked, loading]);

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1 text-xs transition ${
        liked
          ? "text-loss"
          : "text-white/40 hover:text-loss"
      }`}
    >
      <Heart
        className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`}
      />
      <span className="font-mono tabular-nums">{count}</span>
    </button>
  );
}

// =============================================================================
// SHARE BUTTON
// =============================================================================

export function ShareButton({
  strategyId,
  title,
}: {
  strategyId: number;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const recordAchievementStat = useAchievementStore((s) => s.recordStat);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/dashboard/marketplace?highlight=${strategyId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        // Achievement tracking: record share action
        recordAchievementStat('sharesCount', 1);
        return;
      } catch {
        // User cancelled or error, fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    // Achievement tracking: record share action
    recordAchievementStat('sharesCount', 1);
    setTimeout(() => setCopied(false), 2000);
  }, [strategyId, title, recordAchievementStat]);

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1 text-xs text-white/40 hover:text-accent transition"
    >
      <Share2 className="w-3.5 h-3.5" />
      <span>{copied ? "已复制" : "分享"}</span>
    </button>
  );
}

// =============================================================================
// COMMENT SECTION
// =============================================================================

export function CommentSection({
  strategyId,
  initialComments = [],
  initialCount = 0,
}: {
  strategyId: number;
  initialComments?: Comment[];
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCount);

  const fetchComments = useCallback(async () => {
    setFetchLoading(true);
    try {
      const res = await fetch(
        `/api/lurus/marketplace/comments?strategy_id=${strategyId}`
      );
      if (res.ok) {
        const data = (await res.json()) as { comments: Comment[] };
        setComments(data.comments);
        setCommentCount(data.comments.length);
      }
    } finally {
      setFetchLoading(false);
    }
  }, [strategyId]);

  const handleExpand = useCallback(() => {
    if (!expanded) {
      void fetchComments();
    }
    setExpanded((prev) => !prev);
  }, [expanded, fetchComments]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lurus/marketplace/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId,
          content: newComment.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { comment: Comment };
        setComments((prev) => [data.comment, ...prev]);
        setCommentCount((prev) => prev + 1);
        setNewComment("");
      }
    } finally {
      setLoading(false);
    }
  }, [strategyId, newComment, loading]);

  return (
    <div>
      {/* Toggle */}
      <button
        onClick={handleExpand}
        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span className="font-mono tabular-nums">{commentCount}</span>
      </button>

      {/* Expanded comment panel */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="写下你的评论..."
              maxLength={1000}
              className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
            />
            <button
              onClick={() => void handleSubmit()}
              disabled={loading || !newComment.trim()}
              className="px-2.5 py-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition disabled:opacity-30"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Comments list */}
          {fetchLoading ? (
            <div className="text-xs text-white/30 text-center py-4">
              加载评论...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-white/30 text-center py-4">
              暂无评论，来说点什么吧
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-2 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] text-accent font-medium">
                      {comment.userName ?? "匿名用户"}
                    </span>
                    <span className="text-[10px] text-white/20">
                      {new Date(comment.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
