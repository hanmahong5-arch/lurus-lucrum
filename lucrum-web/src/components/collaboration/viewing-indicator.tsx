'use client';

import { Eye } from 'lucide-react';
import type { PresenceUser } from '@/hooks/use-presence';
import { PresenceAvatars } from './presence-avatars';

interface ViewingIndicatorProps {
  users: PresenceUser[];
  currentUserId: string;
}

/**
 * Banner showing who else is viewing the same resource.
 * Filters out the current user.
 */
export function ViewingIndicator({ users, currentUserId }: ViewingIndicatorProps) {
  const others = users.filter((u) => u.userId !== currentUserId);

  if (others.length === 0) return null;

  const names = others.length <= 2
    ? others.map((u) => u.name.split(' ')[0]).join(' 和 ')
    : `${others[0]!.name.split(' ')[0]} 等 ${others.length} 人`;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/5 border border-accent/10 text-xs text-accent/80 animate-in fade-in slide-in-from-top-1 duration-300">
      <Eye className="w-3.5 h-3.5 shrink-0 text-accent/50" />
      <PresenceAvatars users={others} maxDisplay={3} size="sm" />
      <span>{names} 也在查看</span>
    </div>
  );
}
