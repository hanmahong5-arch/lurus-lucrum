'use client';

/**
 * Suggestion Banner
 *
 * A subtle, dismissable banner that shows the highest-priority
 * next-action suggestion. Renders below the header, slides in
 * from the top with a smooth animation.
 *
 * Design:
 * - bg-accent/5 border for subtle presence
 * - Max 1 suggestion visible at a time
 * - Remembers dismissal via sessionStorage
 * - Auto-hides when user navigates or acts
 */

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/lib/suggestions/next-action';
import {
  Lightbulb,
  FlaskConical,
  Play,
  TrendingUp,
  Search,
  LineChart,
  Sparkles,
  Zap,
  ArrowLeft,
  RotateCcw,
  ArrowRight,
  X,
} from 'lucide-react';

// =============================================================================
// ICON MAP
// =============================================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  FlaskConical,
  Play,
  TrendingUp,
  Search,
  LineChart,
  Sparkles,
  Zap,
  ArrowLeft,
  RotateCcw,
};

// =============================================================================
// COMPONENT
// =============================================================================

interface SuggestionBannerProps {
  suggestion: Suggestion | null;
  onDismiss: (id: string) => void;
  className?: string;
}

export function SuggestionBanner({ suggestion, onDismiss, className }: SuggestionBannerProps) {
  const [visible, setVisible] = useState(false);

  // Animate in when suggestion changes
  useEffect(() => {
    if (suggestion) {
      // Small delay for slide-in animation
      const timer = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(timer);
    }
    setVisible(false);
    return undefined;
  }, [suggestion?.id, suggestion]);

  const handleDismiss = useCallback(() => {
    if (!suggestion) return;
    setVisible(false);
    // Wait for slide-out animation before removing
    setTimeout(() => onDismiss(suggestion.id), 200);
  }, [suggestion, onDismiss]);

  if (!suggestion) return null;

  const IconComponent = ICON_MAP[suggestion.icon] ?? Lightbulb;

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-300 ease-out',
        visible
          ? 'max-h-20 opacity-100 translate-y-0'
          : 'max-h-0 opacity-0 -translate-y-2',
        className,
      )}
    >
      <div
        className={cn(
          'mx-4 sm:mx-6 mt-2',
          'flex items-center gap-3 px-4 py-2.5',
          'bg-accent/5 border border-accent/20 rounded-lg',
          'backdrop-blur-sm',
        )}
      >
        {/* Icon */}
        <IconComponent className="w-4 h-4 text-accent shrink-0" />

        {/* Message */}
        <p className="flex-1 text-sm text-white/80 truncate">
          {suggestion.message}
        </p>

        {/* Action button */}
        <Link
          href={suggestion.actionHref}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium',
            'bg-accent/10 text-accent hover:bg-accent/20',
            'transition-colors duration-150 whitespace-nowrap',
          )}
        >
          {suggestion.actionLabel}
          <ArrowRight className="w-3 h-3" />
        </Link>

        {/* Dismiss button */}
        {suggestion.dismissable && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            aria-label="dismiss suggestion"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
