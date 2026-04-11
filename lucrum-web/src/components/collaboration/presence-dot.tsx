'use client';

import { cn } from '@/lib/utils';

interface PresenceDotProps {
  online: boolean;
  className?: string;
}

/**
 * Animated online status indicator dot.
 * Green pulsing dot when online, gray when offline.
 */
export function PresenceDot({ online, className }: PresenceDotProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          online ? 'bg-profit' : 'bg-white/20'
        )}
      />
      {online && (
        <span className="absolute inset-0 w-2 h-2 rounded-full bg-profit animate-ping opacity-40" />
      )}
    </span>
  );
}
