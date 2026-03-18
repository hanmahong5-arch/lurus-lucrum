"use client";

/**
 * Master Agent Cards Component
 *
 * Displays legendary investor perspectives with their quotes and philosophy
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { ALL_MASTER_AGENTS, getMasterAgentById } from '@/lib/advisor/agent/master-agents';
import type { MasterAgent, InvestmentPhilosophy } from '@/lib/advisor/agent/types';

// ============================================================================
// Component Props
// ============================================================================

interface MasterAgentCardsProps {
  selectedId?: string;
  onSelect?: (masterId: string) => void;
  layout?: 'grid' | 'horizontal';
  showDetails?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const philosophyColors: Record<InvestmentPhilosophy, string> = {
  value: 'from-blue-500/20 to-blue-900/20 border-blue-500/30',
  growth: 'from-green-500/20 to-green-900/20 border-green-500/30',
  trend: 'from-purple-500/20 to-purple-900/20 border-purple-500/30',
  quantitative: 'from-cyan-500/20 to-cyan-900/20 border-cyan-500/30',
  index: 'from-gray-500/20 to-gray-900/20 border-gray-500/30',
  dividend: 'from-yellow-500/20 to-yellow-900/20 border-yellow-500/30',
  momentum: 'from-orange-500/20 to-orange-900/20 border-orange-500/30',
};

const philosophyIcons: Record<InvestmentPhilosophy, string> = {
  value: '🏛️',
  growth: '🌱',
  trend: '📈',
  quantitative: '🔢',
  index: '📊',
  dividend: '💰',
  momentum: '🚀',
};

// ============================================================================
// Main Component
// ============================================================================

export function MasterAgentCards({
  selectedId,
  onSelect,
  layout = 'grid',
  showDetails = true,
  className,
}: MasterAgentCardsProps) {
  return (
    <div
      className={cn(
        layout === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
          : 'flex gap-4 overflow-x-auto pb-2',
        className
      )}
    >
      {ALL_MASTER_AGENTS.map((master) => (
        <MasterCard
          key={master.id}
          master={master}
          selected={selectedId === master.id}
          onClick={() => onSelect?.(master.id)}
          showDetails={showDetails}
          compact={layout === 'horizontal'}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Master Card Component
// ============================================================================

interface MasterCardProps {
  master: MasterAgent;
  selected?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

function MasterCard({
  master,
  selected = false,
  onClick,
  showDetails = true,
  compact = false,
}: MasterCardProps) {
  const philosophy = master.philosophy as InvestmentPhilosophy;
  const colorClass = philosophyColors[philosophy] || philosophyColors.value;
  const icon = philosophyIcons[philosophy] || '🎯';

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg border transition min-w-[200px]',
          'bg-gradient-to-br',
          colorClass,
          selected && 'ring-2 ring-accent'
        )}
      >
        <span className="text-3xl">{icon}</span>
        <div className="text-left">
          <div className="font-medium text-white">{master.name}</div>
          <div className="text-xs text-white/50">{master.masterName}</div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col p-4 rounded-xl border transition text-left',
        'bg-gradient-to-br',
        colorClass,
        selected && 'ring-2 ring-accent',
        onClick && 'hover:scale-[1.02] cursor-pointer'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl">{icon}</span>
        <div>
          <div className="font-medium text-white">{master.name}</div>
          <div className="text-sm text-white/60">{master.masterName}</div>
          <div className="text-xs text-white/40">{master.era}</div>
        </div>
      </div>

      {/* Quote */}
      <div className="flex-1">
        <blockquote className="text-sm text-white/80 italic border-l-2 border-white/30 pl-3">
          "{master.quotes[0]}"
        </blockquote>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="text-xs text-white/50 mb-2">核心规则</div>
          <ul className="text-xs text-white/70 space-y-1">
            {master.tradingRules.slice(0, 3).map((rule, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-3 h-3 bg-accent rounded-full" />
      )}
    </button>
  );
}

// ============================================================================
// Master Agent Preview
// ============================================================================

interface MasterAgentPreviewProps {
  masterId: string;
  className?: string;
}

export function MasterAgentPreview({ masterId, className }: MasterAgentPreviewProps) {
  const master = getMasterAgentById(masterId);

  if (!master) return null;

  const philosophy = master.philosophy as InvestmentPhilosophy;
  const icon = philosophyIcons[philosophy] || '🎯';

  return (
    <div className={cn('flex items-start gap-3 p-3 bg-white/5 rounded-lg', className)}>
      <span className="text-3xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white">{master.name}</div>
        <p className="text-sm text-white/70 mt-1 italic">
          "{master.quotes[0]}"
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {master.focusAreas.slice(0, 4).map((area, i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-xs bg-white/10 text-white/60 rounded"
            >
              {area}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Master Quote Display
// ============================================================================

interface MasterQuoteProps {
  masterId: string;
  className?: string;
}

export function MasterQuote({ masterId, className }: MasterQuoteProps) {
  const master = getMasterAgentById(masterId);

  if (!master) return null;

  const [quoteIndex, setQuoteIndex] = React.useState(0);

  // Rotate quotes
  React.useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % master.quotes.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [master.quotes.length]);

  return (
    <div className={cn('p-4 bg-white/5 rounded-lg', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">💬</span>
        <span className="font-medium text-white">{master.masterName}</span>
      </div>
      <blockquote className="text-white/80 italic transition-opacity duration-500">
        "{master.quotes[quoteIndex]}"
      </blockquote>
      <div className="flex justify-center gap-1 mt-3">
        {master.quotes.map((_, i) => (
          <span
            key={i}
            className={cn(
              'w-1.5 h-1.5 rounded-full transition',
              i === quoteIndex ? 'bg-accent' : 'bg-white/20'
            )}
          />
        ))}
      </div>
    </div>
  );
}

export default MasterAgentCards;
