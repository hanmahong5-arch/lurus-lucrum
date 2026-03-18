/**
 * ARIA Live Region Provider Component
 *
 * Manages the lifecycle of the global ARIA live announcer.
 * Mount this component once at the app root to enable
 * screen reader announcements throughout the application.
 *
 * WCAG 2.1 AA: Success Criterion 4.1.3 (Status Messages)
 */

'use client';

import { useEffect, useRef } from 'react';
import { createLiveAnnouncer, type LiveAnnouncer } from '@/lib/accessibility/live-region';

/**
 * LiveRegionProvider
 *
 * Initializes the global live region announcer when the app mounts
 * and cleans it up on unmount. This component renders nothing visible;
 * the live region elements are appended directly to document.body
 * for maximum screen reader compatibility.
 */
export function LiveRegionProvider() {
  const announcerRef = useRef<LiveAnnouncer | null>(null);

  useEffect(() => {
    announcerRef.current = createLiveAnnouncer();

    return () => {
      announcerRef.current?.destroy();
      announcerRef.current = null;
    };
  }, []);

  // This component renders no visible output
  return null;
}
