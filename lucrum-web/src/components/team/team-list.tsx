'use client';

import { Users, Plus } from 'lucide-react';
import { TeamRoleBadge } from './team-role-badge';
import { useI18n } from '@/lib/i18n/context';
import type { TeamInfo } from '@/lib/stores/team-scope-store';

interface TeamListProps {
  teams: TeamInfo[];
  onSelect: (team: TeamInfo) => void;
  onCreateClick: () => void;
}

export function TeamList({ teams, onSelect, onCreateClick }: TeamListProps) {
  const { t } = useI18n();

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-white/20" />
        </div>
        <p className="text-white/50 text-sm mb-1">{t('team.noTeams')}</p>
        <p className="text-white/30 text-xs mb-6">{t('team.createFirst')}</p>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-primary-600 text-sm font-medium hover:bg-accent-400 transition btn-tactile"
        >
          <Plus className="w-4 h-4" />
          {t('team.create')}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <button
          key={team.id}
          onClick={() => onSelect(team)}
          className="glass-panel p-4 rounded-lg text-left hover:bg-white/5 transition group"
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-medium text-white group-hover:text-accent transition truncate">
              {team.name}
            </h3>
            <TeamRoleBadge role={team.role} />
          </div>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Users className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums">{team.memberCount ?? '—'}</span>
          </div>
        </button>
      ))}

      {/* Create team card */}
      <button
        onClick={onCreateClick}
        className="glass-panel p-4 rounded-lg border-dashed flex items-center justify-center gap-2 text-white/30 hover:text-accent hover:border-accent/30 transition min-h-[80px]"
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">{t('team.create')}</span>
      </button>
    </div>
  );
}
