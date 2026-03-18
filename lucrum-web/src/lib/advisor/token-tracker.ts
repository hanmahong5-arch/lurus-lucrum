/**
 * Token Tracker Utility
 *
 * Pure functions for estimating token usage, computing budget,
 * and detecting threshold levels in AI advisor conversations.
 *
 * Reuses the estimation algorithm from context-builder.ts for consistency.
 *
 * @module lib/advisor/token-tracker
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default conversation token budget (based on typical LLM context windows) */
export const CONVERSATION_TOKEN_BUDGET = 8000;

/** Warning threshold percentage - user should be alerted */
export const TOKEN_WARNING_THRESHOLD = 90;

/** Exhaustion threshold percentage - conversation should be truncated */
export const TOKEN_EXHAUSTION_THRESHOLD = 100;

// =============================================================================
// TYPES
// =============================================================================

/** Message shape for token estimation */
export interface TokenMessage {
  role: "user" | "assistant";
  content: string;
}

/** Budget usage result */
export interface BudgetUsage {
  /** Total tokens used across all messages */
  used: number;
  /** Total budget available */
  total: number;
  /** Usage percentage (0-100, capped at 100) */
  percentage: number;
  /** Remaining tokens */
  remaining: number;
}

/** Usage level for visual indicator */
export type UsageLevel = "low" | "medium" | "high";

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate token count for a single message.
 *
 * Uses heuristic: Chinese chars ~1.5 chars/token, English ~4 chars/token.
 * This matches the estimateTokens function in context-builder.ts.
 *
 * @param text - Message content
 * @returns Estimated token count
 */
export function estimateMessageTokens(text: string): number {
  if (!text) return 0;

  // Chinese characters: ~1.5 chars per token
  // English/symbols: ~4 chars per token
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// =============================================================================
// BUDGET COMPUTATION
// =============================================================================

/**
 * Compute the total token budget usage for a list of messages.
 *
 * @param messages - Array of conversation messages
 * @param budget - Total token budget (defaults to CONVERSATION_TOKEN_BUDGET)
 * @returns BudgetUsage with used, total, percentage, remaining
 */
export function computeBudgetUsage(
  messages: TokenMessage[],
  budget: number = CONVERSATION_TOKEN_BUDGET
): BudgetUsage {
  const used = messages.reduce(
    (sum, msg) => sum + estimateMessageTokens(msg.content),
    0
  );

  const percentage = budget > 0 ? Math.min(Math.round((used / budget) * 100), 100) : 0;
  const remaining = Math.max(budget - used, 0);

  return { used, total: budget, percentage, remaining };
}

// =============================================================================
// THRESHOLD DETECTION
// =============================================================================

/**
 * Get the usage level for visual indicator colors.
 *
 * @param percentage - Usage percentage (0-100)
 * @returns UsageLevel: "low" (<70%), "medium" (70-90%), "high" (>90%)
 */
export function getUsageLevel(percentage: number): UsageLevel {
  if (percentage >= 90) return "high";
  if (percentage >= 70) return "medium";
  return "low";
}

/**
 * Check if usage is near exhaustion (>= WARNING_THRESHOLD).
 *
 * @param percentage - Usage percentage
 * @returns true if near exhaustion
 */
export function isNearExhaustion(percentage: number): boolean {
  return percentage >= TOKEN_WARNING_THRESHOLD;
}

/**
 * Check if the token budget is fully exhausted.
 *
 * @param percentage - Usage percentage
 * @returns true if exhausted
 */
export function isExhausted(percentage: number): boolean {
  return percentage >= TOKEN_EXHAUSTION_THRESHOLD;
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format a token count with thousands separators.
 *
 * @param count - Token count
 * @returns Formatted string (e.g., "1,500")
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString("en-US");
}
