'use client';

/**
 * Suggestion Hook
 *
 * Combines user action tracking, context detection, and suggestion
 * generation into a single hook consumed by SuggestionBanner.
 *
 * @module hooks/use-suggestions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useUserActions, isDismissed, dismissSuggestion } from '@/hooks/use-user-actions';
import {
  getTopSuggestion,
  type Suggestion,
  type UserState,
} from '@/lib/suggestions/next-action';
import {
  useStrategyWorkspaceStore,
  selectStrategyInput,
  selectGeneratedCode,
} from '@/lib/stores/strategy-workspace-store';
import { useUserWorkspace } from '@/hooks/use-user-workspace';

export function useSuggestions() {
  const pathname = usePathname();
  const { getContext } = useUserActions();
  const { user, isAuthenticated } = useUserWorkspace();

  // Workspace state for building UserState
  const strategyInput = useStrategyWorkspaceStore(selectStrategyInput);
  const generatedCode = useStrategyWorkspaceStore(selectGeneratedCode);

  const [currentSuggestion, setCurrentSuggestion] = useState<Suggestion | null>(null);

  // Build user state from various store data
  const userState: UserState = useMemo(() => ({
    lastStrategyName: strategyInput
      ? (strategyInput.length > 20 ? strategyInput.slice(0, 20) + '...' : strategyInput)
      : undefined,
    hasDraft: !!generatedCode,
    userName: user?.name ?? undefined,
  }), [strategyInput, generatedCode, user?.name]);

  // Recompute suggestion when path or actions change
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentSuggestion(null);
      return;
    }

    const context = getContext(pathname);
    const suggestion = getTopSuggestion(context, userState);

    if (suggestion && !isDismissed(suggestion.id)) {
      setCurrentSuggestion(suggestion);
    } else {
      setCurrentSuggestion(null);
    }
  }, [pathname, isAuthenticated, getContext, userState]);

  const dismiss = useCallback((suggestionId: string) => {
    dismissSuggestion(suggestionId);
    setCurrentSuggestion(null);
  }, []);

  return { suggestion: currentSuggestion, dismiss };
}
