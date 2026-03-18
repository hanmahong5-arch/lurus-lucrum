"use client";

/**
 * Debate View Component - Professional Fintech Terminal Style
 * 多空辩论视图组件 - 专业金融终端风格
 *
 * Displays Bull vs Bear debate sessions with:
 * - Glass morphism panels
 * - CN Market coloring (Bull=Profit/Red, Bear=Loss/Green by default)
 * - Animated indicators and progress
 * - Professional typography with tabular numbers
 *
 * Reference: TradingAgents (UCLA) debate visualization
 */

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type {
  DebateSession,
  DebateArgument,
  DebateConclusion,
} from '@/lib/advisor/agent/types';
import {
  isDebateComplete,
  getCurrentRound,
} from '@/lib/advisor/reaction/debate-engine';

// ============================================================================
// Component Props
// ============================================================================

interface DebateViewProps {
  session: DebateSession | null;
  isLoading?: boolean;
  currentSpeaker?: 'bull' | 'bear' | 'moderator' | null;
  streamingContent?: string;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function DebateView({
  session,
  isLoading = false,
  currentSpeaker,
  streamingContent,
  className,
}: DebateViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.arguments.length, streamingContent]);

  if (!session) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-surface-hover/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <p className="text-neutral-400 text-sm">选择一只股票开始多空辩论</p>
          <p className="text-neutral-600 text-xs mt-1">Select a stock to start Bull vs Bear debate</p>
        </div>
      </div>
    );
  }

  const currentRound = getCurrentRound(session);
  const complete = isDebateComplete(session);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header / 头部 */}
      <DebateHeader
        topic={session.topic}
        symbol={session.symbol}
        currentRound={currentRound}
        totalRounds={session.rounds}
        complete={complete}
        isLoading={isLoading}
      />

      {/* Debate Content / 辩论内容 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 py-4 px-1"
      >
        {/* Arguments / 论点 */}
        {session.arguments.map((arg, index) => (
          <ArgumentCard key={index} argument={arg} />
        ))}

        {/* Streaming Content / 流式内容 */}
        {isLoading && currentSpeaker && (
          <StreamingCard
            speaker={currentSpeaker}
            content={streamingContent || '思考中...'}
          />
        )}

        {/* Conclusion / 结论 */}
        {session.conclusion && (
          <ConclusionCard conclusion={session.conclusion} />
        )}
      </div>

      {/* Progress Bar / 进度条 */}
      <DebateProgress
        bullCount={session.arguments.filter(a => a.stance === 'bull').length}
        bearCount={session.arguments.filter(a => a.stance === 'bear').length}
        totalRounds={session.rounds}
        hasConclusion={!!session.conclusion}
      />
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface DebateHeaderProps {
  topic: string;
  symbol?: string;
  currentRound: number;
  totalRounds: number;
  complete: boolean;
  isLoading?: boolean;
}

