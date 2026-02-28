/**
 * Code Preview Component - VS Code Dark+ Style
 * 代码预览组件 - VS Code Dark+ 风格
 *
 * Features:
 * - Terminal-style header with traffic lights
 * - Line numbers with current line highlight
 * - Syntax highlighting for Python
 * - Minimap indicator
 * - Copy to clipboard with visual feedback
 * - Loading state with data processing animation
 */

"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CodePreviewProps {
  code: string;
  language?: string;
  isLoading?: boolean;
  filename?: string;
  showMinimap?: boolean;
  // Collapsible feature props / 折叠功能属性
  collapsible?: boolean;
  // Default to collapsed for better UX - user can expand to see full code
  // 默认折叠以获得更好的用户体验 - 用户可以展开查看完整代码
  defaultCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  // Code-parameter linkage props / 代码-参数联动属性
  highlightedLine?: number | null;
  onHighlightClear?: () => void;
}

// Python syntax highlighting tokens
const PYTHON_KEYWORDS = new Set([
  "class",
  "def",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "try",
  "except",
  "finally",
  "with",
  "as",
  "import",
  "from",
  "and",
  "or",
  "not",
  "in",
  "is",
  "True",
  "False",
  "None",
  "self",
  "super",
  "pass",
  "break",
  "continue",
  "raise",
  "yield",
  "lambda",
  "global",
  "nonlocal",
  "assert",
  "del",
]);

const PYTHON_BUILTINS = new Set([
  "print",
  "len",
  "range",
  "int",
  "float",
  "str",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "type",
  "isinstance",
  "abs",
  "max",
  "min",
  "sum",
  "round",
  "sorted",
  "reversed",
  "enumerate",
  "zip",
  "map",
  "filter",
  "open",
  "super",
]);

