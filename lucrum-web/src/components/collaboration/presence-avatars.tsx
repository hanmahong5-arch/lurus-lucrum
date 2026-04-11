'use client';

import { cn } from '@/lib/utils';
import type { PresenceUser } from '@/hooks/use-presence';

interface PresenceAvatarsProps {
  users: PresenceUser[];
  maxDisplay?: number;
  size?: 'sm' | 'md';
  className?: string;
}

function getInitials(name: string): string {
  return name.substring(0, 2).toUpperCase();
}

// Deterministic color from name for consistent avatars
const AVATAR_COLORS = [
  'bg-accent/30 text-accent',
  'bg-profit/30 text-profit',
  'bg-blue-500/30 text-blue-400',
  'bg-purple-500/30 text-purple-400',
  'bg-cyan-500/30 text-cyan-400',
  'bg-pink-500/30 text-pink-400',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function PresenceAvatars({ users, maxDisplay = 5, size = 'sm', className }: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  const displayed = users.slice(0, maxDisplay);
  const overflow = users.length - maxDisplay;
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-xs';

  return (
    <div className={cn('flex items-center -space-x-1.5', className)}>
      {displayed.map((user) => (
        <div
          key={user.userId}
          className={cn(
            'rounded-full flex items-center justify-center font-medium ring-2 ring-void transition-transform hover:scale-110 hover:z-10',
            sizeClass,
            getColor(user.name)
          )}
          title={user.name}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-mono font-bold ring-2 ring-void bg-white/10 text-white/50',
            sizeClass
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
