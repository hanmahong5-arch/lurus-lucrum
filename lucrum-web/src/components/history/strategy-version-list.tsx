"use client";

/**
 * StrategyVersionList - Shows strategy version history with diffs.
 *
 * Features:
 * - Version list with timestamps
 * - Click to see diff (simplified inline diff view)
 * - "Rollback to this version" button
 */

import { useState, useCallback } from "react";
import { GitBranch, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export interface StrategyVersion {
  id: string;
  version: number;
  strategyName: string;
  timestamp: string;
  /** Number of lines changed */
  linesChanged: number;
  /** Summary of changes */
  changeSummary: string;
  /** Code content for diff */
  code?: string;
}

interface StrategyVersionListProps {
  versions: StrategyVersion[];
  onRollback: (version: StrategyVersion) => void;
}

// =============================================================================
// SIMPLE DIFF VIEW
// =============================================================================

function SimpleDiff({
  current,
  previous,
}: {
  current: string;
  previous: string | undefined;
}) {
  if (!previous) {
    return (
      <div className="terminal-block p-3 text-xs overflow-x-auto">
        <div className="text-profit/60 font-mono whitespace-pre-wrap">
          {current
            .split("\n")
            .map((line, i) => (
              <div key={i} className="flex">
                <span className="w-8 text-right pr-2 text-white/20 select-none shrink-0">
                  {i + 1}
                </span>
                <span className="text-profit/80">+ {line}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // Very simple line-by-line diff for display purposes
  const prevLines = previous.split("\n");
  const currLines = current.split("\n");
  const maxLines = Math.max(prevLines.length, currLines.length);
  const diffLines: { type: "same" | "add" | "remove"; text: string; lineNum: number }[] = [];

  for (let i = 0; i < maxLines; i++) {
    const pl = prevLines[i];
    const cl = currLines[i];
    if (pl === cl) {
      diffLines.push({ type: "same", text: cl ?? "", lineNum: i + 1 });
    } else {
      if (pl !== undefined) {
        diffLines.push({ type: "remove", text: pl, lineNum: i + 1 });
      }
      if (cl !== undefined) {
        diffLines.push({ type: "add", text: cl, lineNum: i + 1 });
      }
    }
  }

  return (
    <div className="terminal-block p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto">
      <div className="font-mono whitespace-pre-wrap">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              line.type === "add" && "bg-profit/5",
              line.type === "remove" && "bg-loss/5",
            )}
          >
            <span className="w-8 text-right pr-2 text-white/20 select-none shrink-0">
              {line.lineNum}
            </span>
            <span
              className={cn(
                line.type === "add" && "text-profit/80",
                line.type === "remove" && "text-loss/80",
                line.type === "same" && "text-white/40",
              )}
            >
              {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StrategyVersionList({
  versions,
  onRollback,
}: StrategyVersionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="space-y-2">
      {versions.map((version, index) => {
        const isExpanded = expandedId === version.id;
        const prevVersion = index < versions.length - 1 ? versions[index + 1] : undefined;
        const isLatest = index === 0;

        return (
          <div
            key={version.id}
            className={cn(
              "rounded-lg border transition",
              isExpanded
                ? "bg-surface border-white/15"
                : "bg-surface border-border hover:border-white/15",
            )}
          >
            {/* Header */}
            <button
              onClick={() => toggleExpand(version.id)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              <GitBranch className="w-4 h-4 text-white/30 shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    v{version.version}
                  </span>
                  <span className="text-xs text-white/50 truncate">
                    {version.strategyName}
                  </span>
                  {isLatest && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded border border-accent/20">
                      最新
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/30 mt-0.5 flex items-center gap-2">
                  <span className="font-mono tabular-nums">
                    {new Date(version.timestamp).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>|</span>
                  <span>{version.changeSummary}</span>
                  <span className="font-mono tabular-nums text-white/20">
                    ({version.linesChanged > 0 ? "+" : ""}
                    {version.linesChanged} 行)
                  </span>
                </div>
              </div>

              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
              )}
            </button>

            {/* Expanded: diff + rollback */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3">
                {/* Diff */}
                <SimpleDiff
                  current={version.code ?? "# No code available"}
                  previous={prevVersion?.code}
                />

                {/* Rollback button */}
                {!isLatest && (
                  <button
                    onClick={() => onRollback(version)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition btn-tactile"
                  >
                    <RotateCcw className="w-3 h-3" />
                    回滚到此版本
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
