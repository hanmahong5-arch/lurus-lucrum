'use client';

import { useCallback } from 'react';

/**
 * Intercepts tab switches in PageTabs component when an operation is running.
 * Shows a confirmation dialog before allowing the switch.
 *
 * Returns a wrapper function that should be passed to onTabChange.
 */
export function useTabSwitchGuard(isOperationRunning: boolean) {
  const guardedSwitch = useCallback(
    (newTab: string, originalSwitch: (tab: string) => void) => {
      if (!isOperationRunning) {
        originalSwitch(newTab);
        return;
      }
      const confirmed = window.confirm(
        '\u5F53\u524D\u64CD\u4F5C\u6B63\u5728\u8FDB\u884C\u4E2D\uFF0C\u5207\u6362\u6807\u7B7E\u5C06\u53D6\u6D88\u64CD\u4F5C\u3002\u786E\u5B9A\u8981\u5207\u6362\u5417\uFF1F'
      );
      if (confirmed) {
        originalSwitch(newTab);
      }
    },
    [isOperationRunning]
  );

  return guardedSwitch;
}
