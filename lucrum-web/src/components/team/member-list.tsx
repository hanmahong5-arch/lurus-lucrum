'use client';

import { MoreHorizontal, UserMinus, Shield, Crown, Eye, UserCheck } from 'lucide-react';
import { TeamRoleBadge } from './team-role-badge';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n/context';
import { useSafeAction } from '@/hooks/use-safe-action';

interface Member {
  id: number;
  userId: string;
  role: string;
  name: string | null;
  email: string;
  avatar: string | null;
  joinedAt: string;
}

interface MemberListProps {
  members: Member[];
  teamId: number;
  currentUserRole: string;
  currentUserId: string;
  onMembersChanged: () => void;
}

function getUserInitials(name: string | null, email: string): string {
  if (name && name.length > 0) return name.substring(0, 2).toUpperCase();
  return email.substring(0, 2).toUpperCase();
}

// Role icon mapping for visual decision tree
const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  member: UserCheck,
  viewer: Eye,
};

export function MemberList({ members, teamId, currentUserRole, currentUserId, onMembersChanged }: MemberListProps) {
  const { t } = useI18n();
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  const { execute: changeRole, isRunning: isChangingRole } = useSafeAction(
    async (userId: string, newRole: string) => {
      const res = await fetch(`/api/team/${teamId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole, tenantId: teamId }),
      });
      if (!res.ok) throw new Error('Failed to change role');
    },
    { onSuccess: () => onMembersChanged() }
  );

  const { execute: removeMember, isRunning: isRemoving } = useSafeAction(
    async (userId: string) => {
      const res = await fetch(`/api/team/${teamId}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove member');
    },
    { onSuccess: () => onMembersChanged() }
  );

  const isLoading = isChangingRole || isRemoving;

  return (
    <div className="divide-y divide-border/50">
      {members.map((member) => {
        const isSelf = member.userId === currentUserId;
        const isOwner = member.role === 'owner';
        const showActions = canManage && !isSelf && !isOwner;
        const RoleIcon = ROLE_ICONS[member.role] ?? UserCheck;

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150"
          >
            {/* Avatar with role-colored ring */}
            <div className={`relative w-9 h-9 rounded-full flex items-center justify-center border shrink-0 ${
              isOwner ? 'bg-accent/15 border-accent/30' : 'bg-white/5 border-white/10'
            }`}>
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt={member.name || member.email}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className={`text-xs font-medium ${isOwner ? 'text-accent' : 'text-white/50'}`}>
                  {getUserInitials(member.name, member.email)}
                </span>
              )}
              {/* Online dot placeholder — will be driven by presence in Phase 2 */}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white truncate">
                  {member.name || member.email.split('@')[0]}
                </span>
                {isSelf && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">you</Badge>
                )}
              </div>
              <p className="text-xs text-white/30 truncate">{member.email}</p>
            </div>

            {/* Role badge */}
            <TeamRoleBadge role={member.role} />

            {/* Actions dropdown */}
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded text-white/20 hover:text-white hover:bg-white/10 transition disabled:opacity-50"
                    disabled={isLoading}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Role change options — decision tree: show only valid transitions */}
                  {currentUserRole === 'owner' && member.role !== 'admin' && (
                    <DropdownMenuItem onClick={() => changeRole(member.userId, 'admin')}>
                      <Shield className="w-3.5 h-3.5 mr-2 text-profit" />
                      <span>{t('team.role.admin')}</span>
                    </DropdownMenuItem>
                  )}
                  {member.role !== 'member' && (
                    <DropdownMenuItem onClick={() => changeRole(member.userId, 'member')}>
                      <UserCheck className="w-3.5 h-3.5 mr-2" />
                      <span>{t('team.role.member')}</span>
                    </DropdownMenuItem>
                  )}
                  {member.role !== 'viewer' && (
                    <DropdownMenuItem onClick={() => changeRole(member.userId, 'viewer')}>
                      <Eye className="w-3.5 h-3.5 mr-2 text-white/40" />
                      <span>{t('team.role.viewer')}</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="text-loss focus:text-loss"
                    onClick={() => {
                      if (confirm(t('team.removeConfirm'))) {
                        removeMember(member.userId);
                      }
                    }}
                  >
                    <UserMinus className="w-3.5 h-3.5 mr-2" />
                    {t('team.removeMember')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
}
