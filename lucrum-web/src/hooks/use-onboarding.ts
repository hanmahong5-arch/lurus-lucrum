/**
 * Onboarding State Hook
 *
 * Controls visibility of the first-time welcome flow overlay.
 * State is persisted in user-preferences-store so it survives page
 * refreshes and only shows on the very first visit.
 *
 * Can be reset from settings ("re-view onboarding guide").
 *
 * @module hooks/use-onboarding
 */

'use client';

import { useCallback } from 'react';
import {
  useUserPreferencesStore,
  selectHasCompletedOnboarding,
} from '@/lib/stores/user-preferences-store';

export interface UseOnboardingReturn {
  /** Whether the welcome overlay should be visible */
  shouldShow: boolean;
  /** Mark onboarding as completed (hides overlay) */
  complete: () => void;
  /** Reset onboarding state so the overlay shows again */
  reset: () => void;
}

export function useOnboarding(): UseOnboardingReturn {
  const hasCompleted = useUserPreferencesStore(selectHasCompletedOnboarding);
  const setHasCompletedOnboarding = useUserPreferencesStore(
    (s) => s.setHasCompletedOnboarding,
  );

  const complete = useCallback(() => {
    setHasCompletedOnboarding(true);
  }, [setHasCompletedOnboarding]);

  const reset = useCallback(() => {
    setHasCompletedOnboarding(false);
  }, [setHasCompletedOnboarding]);

  return {
    shouldShow: !hasCompleted,
    complete,
    reset,
  };
}
