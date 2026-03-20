/**
 * Advisor Store
 *
 * Persists AI investment advisor state across page navigation:
 * - Conversation history (capped at 50 messages)
 * - Selected advisor mode (chat / debate)
 * - Selected agents
 * - Active tab
 *
 * Storage: Zustand + persist + immer (localStorage)
 * Key: `lucrum:advisor`
 *
 * @module lib/stores/advisor-store
 */

import { createPersistedStore, type HydrationState } from './create-persisted-store';

// =============================================================================
// Types
// =============================================================================

export type AdvisorMode = 'chat' | 'debate';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface AdvisorMessage {
  /** Unique message ID */
  id: string;
  /** Sender role */
  role: MessageRole;
  /** Message content (markdown) */
  content: string;
  /** Agent ID that generated this message (null for user messages) */
  agentId: string | null;
  /** Agent display name */
  agentName: string | null;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Token count for this message (if tracked) */
  tokenCount?: number;
}

export interface SelectedAgent {
  /** Agent identifier */
  id: string;
  /** Agent display name */
  name: string;
  /** Agent school/category */
  school?: string;
}

export type AdvisorTab = 'chat' | 'history' | 'agents';

export interface AdvisorState {
  /** Current advisor mode */
  mode: AdvisorMode;
  /** Conversation messages (capped at MAX_MESSAGES) */
  messages: AdvisorMessage[];
  /** Selected agents for the session */
  selectedAgents: SelectedAgent[];
  /** Active tab in the advisor page */
  activeTab: AdvisorTab;
  /** Current conversation topic/title */
  conversationTitle: string | null;

  // Transient state (not persisted)
  /** Whether the advisor is currently generating a response */
  isGenerating: boolean;
  /** Error from last request */
  error: string | null;
  /** Whether the user is typing */
  isTyping: boolean;
}

interface AdvisorActions {
  setMode: (mode: AdvisorMode) => void;
  addMessage: (message: AdvisorMessage) => void;
  updateMessage: (id: string, patch: Partial<Pick<AdvisorMessage, 'content' | 'tokenCount'>>) => void;
  clearMessages: () => void;
  setSelectedAgents: (agents: SelectedAgent[]) => void;
  addAgent: (agent: SelectedAgent) => void;
  removeAgent: (agentId: string) => void;
  setActiveTab: (tab: AdvisorTab) => void;
  setConversationTitle: (title: string | null) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  setTyping: (typing: boolean) => void;
  reset: () => void;
}

export type AdvisorStore = AdvisorState & AdvisorActions & HydrationState;

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of messages retained in conversation history */
const MAX_MESSAGES = 50;

// =============================================================================
// Initial State
// =============================================================================

const INITIAL_STATE: AdvisorState = {
  mode: 'chat',
  messages: [],
  selectedAgents: [],
  activeTab: 'chat',
  conversationTitle: null,
  isGenerating: false,
  error: null,
  isTyping: false,
};

// =============================================================================
// Store
// =============================================================================

export const useAdvisorStore = createPersistedStore<AdvisorStore>(
  'advisor',
  (set) => ({
    ...INITIAL_STATE,
    _hasHydrated: false,
    _setHasHydrated: () => {},

    setMode: (mode) =>
      set((state) => {
        state.mode = mode;
      }),

    addMessage: (message) =>
      set((state) => {
        state.messages.push(message);

        // Evict oldest messages beyond cap
        if (state.messages.length > MAX_MESSAGES) {
          // Keep the first message (system prompt) and trim from the start
          const systemMessages = state.messages.filter((m) => m.role === 'system');
          const nonSystemMessages = state.messages.filter((m) => m.role !== 'system');
          const trimmedNonSystem = nonSystemMessages.slice(-(MAX_MESSAGES - systemMessages.length));
          state.messages = [...systemMessages, ...trimmedNonSystem];
        }
      }),

    updateMessage: (id, patch) =>
      set((state) => {
        const msg = state.messages.find((m) => m.id === id);
        if (msg) {
          Object.assign(msg, patch);
        }
      }),

    clearMessages: () =>
      set((state) => {
        state.messages = [];
        state.conversationTitle = null;
      }),

    setSelectedAgents: (agents) =>
      set((state) => {
        state.selectedAgents = agents;
      }),

    addAgent: (agent) =>
      set((state) => {
        if (!state.selectedAgents.some((a) => a.id === agent.id)) {
          state.selectedAgents.push(agent);
        }
      }),

    removeAgent: (agentId) =>
      set((state) => {
        state.selectedAgents = state.selectedAgents.filter((a) => a.id !== agentId);
      }),

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    setConversationTitle: (title) =>
      set((state) => {
        state.conversationTitle = title;
      }),

    setGenerating: (generating) =>
      set((state) => {
        state.isGenerating = generating;
        if (generating) {
          state.error = null;
        }
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isGenerating = false;
      }),

    setTyping: (typing) =>
      set((state) => {
        state.isTyping = typing;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, INITIAL_STATE);
      }),
  }),
  {
    version: 1,
    partialize: (state) => ({
      mode: state.mode,
      messages: state.messages.slice(-MAX_MESSAGES),
      selectedAgents: state.selectedAgents,
      activeTab: state.activeTab,
      conversationTitle: state.conversationTitle,
    }) as typeof state,
  }
);

// =============================================================================
// Selectors
// =============================================================================

export const selectAdvisorMode = (state: AdvisorStore) => state.mode;
export const selectAdvisorMessages = (state: AdvisorStore) => state.messages;
export const selectSelectedAgents = (state: AdvisorStore) => state.selectedAgents;
export const selectAdvisorActiveTab = (state: AdvisorStore) => state.activeTab;
export const selectAdvisorIsGenerating = (state: AdvisorStore) => state.isGenerating;
export const selectAdvisorError = (state: AdvisorStore) => state.error;
export const selectMessageCount = (state: AdvisorStore) => state.messages.length;
export const selectConversationTitle = (state: AdvisorStore) => state.conversationTitle;
export const selectLastMessage = (state: AdvisorStore) =>
  state.messages.length > 0 ? state.messages[state.messages.length - 1] : null;