// Simple Python syntax highlighter
function highlightPython(code: string): React.ReactNode[] {
  const lines = code.split("\n");

  return lines.map((line, lineIndex) => {
    const tokens: React.ReactNode[] = [];
    let currentIndex = 0;

    // Process the line character by character
    while (currentIndex < line.length) {
      // Skip whitespace
      if (/\s/.test(line[currentIndex] ?? "")) {
        let whitespace = "";
        while (currentIndex < line.length && /\s/.test(line[currentIndex] ?? "")) {
          whitespace += line[currentIndex];
          currentIndex++;
        }
        tokens.push(whitespace);
        continue;
      }

      // Comments
      if (line[currentIndex] === "#") {
        tokens.push(
          <span key={`${lineIndex}-comment-${currentIndex}`} className="text-neutral-500 italic">
            {line.slice(currentIndex)}
          </span>
        );
        break;
      }

      // Triple-quoted strings (docstrings)
      if (line.slice(currentIndex, currentIndex + 3) === '"""' || line.slice(currentIndex, currentIndex + 3) === "'''") {
        const quote = line.slice(currentIndex, currentIndex + 3);
        let endIndex = line.indexOf(quote, currentIndex + 3);
        if (endIndex === -1) {
          // String continues to end of line
          tokens.push(
            <span key={`${lineIndex}-docstring-${currentIndex}`} className="text-amber-400">
              {line.slice(currentIndex)}
            </span>
          );
          break;
        } else {
          tokens.push(
            <span key={`${lineIndex}-docstring-${currentIndex}`} className="text-amber-400">
              {line.slice(currentIndex, endIndex + 3)}
            </span>
          );
          currentIndex = endIndex + 3;
          continue;
        }
      }

      // Strings
      if (line[currentIndex] === '"' || line[currentIndex] === "'") {
        const quote = line[currentIndex];
        let endIndex = currentIndex + 1;
        while (endIndex < line.length) {
          if (line[endIndex] === quote && line[endIndex - 1] !== "\\") {
            break;
          }
          endIndex++;
        }
        tokens.push(
          <span key={`${lineIndex}-string-${currentIndex}`} className="text-amber-400">
            {line.slice(currentIndex, endIndex + 1)}
          </span>
        );
        currentIndex = endIndex + 1;
        continue;
      }

      // Numbers
      if (/\d/.test(line[currentIndex] ?? "")) {
        let numStr = "";
        while (currentIndex < line.length && /[\d._]/.test(line[currentIndex] ?? "")) {
          numStr += line[currentIndex];
          currentIndex++;
        }
        tokens.push(
          <span key={`${lineIndex}-number-${currentIndex}`} className="text-purple-400">
            {numStr}
          </span>
        );
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(line[currentIndex] ?? "")) {
        let word = "";
        const wordStart = currentIndex;
        while (currentIndex < line.length && /[a-zA-Z0-9_]/.test(line[currentIndex] ?? "")) {
          word += line[currentIndex];
          currentIndex++;
        }

        // Check for function definition or class
        if (PYTHON_KEYWORDS.has(word)) {
          tokens.push(
            <span key={`${lineIndex}-keyword-${wordStart}`} className="text-pink-500 font-medium">
              {word}
            </span>
          );
        } else if (PYTHON_BUILTINS.has(word)) {
          tokens.push(
            <span key={`${lineIndex}-builtin-${wordStart}`} className="text-cyan-400">
              {word}
            </span>
          );
        } else if (line[currentIndex] === "(") {
          // Function call
          tokens.push(
            <span key={`${lineIndex}-function-${wordStart}`} className="text-blue-400">
              {word}
            </span>
          );
        } else {
          tokens.push(
            <span key={`${lineIndex}-identifier-${wordStart}`} className="text-neutral-200">
              {word}
            </span>
          );
        }
        continue;
      }

      // Operators and punctuation
      const operators = ["==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "//", "**", "->", "=>"];
      let foundOp = false;
      for (const op of operators) {
        if (line.slice(currentIndex, currentIndex + op.length) === op) {
          tokens.push(
            <span key={`${lineIndex}-op-${currentIndex}`} className="text-cyan-300">
              {op}
            </span>
          );
          currentIndex += op.length;
          foundOp = true;
          break;
        }
      }
      if (foundOp) continue;

      // Single character operators
      if (/[+\-*/%=<>!&|^~@:,.]/.test(line[currentIndex] ?? "")) {
        tokens.push(
          <span key={`${lineIndex}-punct-${currentIndex}`} className="text-cyan-300">
            {line[currentIndex]}
          </span>
        );
        currentIndex++;
        continue;
      }

      // Brackets
      if (/[()[\]{}]/.test(line[currentIndex] ?? "")) {
        tokens.push(
          <span key={`${lineIndex}-bracket-${currentIndex}`} className="text-yellow-300">
            {line[currentIndex]}
          </span>
        );
        currentIndex++;
        continue;
      }

      // Default - just add the character
      tokens.push(line[currentIndex]);
      currentIndex++;
    }

    return (
      <div key={lineIndex} className="leading-6 hover:bg-white/[0.02] transition-colors">
        {tokens.length > 0 ? tokens : "\u00A0"}
      </div>
    );
  });
}

// Minimap component
function Minimap({ code, scrollPercentage }: { code: string; scrollPercentage: number }) {
  const lines = code.split("\n");
  const maxLines = 100; // Show at most 100 lines in minimap
  const displayLines = lines.slice(0, maxLines);
  const viewportHeight = Math.min(30, Math.max(10, lines.length * 0.3)); // Viewport indicator height

  return (
    <div className="absolute right-0 top-0 bottom-0 w-16 bg-black/30 border-l border-white/5 overflow-hidden">
      {/* Viewport indicator */}
      <div
        className="absolute right-0 w-full bg-white/10 rounded-sm transition-transform duration-100"
        style={{
          height: `${viewportHeight}%`,
          top: `${scrollPercentage * (100 - viewportHeight)}%`,
        }}
      />
      {/* Minimap content */}
      <div className="p-1 text-[2px] leading-[3px] font-mono opacity-50 select-none">
        {displayLines.map((line, i) => (
          <div key={i} className="truncate whitespace-pre">
            {line.slice(0, 100)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Loading animation - Data processing feel
function LoadingAnimation() {
  return (
    <div className="p-8 flex flex-col items-center justify-center gap-4">
      {/* Processing dots */}
      <div className="flex items-center gap-1">
        <div className="thinking-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
      {/* Data stream effect */}
      <div className="w-48 h-1 bg-surface-hover rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-transparent via-primary to-transparent animate-data-stream"
          style={{ width: "200%", marginLeft: "-100%" }}
        />
      </div>
      <span className="text-sm text-neutral-400 font-mono">
        AI 正在生成策略代码...
      </span>
      <span className="text-xs text-neutral-500">
        Generating strategy code with AI...
      </span>
    </div>
  );
}

// Collapsed preview lines count / 折叠时显示的行数
const COLLAPSED_LINES = 20;

export function CodePreview({
  code,
  language = "python",
  isLoading = false,
  filename = "strategy.py",
  showMinimap = true,
  collapsible = true,
  defaultCollapsed = true,  // Changed: default to collapsed for generated strategy code
  onCollapseChange,
  highlightedLine = null,
  onHighlightClear,
}: CodePreviewProps) {
  const [copied, setCopied] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const highlightedLineRef = useRef<HTMLDivElement>(null);

  // Handle scroll for minimap
  const handleScroll = useCallback(() => {
    if (codeContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = codeContainerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      setScrollPercentage(maxScroll > 0 ? scrollTop / maxScroll : 0);
    }
  }, []);

  useEffect(() => {
    const container = codeContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Handle collapse toggle / 处理折叠切换
  const handleCollapseToggle = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onCollapseChange?.(newState);
  }, [isCollapsed, onCollapseChange]);

  // Auto-scroll to highlighted line / 自动滚动到高亮行
  useEffect(() => {
    if (highlightedLine !== null && highlightedLineRef.current && codeContainerRef.current) {
      // Expand if collapsed / 如果折叠则展开
      if (isCollapsed && highlightedLine > COLLAPSED_LINES) {
        setIsCollapsed(false);
        onCollapseChange?.(false);
      }
      // Scroll to highlighted line with delay for rendering / 延迟滚动等待渲染
      setTimeout(() => {
        highlightedLineRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [highlightedLine, isCollapsed, onCollapseChange]);

  // Syntax highlighted code
  const highlightedCode = useMemo(() => {
    if (!code || language !== "python") return null;
    return highlightPython(code);
  }, [code, language]);

  // Line count
  const lineCount = useMemo(() => (code ? code.split("\n").length : 0), [code]);

  // Collapsed lines calculation / 折叠时显示的行数计算
  const displayedLineCount = useMemo(() => {
    if (!isCollapsed) return lineCount;
    return Math.min(COLLAPSED_LINES, lineCount);
  }, [isCollapsed, lineCount]);

  // Lines remaining when collapsed / 折叠时剩余行数
  const hiddenLines = lineCount - displayedLineCount;

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="terminal-block overflow-hidden flex flex-col">
      {/* VS Code style header with traffic lights */}
      <div className="terminal-header flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="dot dot-red" />
            <div className="dot dot-yellow" />
            <div className="dot dot-green" />
          </div>
          {/* Filename */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">{filename}</span>
            <span className="px-1.5 py-0.5 text-[10px] bg-primary/20 text-primary rounded font-mono uppercase">
              {language}
            </span>
            {/* Unsaved indicator */}
            {code && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved" />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {code && (
            <span className="text-[10px] text-neutral-500 font-mono tabular-nums">
              {lineCount} lines
            </span>
          )}
          {/* Collapse/Expand toggle button / 折叠/展开切换按钮 */}
          {collapsible && code && lineCount > COLLAPSED_LINES && (
            <button
              onClick={handleCollapseToggle}
              className={cn(
                "px-2 py-1 text-xs rounded transition-all duration-150 btn-tactile",
                "bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-200",
                "flex items-center gap-1"
              )}
              title={isCollapsed ? "展开代码 / Expand code" : "折叠代码 / Collapse code"}
            >
              <svg
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  isCollapsed ? "rotate-0" : "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {isCollapsed ? "展开" : "折叠"}
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!code || isLoading}
            className={cn(
              "px-2.5 py-1 text-xs rounded transition-all duration-150 btn-tactile",
              copied
                ? "bg-green-500/20 text-green-400 glow-profit"
                : "bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-200",
              (!code || isLoading) && "opacity-50 cursor-not-allowed"
            )}
          >
            {copied ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Code content area */}
      <div className="relative flex-1 min-h-0">
        {isLoading ? (
          <LoadingAnimation />
        ) : code ? (
          <div className="flex h-full">
            {/* Line numbers / 行号 */}
            <div className="shrink-0 w-12 bg-black/20 border-r border-white/5 select-none">
              <div className="py-4 pr-3 text-right">
                {Array.from({ length: displayedLineCount }, (_, i) => {
                  const lineNum = i + 1;
                  const isHighlighted = highlightedLine === lineNum;
                  return (
                    <div
                      key={i}
                      ref={isHighlighted ? highlightedLineRef : undefined}
                      className={cn(
                        "text-[11px] leading-6 font-mono tabular-nums transition-all duration-200",
                        isHighlighted
                          ? "text-accent bg-accent/10 border-l-2 border-accent -ml-0.5 pl-0.5"
                          : "text-neutral-600 hover:text-neutral-400"
                      )}
                    >
                      {lineNum}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Code with syntax highlighting / 带语法高亮的代码 */}
            <div
              ref={codeContainerRef}
              className={cn(
                "flex-1 overflow-auto py-4 px-4 transition-all duration-300 min-h-[160px]",
                showMinimap && !isCollapsed && lineCount > 20 && "pr-20",
                isCollapsed && "max-h-[400px]"
              )}
            >
              <pre className="text-[13px] font-mono">
                {/* Render only displayed lines when collapsed / 折叠时只渲染显示的行 */}
                {isCollapsed && highlightedCode
                  ? (highlightedCode as React.ReactNode[]).slice(0, displayedLineCount)
                  : highlightedCode}
              </pre>
            </div>

            {/* Minimap (show for longer code when not collapsed) / 小地图（非折叠且代码较长时显示） */}
            {showMinimap && !isCollapsed && lineCount > 20 && (
              <Minimap code={code} scrollPercentage={scrollPercentage} />
            )}
          </div>
        ) : null}

        {/* Collapsed indicator / 折叠指示器 */}
        {isCollapsed && hiddenLines > 0 && (
          <button
            onClick={handleCollapseToggle}
            className={cn(
              "w-full py-2 px-4 flex items-center justify-center gap-2",
              "bg-gradient-to-t from-surface-hover/80 to-transparent",
              "border-t border-white/5 hover:border-accent/30",
              "text-xs text-neutral-400 hover:text-accent",
              "transition-all duration-200 cursor-pointer"
            )}
          >
            <span className="font-mono">···</span>
            <span>还有 {hiddenLines} 行代码</span>
            <span className="text-neutral-500">|</span>
            <span>{hiddenLines} more lines</span>
            <span className="font-mono">···</span>
          </button>
        )}

        {code ? null : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 mb-4 rounded-xl bg-surface-hover/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <p className="text-neutral-400 text-sm mb-1">
              输入策略描述后，AI 将在此处生成代码
            </p>
            <p className="text-neutral-500 text-xs">
              Enter a strategy description to generate Python code here
            </p>
          </div>
        )}
      </div>

      {/* Status bar */}
      {code && !isLoading && (
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-black/20 border-t border-white/5 text-[10px] text-neutral-500 font-mono">
          <div className="flex items-center gap-4">
            <span>Python</span>
            <span>UTF-8</span>
            <span>LF</span>
          </div>
          <div className="flex items-center gap-4">
            <span>VeighNa CTA Strategy</span>
            <span className="text-primary">GuShen AI</span>
          </div>
        </div>
      )}
    </div>
  );
}
