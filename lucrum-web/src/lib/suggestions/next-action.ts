/**
 * Next-Action Suggestion Engine
 *
 * Analyzes the user's recent actions and current state to suggest
 * the most relevant next action. Suggestions are surfaced as a
 * subtle banner or card at the top of the content area.
 *
 * Design philosophy: stock traders follow a daily routine.
 * Anticipate their needs rather than waiting for explicit requests.
 *
 * @module lib/suggestions/next-action
 */

// =============================================================================
// TYPES
// =============================================================================

/** Contextual situation that drives suggestion selection */
export type SuggestionContext =
  | 'after-backtest'        // Just completed a backtest
  | 'after-generation'      // Just generated a strategy
  | 'viewing-marketplace'   // Browsing marketplace
  | 'idle-dashboard'        // On dashboard, not doing anything
  | 'returning-user'        // Just logged in
  | 'after-portfolio'       // Completed portfolio backtest
  | 'watchlist-changed'     // Added stocks to watchlist
  | 'first-time';           // First visit after onboarding

/** Additional user state used to refine suggestions */
export interface UserState {
  /** Whether the last backtest had positive returns */
  lastBacktestPositive?: boolean;
  /** Name of the user's most recent strategy */
  lastStrategyName?: string;
  /** Number of stocks in watchlist */
  watchlistCount?: number;
  /** Number of free backtests remaining today */
  freeBacktestsRemaining?: number;
  /** Total free backtests allowed per day */
  freeBacktestsTotal?: number;
  /** Whether the user has a draft strategy in progress */
  hasDraft?: boolean;
  /** Whether the user is on a free plan */
  isFreePlan?: boolean;
  /** Display name of the user */
  userName?: string;
}

/** A single actionable suggestion */
export interface Suggestion {
  /** Unique identifier for dismissal tracking */
  id: string;
  /** Conversational message in Chinese */
  message: string;
  /** Button text */
  actionLabel: string;
  /** Navigation target */
  actionHref: string;
  /** Lucide icon name (used by consumer for rendering) */
  icon: string;
  /** Higher number = higher priority */
  priority: number;
  /** Whether the user can dismiss this suggestion */
  dismissable: boolean;
}

// =============================================================================
// SUGGESTION DEFINITIONS
// =============================================================================

/**
 * Build context-specific suggestions. Each function returns an array
 * of candidate suggestions; the consumer picks the highest-priority one.
 */

function afterBacktestSuggestions(state: UserState): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (state.lastBacktestPositive) {
    suggestions.push({
      id: 'after-backtest-positive',
      message: '策略表现不错！想要在更多股票上验证吗？',
      actionLabel: '去组合验证',
      actionHref: '/dashboard/validation?tab=portfolio',
      icon: 'FlaskConical',
      priority: 80,
      dismissable: true,
    });
  } else {
    suggestions.push({
      id: 'after-backtest-negative',
      message: '可以试试调整参数或换一个策略模板',
      actionLabel: '查看模板',
      actionHref: '/dashboard',
      icon: 'Lightbulb',
      priority: 70,
      dismissable: true,
    });
  }

  if (state.isFreePlan && state.freeBacktestsRemaining !== undefined
      && state.freeBacktestsTotal !== undefined
      && state.freeBacktestsRemaining <= 0) {
    suggestions.push({
      id: 'free-limit-reached',
      message: `今日免费回测已用完 (${state.freeBacktestsTotal}/${state.freeBacktestsTotal})，升级可无限回测`,
      actionLabel: '查看套餐',
      actionHref: '/dashboard/settings?tab=subscription',
      icon: 'Zap',
      priority: 90,
      dismissable: true,
    });
  }

  return suggestions;
}

function afterGenerationSuggestions(_state: UserState): Suggestion[] {
  return [
    {
      id: 'after-generation',
      message: '策略已生成，选一只股票回测看看效果',
      actionLabel: '开始回测',
      actionHref: '/dashboard',
      icon: 'Play',
      priority: 85,
      dismissable: true,
    },
  ];
}

