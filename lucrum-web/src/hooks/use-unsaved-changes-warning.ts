'use client';

import { useEffect } from 'react';

/**
 * Shows the browser's "Leave page?" dialog when the user tries to navigate
 * away with unsaved changes. Also works with Next.js router navigation.
 *
 * Usage:
 *   useUnsavedChangesWarning(isDirty)
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
