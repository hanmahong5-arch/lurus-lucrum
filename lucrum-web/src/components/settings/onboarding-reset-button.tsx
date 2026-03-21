/**
 * Onboarding Reset Button
 *
 * Allows the user to re-trigger the first-time welcome flow
 * from the settings page.
 *
 * @module components/settings/onboarding-reset-button
 */

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/use-onboarding";

export function OnboardingResetButton() {
  const { reset } = useOnboarding();
  const router = useRouter();
  const [triggered, setTriggered] = useState(false);

  const handleReset = useCallback(() => {
    reset();
    setTriggered(true);
    // Navigate to dashboard root so the overlay shows immediately
    router.push("/dashboard");
  }, [reset, router]);

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-neutral-200">
          {"\u91CD\u65B0\u67E5\u770B\u5F15\u5BFC"}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">
          {"\u91CD\u65B0\u663E\u793A\u65B0\u624B\u5F15\u5BFC\u6D41\u7A0B\uFF0C\u4E86\u89E3\u5E73\u53F0\u529F\u80FD"}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        disabled={triggered}
        className="shrink-0"
        data-testid="reset-onboarding-button"
      >
        <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
        {triggered ? "\u5DF2\u91CD\u7F6E" : "\u91CD\u65B0\u67E5\u770B"}
      </Button>
    </div>
  );
}