function DebateHeader({
  topic,
  symbol,
  currentRound,
  totalRounds,
  complete,
  isLoading,
}: DebateHeaderProps) {
  return (
    <div className="border-b border-white/5 pb-4 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-profit/20 to-loss/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            {/* Title */}
            <div>
              <h3 className="font-medium text-neutral-200 flex items-center gap-2">
                多空辩论
                {symbol && (
                  <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full font-mono">
                    {symbol}
                  </span>
                )}
              </h3>
              <p className="text-sm text-neutral-500 mt-0.5 truncate max-w-md">{topic}</p>
            </div>
          </div>
        </div>
        {/* Status */}
        <div className="text-right shrink-0 ml-4">
          {complete ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-profit/10 text-profit text-xs font-medium rounded-full border border-profit/20">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              辩论完成
            </span>
          ) : isLoading ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full border border-accent/20">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              进行中
            </span>
          ) : (
            <span className="text-sm text-neutral-500 font-mono tabular-nums">
              第 {currentRound}/{totalRounds} 轮
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ArgumentCardProps {
  argument: DebateArgument;
}

/**
 * Argument Card - Bull/Bear stance display
 * 论点卡片 - 多空立场展示
 *
 * Uses profit/loss colors which respect CN/US market mode
 * Bull = Profit (Red in CN, Green in US)
 * Bear = Loss (Green in CN, Red in US)
 */
function ArgumentCard({ argument }: ArgumentCardProps) {
  const isBull = argument.stance === 'bull';

  return (
    <div
      className={cn(
        'glass-panel rounded-xl p-4 relative overflow-hidden transition-all duration-300',
        isBull
          ? 'border-l-4 border-l-profit bg-profit/5 hover:bg-profit/10'
          : 'border-l-4 border-l-loss bg-loss/5 hover:bg-loss/10'
      )}
    >
      {/* Glow effect / 发光效果 */}
      <div className={cn(
        "absolute top-0 left-0 w-32 h-32 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-20 pointer-events-none",
        isBull ? "bg-profit" : "bg-loss"
      )} />

      {/* Header / 头部 */}
      <div className="flex items-center gap-3 mb-3 relative">
        {/* Avatar */}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          isBull ? "bg-profit/20" : "bg-loss/20"
        )}>
          <span className="text-xl">{isBull ? '🐂' : '🐻'}</span>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-medium",
            isBull ? "text-profit" : "text-loss"
          )}>
            {isBull ? '多头研究员' : '空头研究员'}
            <span className="text-neutral-500 font-normal ml-2 text-xs">
              {isBull ? 'Bull Analyst' : 'Bear Analyst'}
            </span>
          </div>
        </div>
        {/* Round badge / 轮次标签 */}
        <span className={cn(
          "px-2 py-0.5 text-[10px] font-medium rounded-full font-mono tabular-nums",
          isBull ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"
        )}>
          R{argument.round}
        </span>
      </div>

      {/* Content / 内容 */}
      <div className="text-neutral-300 text-sm whitespace-pre-wrap leading-relaxed relative">
        {argument.content}
      </div>

      {/* Key Points / 核心论点 */}
      {argument.keyPoints.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5 relative">
          <div className="text-xs text-neutral-500 mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            核心论点
          </div>
          <ul className="text-sm text-neutral-400 space-y-2">
            {argument.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={cn(
                  "mt-1.5 w-1.5 h-1.5 rounded-full shrink-0",
                  isBull ? "bg-profit" : "bg-loss"
                )} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface StreamingCardProps {
  speaker: 'bull' | 'bear' | 'moderator';
  content: string;
}

/**
 * Streaming Card - Real-time typing indicator
 * 流式卡片 - 实时打字指示器
 */
function StreamingCard({ speaker, content }: StreamingCardProps) {
  const config = {
    bull: {
      icon: '🐂',
      name: '多头研究员',
      nameEn: 'Bull Analyst',
      colorClass: 'profit',
      bgClass: 'bg-profit/5',
      borderClass: 'border-l-profit',
    },
    bear: {
      icon: '🐻',
      name: '空头研究员',
      nameEn: 'Bear Analyst',
      colorClass: 'loss',
      bgClass: 'bg-loss/5',
      borderClass: 'border-l-loss',
    },
    moderator: {
      icon: '⚖️',
      name: '主持人',
      nameEn: 'Moderator',
      colorClass: 'primary',
      bgClass: 'bg-primary/5',
      borderClass: 'border-l-primary',
    },
  }[speaker];

  return (
    <div
      className={cn(
        'glass-panel rounded-xl p-4 border-l-4 relative overflow-hidden',
        config.bgClass,
        config.borderClass
      )}
    >
      {/* Animated glow / 动态发光 */}
      <div className={cn(
        "absolute top-0 left-0 w-32 h-32 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-30 pointer-events-none animate-pulse",
        `bg-${config.colorClass}`
      )} />

      {/* Header / 头部 */}
      <div className="flex items-center gap-3 mb-3 relative">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          `bg-${config.colorClass}/20`
        )}>
          <span className="text-xl">{config.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-${config.colorClass} font-medium`}>
            {config.name}
            <span className="text-neutral-500 font-normal ml-2 text-xs">
              {config.nameEn}
            </span>
          </div>
        </div>
        {/* Typing indicator / 打字指示器 */}
        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-surface rounded-full">
          <div className="thinking-dots">
            <span className={`bg-${config.colorClass}`} />
            <span className={`bg-${config.colorClass}`} />
            <span className={`bg-${config.colorClass}`} />
          </div>
          <span className="text-[10px] text-neutral-500">正在思考</span>
        </span>
      </div>

      {/* Content / 内容 */}
      <div className="text-neutral-300 text-sm whitespace-pre-wrap leading-relaxed relative">
        {content}
        <span className="inline-block w-0.5 h-4 bg-neutral-400 ml-0.5 animate-blink" />
      </div>
    </div>
  );
}

interface ConclusionCardProps {
  conclusion: DebateConclusion;
}

/**
 * Conclusion Card - Debate summary and verdict
 * 结论卡片 - 辩论总结和判决
 */
function ConclusionCard({ conclusion }: ConclusionCardProps) {
  const verdictConfig = {
    bullish: {
      icon: '📈',
      text: '偏多',
      textEn: 'Bullish',
      colorClass: 'profit',
      bgClass: 'bg-profit/10',
      borderClass: 'border-profit/30',
    },
    bearish: {
      icon: '📉',
      text: '偏空',
      textEn: 'Bearish',
      colorClass: 'loss',
      bgClass: 'bg-loss/10',
      borderClass: 'border-loss/30',
    },
    neutral: {
      icon: '➖',
      text: '中性',
      textEn: 'Neutral',
      colorClass: 'neutral-400',
      bgClass: 'bg-neutral-500/10',
      borderClass: 'border-neutral-500/30',
    },
  }[conclusion.finalVerdict];

  return (
    <div className="glass-panel rounded-xl p-4 border-l-4 border-l-primary relative overflow-hidden">
      {/* Background gradient / 背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

      {/* Header / 头部 */}
      <div className="flex items-center gap-3 mb-4 relative">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <div>
          <div className="font-medium text-neutral-200">
            综合结论
            <span className="text-neutral-500 font-normal ml-2 text-xs">Final Verdict</span>
          </div>
        </div>
      </div>

      {/* Verdict / 判决 */}
      <div className={cn(
        "flex items-center gap-4 mb-4 p-4 rounded-lg border relative",
        verdictConfig.bgClass,
        verdictConfig.borderClass
      )}>
        <div className="text-center shrink-0">
          <div className="text-4xl mb-1">{verdictConfig.icon}</div>
          <div className={cn("text-sm font-bold", `text-${verdictConfig.colorClass}`)}>
            {verdictConfig.text}
          </div>
          <div className="text-[10px] text-neutral-500">{verdictConfig.textEn}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-neutral-500 mb-1.5 flex items-center justify-between">
            <span>置信度 Confidence</span>
            <span className={cn("font-mono tabular-nums font-medium", `text-${verdictConfig.colorClass}`)}>
              {conclusion.confidenceLevel}%
            </span>
          </div>
          <div className="h-2 bg-void rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all duration-1000 rounded-full", `bg-${verdictConfig.colorClass}`)}
              style={{ width: `${conclusion.confidenceLevel}%` }}
            />
          </div>
        </div>
      </div>

      {/* Key Points / 核心论点 */}
      <div className="grid grid-cols-2 gap-4 mb-4 relative">
        {/* Bull Points / 多头论点 */}
        <div className="p-3 bg-profit/5 rounded-lg border border-profit/20">
          <div className="text-xs text-profit mb-2 flex items-center gap-1.5 font-medium">
            <span>🐂</span>
            多头核心论点
          </div>
          <ul className="text-sm text-neutral-400 space-y-1.5">
            {conclusion.keyBullPoints.slice(0, 3).map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-profit shrink-0" />
                <span className="text-xs leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Bear Points / 空头论点 */}
        <div className="p-3 bg-loss/5 rounded-lg border border-loss/20">
          <div className="text-xs text-loss mb-2 flex items-center gap-1.5 font-medium">
            <span>🐻</span>
            空头核心论点
          </div>
          <ul className="text-sm text-neutral-400 space-y-1.5">
            {conclusion.keyBearPoints.slice(0, 3).map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-loss shrink-0" />
                <span className="text-xs leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Consensus / 共识 */}
      {conclusion.consensus && (
        <div className="mb-4 p-3 bg-surface/50 rounded-lg border border-white/5 relative">
          <div className="text-xs text-neutral-500 mb-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            共识与分歧
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed">{conclusion.consensus}</p>
        </div>
      )}

      {/* Suggested Action / 操作建议 */}
      {conclusion.suggestedAction && (
        <div className="p-3 bg-accent/10 rounded-lg border border-accent/20 relative">
          <div className="text-xs text-accent mb-1.5 flex items-center gap-1.5 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            操作建议 Action Suggestion
          </div>
          <p className="text-sm text-neutral-200 leading-relaxed">{conclusion.suggestedAction}</p>
        </div>
      )}
    </div>
  );
}

interface DebateProgressProps {
  bullCount: number;
  bearCount: number;
  totalRounds: number;
  hasConclusion: boolean;
}

/**
 * Debate Progress Bar - Bull vs Bear progress visualization
 * 辩论进度条 - 多空进度可视化
 *
 * Uses profit/loss colors which respect CN/US market mode
 */
function DebateProgress({
  bullCount,
  bearCount,
  totalRounds,
  hasConclusion,
}: DebateProgressProps) {
  const totalSteps = totalRounds * 2 + 1; // Bull + Bear per round + Conclusion
  const currentStep = bullCount + bearCount + (hasConclusion ? 1 : 0);
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="pt-3 border-t border-white/5">
      {/* Stats row / 统计行 */}
      <div className="flex items-center gap-3 text-xs mb-2">
        {/* Bull stats / 多头统计 */}
        <div className="flex items-center gap-1.5">
          <span className="text-base">🐂</span>
          <span className="text-profit font-mono tabular-nums font-medium">
            {bullCount}
          </span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-500 font-mono tabular-nums">
            {totalRounds}
          </span>
        </div>

        {/* VS divider */}
        <span className="text-neutral-600 text-[10px]">vs</span>

        {/* Bear stats / 空头统计 */}
        <div className="flex items-center gap-1.5">
          <span className="text-base">🐻</span>
          <span className="text-loss font-mono tabular-nums font-medium">
            {bearCount}
          </span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-500 font-mono tabular-nums">
            {totalRounds}
          </span>
        </div>

        {/* Status / 状态 */}
        <span className="ml-auto">
          {hasConclusion ? (
            <span className="inline-flex items-center gap-1 text-profit">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已完成
            </span>
          ) : (
            <span className="text-neutral-500 font-mono tabular-nums">
              进度 {Math.round(progress)}%
            </span>
          )}
        </span>
      </div>

      {/* Progress bar / 进度条 */}
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-profit via-accent to-loss transition-all duration-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Compact Debate Summary
// ============================================================================

interface DebateSummaryProps {
  session: DebateSession;
  onClick?: () => void;
  className?: string;
}

/**
 * Debate Summary - Compact debate session card
 * 辩论摘要 - 紧凑辩论会话卡片
 *
 * Uses semantic colors that respect CN/US market mode
 */
export function DebateSummary({ session, onClick, className }: DebateSummaryProps) {
  const complete = isDebateComplete(session);
  const verdict = session.conclusion?.finalVerdict;

  const verdictConfig = verdict
    ? {
        bullish: {
          icon: '📈',
          text: '偏多',
          colorClass: 'text-profit',
          bgClass: 'bg-profit/10',
        },
        bearish: {
          icon: '📉',
          text: '偏空',
          colorClass: 'text-loss',
          bgClass: 'bg-loss/10',
        },
        neutral: {
          icon: '➖',
          text: '中性',
          colorClass: 'text-neutral-400',
          bgClass: 'bg-neutral-500/10',
        },
      }[verdict]
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full glass-panel rounded-lg p-3 transition-all duration-200 text-left group',
        'hover:bg-surface-hover hover:border-white/10',
        'active:scale-[0.99]',
        className
      )}
    >
      {/* Title row / 标题行 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-profit/20 to-loss/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <span className="font-medium text-neutral-200 truncate flex-1 group-hover:text-white transition-colors">
          {session.topic}
        </span>
        {/* Arrow indicator / 箭头指示器 */}
        <svg className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-all group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Meta row / 元数据行 */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {/* Symbol badge / 股票标签 */}
        {session.symbol && (
          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono text-[10px]">
            {session.symbol}
          </span>
        )}

        {/* Arguments count / 辩论轮数 */}
        <span className="text-neutral-500 font-mono tabular-nums">
          {session.arguments.length} 轮辩论
        </span>

        {/* Verdict badge / 判决标签 */}
        {verdictConfig && (
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            verdictConfig.bgClass,
            verdictConfig.colorClass
          )}>
            {verdictConfig.icon} {verdictConfig.text}
          </span>
        )}

        {/* In progress indicator / 进行中指示器 */}
        {!complete && (
          <span className="ml-auto inline-flex items-center gap-1 text-accent">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            进行中
          </span>
        )}
      </div>
    </button>
  );
}

export default DebateView;
