/**
 * Team Scope Store
 * 团队范围切换 Store
 *
 * Manages the current scope (personal vs team) for data isolation.
 * Components use this to decide which tenantId to pass to API calls.
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// ============================================================================
// Types
// ============================================================================

export interface TeamInfo {
  id: number;
  name: string;
  slug: string;
  role: string;
  memberCount?: number;
}

interface TeamScopeState {
  /** 'personal' or a tenant ID number */
  currentScope: 'personal' | number;
  /** Cached list of user's teams */
  teams: TeamInfo[];
}

interface TeamScopeActions {
  setScope: (scope: 'personal' | number) => void;
  setTeams: (teams: TeamInfo[]) => void;
  addTeam: (team: TeamInfo) => void;
  removeTeam: (teamId: number) => void;
  getCurrentTeam: () => TeamInfo | null;
  reset: () => void;
}

type TeamScopeStore = TeamScopeState & TeamScopeActions & HydrationState;

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: TeamScopeState = {
  currentScope: 'personal',
  teams: [],
};

// ============================================================================
// Store
// ============================================================================

export const useTeamScopeStore = createPersistedStore<TeamScopeStore>(
  'team-scope',
  (set, get) => ({
    ...INITIAL_STATE,

    // Hydration
    _hasHydrated: false,
    _setHasHydrated: (hydrated: boolean) => set((state) => { state._hasHydrated = hydrated; }),

    setScope: (scope) => set((state) => {
      state.currentScope = scope;
    }),

    setTeams: (teams) => set((state) => {
      state.teams = teams;
      // If current scope team was removed, reset to personal
      if (typeof state.currentScope === 'number') {
        const exists = teams.some((t) => t.id === state.currentScope);
        if (!exists) state.currentScope = 'personal';
      }
    }),

    addTeam: (team) => set((state) => {
      const existing = state.teams.findIndex((t) => t.id === team.id);
      if (existing >= 0) {
        state.teams[existing] = team;
      } else {
        state.teams.push(team);
      }
    }),

    removeTeam: (teamId) => set((state) => {
      state.teams = state.teams.filter((t) => t.id !== teamId);
      if (state.currentScope === teamId) {
        state.currentScope = 'personal';
      }
    }),

    getCurrentTeam: () => {
      const { currentScope, teams } = get();
      if (currentScope === 'personal') return null;
      return teams.find((t) => t.id === currentScope) ?? null;
    },

    reset: () => set((state) => {
      state.currentScope = INITIAL_STATE.currentScope;
      state.teams = INITIAL_STATE.teams;
    }),
  }),
  {
    version: 1,
    partialize: (state) => ({
      currentScope: state.currentScope,
      teams: state.teams,
    } as unknown as TeamScopeStore),
  }
);

// ============================================================================
// Selectors
// ============================================================================

export const selectCurrentScope = (state: TeamScopeStore) => state.currentScope;
export const selectTeams = (state: TeamScopeStore) => state.teams;
export const selectTenantId = (state: TeamScopeStore): number | undefined =>
  typeof state.currentScope === 'number' ? state.currentScope : undefined;
