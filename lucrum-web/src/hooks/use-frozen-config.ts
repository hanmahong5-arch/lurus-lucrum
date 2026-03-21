'use client';

import { useState } from 'react';

/**
 * Captures a snapshot of config when an operation starts.
 * While the operation is running, returns the frozen snapshot.
 * This prevents the displayed config from drifting while results are being computed.
 *
 * Usage:
 *   const { config, freeze, unfreeze, isFrozen } = useFrozenConfig(currentConfig)
 *   // When starting backtest:
 *   freeze()  // locks config to current values
 *   await runBacktest(config)  // uses frozen values
 *   unfreeze()  // allows config to update again
 */
export function useFrozenConfig<T>(liveConfig: T) {
  const [frozen, setFrozen] = useState<T | null>(null);

  return {
    config: frozen ?? liveConfig,
    freeze: () => setFrozen({ ...liveConfig }),
    unfreeze: () => setFrozen(null),
    isFrozen: frozen !== null,
  };
}
