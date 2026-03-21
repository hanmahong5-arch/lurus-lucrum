/**
 * Welcome Flow Gate
 *
 * Client component wrapper that conditionally renders the WelcomeFlow
 * overlay based on onboarding state from user-preferences-store.
 *
 * Meant to be rendered inside the dashboard layout (inside StoreHydrationGate)
 * so that the store has already been hydrated before this runs.
 *
 * @module components/onboarding/welcome-flow-gate
 */

"use client";

import dynamic from "next/dynamic";
import { useOnboarding } from "@/hooks/use-onboarding";

// Dynamic import to avoid loading the overlay bundle when not needed
const WelcomeFlow = dynamic(
  () =>
    import("@/components/onboarding/welcome-flow").then((m) => ({
      default: m.WelcomeFlow,
    })),
  { ssr: false },
);

export function WelcomeFlowGate() {
  const { shouldShow } = useOnboarding();

  if (!shouldShow) return null;

  return <WelcomeFlow />;
}
