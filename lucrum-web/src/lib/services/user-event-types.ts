/**
 * User event taxonomy — client-safe constants.
 *
 * Lives apart from `user-event-service.ts` so that client components can
 * reference the type names without dragging the server-only db/pg imports
 * into the browser bundle.
 *
 * @module lib/services/user-event-types
 */

export const USER_EVENT_TYPES = {
  strategyCreated: 'strategy.created',
  strategyRenamed: 'strategy.renamed',
  strategyCodeChanged: 'strategy.code_changed',
  strategyParamChanged: 'strategy.param_changed',
  backtestStarted: 'backtest.started',
  backtestCompleted: 'backtest.completed',
  backtestFailed: 'backtest.failed',
  marketplaceForked: 'marketplace.forked',
  marketplacePublished: 'marketplace.published',
  marketplaceSubscribed: 'marketplace.subscribed',
  marketplaceRated: 'marketplace.rated',
  templateLoaded: 'template.loaded',
} as const;

export type UserEventType = (typeof USER_EVENT_TYPES)[keyof typeof USER_EVENT_TYPES];