function viewingMarketplaceSuggestions(_state: UserState): Suggestion[] {
  return [
    {
      id: 'marketplace-browse',
      message: '发现感兴趣的策略？可以直接导入到工作台试用',
      actionLabel: '回到工作台',
      actionHref: '/dashboard',
      icon: 'ArrowLeft',
      priority: 50,
      dismissable: true,
    },
  ];
}

function idleDashboardSuggestions(_state: UserState): Suggestion[] {
  return [
    {
      id: 'idle-marketplace',
      message: '今日热门策略更新了',
      actionLabel: '查看市场',
      actionHref: '/dashboard/marketplace',
      icon: 'TrendingUp',
      priority: 40,
      dismissable: true,
    },
  ];
}

function returningUserSuggestions(state: UserState): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (state.hasDraft && state.lastStrategyName) {
    suggestions.push({
      id: 'returning-continue',
      message: `继续上次的工作？你的 ${state.lastStrategyName} 还有未完成的回测`,
      actionLabel: '继续',
      actionHref: '/dashboard',
      icon: 'RotateCcw',
      priority: 75,
      dismissable: true,
    });
  } else {
    suggestions.push({
      id: 'returning-explore',
      message: '欢迎回来！查看今日市场动态和热门策略',
      actionLabel: '查看市场',
      actionHref: '/dashboard/marketplace',
      icon: 'Sparkles',
      priority: 60,
      dismissable: true,
    });
  }

  return suggestions;
}

function afterPortfolioSuggestions(_state: UserState): Suggestion[] {
  return [
    {
      id: 'after-portfolio',
      message: '组合回测完成！想要设置模拟交易跟踪吗？',
      actionLabel: '去模拟交易',
      actionHref: '/dashboard/trading?tab=paper',
      icon: 'LineChart',
      priority: 80,
      dismissable: true,
    },
  ];
}

function watchlistChangedSuggestions(state: UserState): Suggestion[] {
  const count = state.watchlistCount ?? 0;
  return [
    {
      id: 'watchlist-scan',
      message: `已添加 ${count} 只股票到自选，要自动扫描信号吗？`,
      actionLabel: '扫描信号',
      actionHref: '/dashboard/analysis',
      icon: 'Search',
      priority: 70,
      dismissable: true,
    },
  ];
}

function firstTimeSuggestions(_state: UserState): Suggestion[] {
  return [
    {
      id: 'first-time',
      message: '欢迎使用 Lucrum！从一个经典策略开始体验吧',
      actionLabel: '选择模板',
      actionHref: '/dashboard',
      icon: 'Sparkles',
      priority: 95,
      dismissable: true,
    },
  ];
}

// =============================================================================
// CONTEXT → SUGGESTIONS MAPPING
// =============================================================================

const CONTEXT_HANDLERS: Record<SuggestionContext, (state: UserState) => Suggestion[]> = {
  'after-backtest': afterBacktestSuggestions,
  'after-generation': afterGenerationSuggestions,
  'viewing-marketplace': viewingMarketplaceSuggestions,
  'idle-dashboard': idleDashboardSuggestions,
  'returning-user': returningUserSuggestions,
  'after-portfolio': afterPortfolioSuggestions,
  'watchlist-changed': watchlistChangedSuggestions,
  'first-time': firstTimeSuggestions,
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get ranked suggestions for the given context and user state.
 * Returns suggestions sorted by priority (highest first).
 */
export function getSuggestions(context: SuggestionContext, userState: UserState): Suggestion[] {
  const handler = CONTEXT_HANDLERS[context];
  const suggestions = handler(userState);

  // Sort by priority descending
  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * Get the single best suggestion for the given context.
 * Returns null if no suggestions are available.
 */
export function getTopSuggestion(context: SuggestionContext, userState: UserState): Suggestion | null {
  const suggestions = getSuggestions(context, userState);
  return suggestions[0] ?? null;
}
