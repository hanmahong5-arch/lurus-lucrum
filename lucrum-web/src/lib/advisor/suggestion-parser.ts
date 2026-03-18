/**
 * Suggestion Parser
 *
 * Extracts structured, actionable parameter suggestions from AI advisor
 * response text. Uses a tagged block format [SUGGESTION]...[/SUGGESTION]
 * for reliable parsing.
 *
 * Pure functions, no side effects. Designed for testability.
 *
 * @module lib/advisor/suggestion-parser
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * A parsed actionable suggestion from the AI advisor response.
 */
export interface AiSuggestion {
  /** Unique identifier for this suggestion */
  id: string;
  /** Strategy parameter name to update */
  param: string;
  /** Target value (number, boolean, or string) */
  value: number | boolean | string;
  /** Human-readable display text (e.g., "Set stop-loss to 5%") */
  display: string;
  /** Reason for the suggestion */
  rationale: string;
  /** Expected outcome of applying the suggestion */
  impact: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Regex to match [SUGGESTION]...[/SUGGESTION] blocks */
const SUGGESTION_BLOCK_REGEX = /\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/g;

/** Required fields for a valid suggestion */
const REQUIRED_FIELDS = ["param", "value", "rationale", "impact"] as const;

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Parse a key-value field from a suggestion block line.
 * Expected format: "key: value"
 */
function parseField(line: string): { key: string; value: string } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;

  const key = line.slice(0, colonIndex).trim().toLowerCase();
  const value = line.slice(colonIndex + 1).trim();

  if (!key || !value) return null;
  return { key, value };
}

/**
 * Attempt to parse a string value into its most appropriate type.
 * - "true" / "false" -> boolean
 * - Numeric strings -> number
 * - Everything else -> string
 */
function parseValue(raw: string): number | boolean | string {
  // Boolean
  const lower = raw.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;

  // Number
  const num = Number(raw);
  if (!Number.isNaN(num) && raw.trim() !== "") return num;

  // String
  return raw;
}

/**
 * Generate a default display text from param name and value.
 * Used when the AI response does not include a "display" field.
 */
function buildDefaultDisplay(param: string, value: number | boolean | string): string {
  return `${param} → ${String(value)}`;
}

/**
 * Parse a single [SUGGESTION] block content into an AiSuggestion.
 * Returns null if the block is missing required fields.
 */
function parseSingleBlock(
  blockContent: string,
  index: number
): AiSuggestion | null {
  const fields = new Map<string, string>();

  for (const line of blockContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = parseField(trimmed);
    if (parsed) {
      fields.set(parsed.key, parsed.value);
    }
  }

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (!fields.has(field)) {
      return null;
    }
  }

  const param = fields.get("param")!;
  const rawValue = fields.get("value")!;
  const rationale = fields.get("rationale")!;
  const impact = fields.get("impact")!;
  const displayField = fields.get("display");

  const value = parseValue(rawValue);
  const display = displayField ?? buildDefaultDisplay(param, value);

  return {
    id: `sug-${index}-${param}`,
    param,
    value,
    display,
    rationale,
    impact,
  };
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Parse AI advisor response text and extract structured suggestions.
 *
 * Looks for [SUGGESTION]...[/SUGGESTION] tagged blocks in the response.
 * Each block must contain: param, value, rationale, impact.
 * Optionally: display (human-readable text for the suggestion).
 *
 * Returns an empty array if:
 * - Input is empty/null/undefined
 * - No [SUGGESTION] blocks found
 * - All blocks are malformed (missing required fields)
 *
 * @param responseText - Raw AI advisor response text
 * @returns Array of parsed suggestions, or empty array
 */
export function parseSuggestions(
  responseText: string | null | undefined
): AiSuggestion[] {
  if (!responseText || typeof responseText !== "string") {
    return [];
  }

  const suggestions: AiSuggestion[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  // Reset regex state
  SUGGESTION_BLOCK_REGEX.lastIndex = 0;

  while ((match = SUGGESTION_BLOCK_REGEX.exec(responseText)) !== null) {
    const blockContent = match[1];
    if (!blockContent) continue;

    const suggestion = parseSingleBlock(blockContent, index);
    if (suggestion) {
      suggestions.push(suggestion);
      index++;
    }
  }

  return suggestions;
}
