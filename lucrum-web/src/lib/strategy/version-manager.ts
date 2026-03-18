/**
 * Strategy Version Manager
 *
 * Provides version creation, diff computation, and auto-description
 * generation for strategy code and parameter snapshots.
 *
 * Features:
 * - Create immutable version snapshots (code + params)
 * - Auto-generate human-readable version descriptions from param diffs
 * - Compute structured diffs between any two versions
 * - Support optional score attachment per version
 *
 * @module lib/strategy/version-manager
 */

import type { ScoreGrade } from "@/lib/backtest/score";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum length for auto-generated version descriptions */
const MAX_DESCRIPTION_LENGTH = 500;

/** Maximum number of parameter changes to include in description */
const MAX_PARAM_CHANGES_IN_DESCRIPTION = 5;

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single strategy version snapshot.
 * Immutable record of code + params at a point in time.
 */
export interface StrategyVersion {
  /** Unique version identifier */
  versionId: string;
  /** Reference to the parent strategy */
  strategyId: string;
  /** Strategy code at this version */
  code: string;
  /** Strategy parameters at this version (deep copy) */
  params: Record<string, unknown>;
  /** Human-readable description of changes */
  description: string;
  /** Unix timestamp in milliseconds */
  createdAt: number;
  /** Optional backtest score for this version */
  score?: { grade: ScoreGrade; score: number };
}

/**
 * Change type for a single parameter between two versions
 */
export type ParamChangeType = "modified" | "added" | "removed";

/**
 * A single parameter change between two versions
 */
export interface ParamChange {
  /** Parameter name */
  paramName: string;
  /** Change type */
  type: ParamChangeType;
  /** Previous value (undefined for added params) */
  oldValue?: unknown;
  /** New value (undefined for removed params) */
  newValue?: unknown;
}

/**
 * Structured diff result between two versions
 */
export interface VersionDiff {
  /** Whether the code content differs */
  hasCodeChanges: boolean;
  /** Whether any parameters changed */
  hasParamChanges: boolean;
  /** List of individual parameter changes */
  paramChanges: ParamChange[];
}

// =============================================================================
// VERSION CREATION
// =============================================================================

/**
 * Generate a unique version ID.
 * Uses timestamp + random suffix for uniqueness without external dependencies.
 */
function generateVersionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `v_${timestamp}_${random}`;
}

/**
 * Create a new strategy version snapshot.
 *
 * @param strategyId - Parent strategy identifier
 * @param code - Strategy code at this point
 * @param params - Strategy parameters (will be deep-copied)
 * @param description - Optional manual description (auto-generated if omitted)
 * @param score - Optional backtest score for this version
 * @returns New StrategyVersion record
 */
export function createVersion(
  strategyId: string,
  code: string,
  params: Record<string, unknown>,
  description?: string,
  score?: { grade: ScoreGrade; score: number }
): StrategyVersion {
  return {
    versionId: generateVersionId(),
    strategyId,
    code,
    params: structuredClone(params),
    description: description ?? "",
    createdAt: Date.now(),
    score,
  };
}

// =============================================================================
// AUTO-DESCRIPTION GENERATION
// =============================================================================

/**
 * Format a parameter value for display in descriptions.
 */
function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  return JSON.stringify(value);
}

/**
 * Generate a human-readable description of parameter changes.
 *
 * @param oldParams - Previous parameter values (null for initial version)
 * @param newParams - Current parameter values
 * @returns One-line description summarizing changes
 */
export function generateVersionDescription(
  oldParams: Record<string, unknown> | null,
  newParams: Record<string, unknown>
): string {
  // Initial version case
  if (oldParams === null) {
    const paramCount = Object.keys(newParams).length;
    if (paramCount === 0) return "Initial version";
    return `Initial version with ${paramCount} parameter(s)`;
  }

  const changes: string[] = [];
  const allKeysArray = Array.from(
    new Set([...Object.keys(oldParams), ...Object.keys(newParams)])
  );

  for (const key of allKeysArray) {
    const oldVal = oldParams[key];
    const newVal = newParams[key];
    const hasOld = key in oldParams;
    const hasNew = key in newParams;

    if (hasOld && hasNew) {
      // Check if value actually changed
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push(
          `${key}: ${formatParamValue(oldVal)} -> ${formatParamValue(newVal)}`
        );
      }
    } else if (!hasOld && hasNew) {
      changes.push(`+${key}: ${formatParamValue(newVal)}`);
    } else if (hasOld && !hasNew) {
      changes.push(`-${key}: ${formatParamValue(oldVal)}`);
    }
  }

  if (changes.length === 0) {
    return "No parameter changes (code update only)";
  }

  // Truncate if too many changes
  const displayed = changes.slice(0, MAX_PARAM_CHANGES_IN_DESCRIPTION);
  const remaining = changes.length - displayed.length;

  let desc = displayed.join("; ");
  if (remaining > 0) {
    desc += ` (+${remaining} more)`;
  }

  // Enforce max length
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    desc = desc.substring(0, MAX_DESCRIPTION_LENGTH - 3) + "...";
  }

  return desc;
}

// =============================================================================
// VERSION DIFF
// =============================================================================

/**
 * Compute a structured diff between two strategy versions.
 *
 * @param oldVersion - The earlier version
 * @param newVersion - The later version
 * @returns VersionDiff with code and parameter change details
 */
export function computeVersionDiff(
  oldVersion: StrategyVersion,
  newVersion: StrategyVersion
): VersionDiff {
  const hasCodeChanges = oldVersion.code !== newVersion.code;

  const paramChanges: ParamChange[] = [];
  const allKeysArray = Array.from(
    new Set([
      ...Object.keys(oldVersion.params),
      ...Object.keys(newVersion.params),
    ])
  );

  for (const key of allKeysArray) {
    const oldVal = oldVersion.params[key];
    const newVal = newVersion.params[key];
    const hasOld = key in oldVersion.params;
    const hasNew = key in newVersion.params;

    if (hasOld && hasNew) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        paramChanges.push({
          paramName: key,
          type: "modified",
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    } else if (!hasOld && hasNew) {
      paramChanges.push({
        paramName: key,
        type: "added",
        newValue: newVal,
      });
    } else if (hasOld && !hasNew) {
      paramChanges.push({
        paramName: key,
        type: "removed",
        oldValue: oldVal,
      });
    }
  }

  return {
    hasCodeChanges,
    hasParamChanges: paramChanges.length > 0,
    paramChanges,
  };
}
