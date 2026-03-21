'use client';

import { useState, useEffect } from 'react';

/**
 * Returns a value that is safe during SSR hydration.
 * During SSR and initial client render: returns fallback.
 * After hydration: returns the actual value.
 * This prevents hydration mismatch for values that differ between server and client.
 */
export function useHydrationSafe<T>(getValue: () => T, fallback: T): T {
  const [value, setValue] = useState(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setValue(getValue());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After hydration, track live changes
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: track live value changes after hydration
  useEffect(() => {
    if (hydrated) setValue(getValue());
  });

  return value;
}
