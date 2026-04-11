'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Activity, Sparkles, ArrowLeft, BarChart3 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useCurrentUser } from '@/hooks/use-user-workspace';
import { useSafeAction } from '@/hooks/use-safe-action';
import { TeamList } from '@/components/team/team-list';
import { MemberList } from '@/components/team/member-list';
import { ActivityFeed } from '@/components/team/activity-feed';
import { SharedBacktestFeed } from '@/components/collaboration/shared-backtest-feed';
import { CreateTeamDialog } from '@/components/team/create-team-dialog';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';
import { useTeamScopeStore } from '@/lib/stores/team-scope-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { TeamInfo } from '@/lib/stores/team-scope-store';

interface MemberData {
  id: number;
  userId: string;
  role: string;
  name: string | null;
  email: string;
  avatar: string | null;
  joinedAt: string;
}

export default function TeamPage() {
  const { t } = useI18n();
  const { user, isAuthenticated } = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamInfo | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);

  const { teams, setTeams, addTeam, setScope } = useTeamScopeStore();

  // --- Safe data fetching ---

  const { execute: fetchTeams, isRunning: teamsLoading } = useSafeAction(
    async () => {
      const res = await fetch('/api/team');
      if (!res.ok) throw new Error('Failed to load teams');
      const data = await res.json();
      return (data.data ?? []) as Array<Record<string, unknown>>;
    },
    {
      onSuccess: (data) => {
        const teamList: TeamInfo[] = data.map((t) => ({
          id: t.id as number,
          name: t.name as string,
          slug: t.slug as string,
          role: 'member',
          memberCount: t.memberCount as number | undefined,
        }));
        setTeams(teamList);
      },
    }
  );

  const { execute: fetchMembers, isRunning: membersLoading } = useSafeAction(
    async (teamId: number) => {
      const res = await fetch(`/api/team/${teamId}/members`);
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json();
      return (data.data ?? []) as MemberData[];
    },
    {
      onSuccess: (data) => setMembers(data),
    }
  );

  useEffect(() => {
    if (isAuthenticated) fetchTeams();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectTeam = useCallback((team: TeamInfo) => {
    setSelectedTeam(team);
    setScope(team.id);
    fetchMembers(team.id);
  }, [setScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTeamCreated = useCallback((team: { id: number; name: string; slug: string }) => {
    const newTeam: TeamInfo = { ...team, role: 'owner' };
    addTeam(newTeam);
    handleSelectTeam(newTeam);
  }, [addTeam, handleSelectTeam]);

  const handleBack = useCallback(() => {
    setSelectedTeam(null);
    setScope('personal');
  }, [setScope]);

  // Current user's role in selected team
  const currentUserRole = selectedTeam
    ? members.find((m) => m.userId === user?.id)?.role ?? 'viewer'
    : 'viewer';

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
          <Users className="w-8 h-8 text-accent/40" />
        </div>
        <p className="text-white/30 text-sm">Please log in to manage teams.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Header with breadcrumb animation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {selectedTeam && (
            <button
              onClick={handleBack}
              className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/5 transition-all duration-200 hover:scale-105"
              title={t('team.myTeams')}
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {selectedTeam ? selectedTeam.name : t('team.title')}
              {selectedTeam && (
                <span className="text-xs text-white/20 font-normal font-mono">
                  /{selectedTeam.slug}
                </span>
              )}
            </h1>
            {!selectedTeam && (
              <p className="text-xs text-white/30 mt-0.5">
                {/* Oxytocin metaphor: team = guild */}
                {teams.length > 0
                  ? `${teams.length} 个公会，并肩作战`
                  : '创建你的量化交易公会，让策略在协作中进化'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --- Team list view (no team selected) --- */}
      {!selectedTeam ? (
        <div className="animate-in fade-in duration-300">
          {teamsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <p className="text-xs text-white/20">{t('common.loading')}</p>
              </div>
            </div>
          ) : (
            <TeamList
              teams={teams}
              onSelect={handleSelectTeam}
              onCreateClick={() => setCreateOpen(true)}
            />
          )}
        </div>
      ) : (
        /* --- Team detail view with Radix Tabs --- */
        <Tabs defaultValue="members" className="animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-surface">
              <TabsTrigger
                value="members"
                className="flex items-center gap-1.5 data-[state=active]:text-accent"
                onClick={() => fetchMembers(selectedTeam.id)}
              >
                <Users className="w-3.5 h-3.5" />
                {t('team.members')}
                <span className="ml-1 text-[10px] font-mono tabular-nums text-white/30">
                  {members.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="backtests"
                className="flex items-center gap-1.5 data-[state=active]:text-accent"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                回测动态
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="flex items-center gap-1.5 data-[state=active]:text-accent"
              >
                <Activity className="w-3.5 h-3.5" />
                {t('team.activity')}
              </TabsTrigger>
            </TabsList>

            {/* Invite CTA — pulse animation for empty teams */}
            {canInvite && (
              <button
                onClick={() => setInviteOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-primary-600 text-sm font-medium hover:bg-accent-400 transition-all btn-tactile ${
                  members.length <= 1 ? 'animate-pulse' : ''
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t('team.invite')}
                {members.length <= 1 && (
                  <Sparkles className="w-3 h-3 opacity-60" />
                )}
              </button>
            )}
          </div>

          <TabsContent value="members" className="mt-0">
            {membersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="glass-panel rounded-lg overflow-hidden">
                <MemberList
                  members={members}
                  teamId={selectedTeam.id}
                  currentUserRole={currentUserRole}
                  currentUserId={user?.id ?? ''}
                  onMembersChanged={() => fetchMembers(selectedTeam.id)}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="backtests" className="mt-0">
            <div className="glass-panel rounded-lg overflow-hidden">
              <SharedBacktestFeed teamId={selectedTeam.id} />
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <div className="glass-panel rounded-lg overflow-hidden">
              <ActivityFeed teamId={selectedTeam.id} />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleTeamCreated}
      />

      {selectedTeam && (
        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          teamId={selectedTeam.id}
          onInvited={() => fetchMembers(selectedTeam.id)}
        />
      )}
    </div>
  );
}
