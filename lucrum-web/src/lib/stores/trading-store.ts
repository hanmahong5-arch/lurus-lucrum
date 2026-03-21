/**
 * Trading Store with Zustand + Immer
 *
 * Design Philosophy (Event Sourcing + NautilusTrader):
 * - Immutable state updates via Immer
 * - Event-driven architecture with complete history
 * - Persistent state with localStorage
 * - Risk management integration
 *
 * @module lib/stores/trading-store
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Position side
 */
export type PositionSide = 'long' | 'short';

/**
 * Order side
 */
export type OrderSide = 'buy' | 'sell';

/**
 * Order type
 */
export type OrderType = 'limit' | 'market' | 'stop' | 'stop_limit';

/**
 * Order status
 */
export type OrderStatus = 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';

/**
 * Trade event type
 */
export type TradeEventType =
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'POSITION_UPDATED'
  | 'ORDER_PLACED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'BALANCE_UPDATED'
  | 'PRICE_ALERT'
  | 'RISK_WARNING';

/**
 * Position entity
 */
export interface Position {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly side: PositionSide;
  readonly size: number;
  readonly entryPrice: number;
  readonly currentPrice: number;
  readonly averageCost: number;
  readonly unrealizedPnL: number;
  readonly unrealizedPnLPercent: number;
  readonly realizedPnL: number;
  readonly commission: number;
  readonly marginUsed: number;
  readonly openedAt: Date;
  readonly updatedAt: Date;
  readonly notes?: string;
}

/**
 * Order entity
 */
export interface Order {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly price: number;
  readonly triggerPrice?: number;
  readonly size: number;
  readonly filled: number;
  readonly remaining: number;
  readonly averagePrice: number;
  readonly status: OrderStatus;
  readonly commission: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly filledAt?: Date;
  readonly cancelledAt?: Date;
  readonly notes?: string;
}

/**
 * Trade event for event sourcing
 */
export interface TradeEvent {
  readonly id: string;
  readonly type: TradeEventType;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
  readonly positionId?: string;
  readonly orderId?: string;
  readonly symbol?: string;
}

/**
 * Account summary
 */
export interface AccountSummary {
  readonly balance: number;
  readonly equity: number;
  readonly marginUsed: number;
  readonly marginAvailable: number;
  readonly unrealizedPnL: number;
  readonly realizedPnL: number;
  readonly dailyPnL: number;
  readonly dailyPnLPercent: number;
  readonly totalCommission: number;
  readonly winRate: number;
  readonly profitFactor: number;
}

/**
 * Risk metrics
 */
export interface RiskMetrics {
  readonly maxDrawdown: number;
  readonly currentDrawdown: number;
  readonly positionConcentration: number;
  readonly largestPosition: number;
  readonly leverageRatio: number;
  readonly marginUtilization: number;
  readonly riskScore: number; // 0-10
}

/**
 * Open position parameters
 */
export interface OpenPositionParams {
  readonly symbol: string;
  readonly name: string;
  readonly side: PositionSide;
  readonly size: number;
  readonly entryPrice: number;
  readonly commission?: number;
  readonly notes?: string;
}

/**
 * Place order parameters
 */
export interface PlaceOrderParams {
  readonly symbol: string;
  readonly name: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly price: number;
  readonly size: number;
  readonly triggerPrice?: number;
  readonly notes?: string;
}

// =============================================================================
// TRADING STORE STATE
// =============================================================================

interface TradingState {
  // Account state
  balance: number;
  equity: number;
  marginUsed: number;
  initialBalance: number;
  currency: string;

  // Positions and orders
  positions: Map<string, Position>;
  orders: Map<string, Order>;

  // Event sourcing
  tradeHistory: TradeEvent[];
  maxHistorySize: number;

  // Performance tracking
  dailyStartBalance: number;
  dailyStartDate: string;
  totalCommission: number;

  // Settings
  defaultCommissionRate: number;
  marginRequirement: number;

  // Computed (cached)
  _cachedSummary: AccountSummary | null;
  _cachedRiskMetrics: RiskMetrics | null;
}

interface TradingActions {
  // Position management
  openPosition: (params: OpenPositionParams) => string;
  closePosition: (positionId: string, closePrice: number, commission?: number) => void;
  updatePositionPrice: (positionId: string, price: number) => void;
  updateAllPrices: (prices: Map<string, number>) => void;

  // Order management
  placeOrder: (params: PlaceOrderParams) => string;
  fillOrder: (orderId: string, fillPrice: number, fillSize?: number, commission?: number) => void;
  cancelOrder: (orderId: string) => void;

  // Account management
  updateBalance: (newBalance: number, reason?: string) => void;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
  resetDailyStats: () => void;

  // Computed getters
  getAccountSummary: () => AccountSummary;
  getRiskMetrics: () => RiskMetrics;
  getPosition: (positionId: string) => Position | undefined;
  getOrder: (orderId: string) => Order | undefined;
  getOpenPositions: () => Position[];
  getPendingOrders: () => Order[];
  getTradeHistory: (limit?: number) => TradeEvent[];

  // Utility
  reset: () => void;
  clearHistory: () => void;
}

export type TradingStore = TradingState & TradingActions;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

/**
 * Create trade event
 */
function createTradeEvent(
  type: TradeEventType,
  data: Record<string, unknown>,
  extras?: Partial<TradeEvent>
): TradeEvent {
  return {
    id: generateId(),
    type,
    timestamp: new Date(),
    data,
    ...extras,
  };
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_STATE: TradingState = {
  balance: 100000,
  equity: 100000,
  marginUsed: 0,
  initialBalance: 100000,
  currency: 'CNY',

  positions: new Map(),
  orders: new Map(),

  tradeHistory: [],
  maxHistorySize: 10000,

  dailyStartBalance: 100000,
  dailyStartDate: getTodayString(),
  totalCommission: 0,

  defaultCommissionRate: 0.0003, // 0.03% (typical A-share)
  marginRequirement: 1, // 100% (no leverage by default)

  _cachedSummary: null,
  _cachedRiskMetrics: null,
};

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useTradingStore = create<TradingStore>()(
  persist(
    immer((set, get) => ({
      ...INITIAL_STATE,

      // =========================================================================
      // POSITION MANAGEMENT
      // =========================================================================

      openPosition: (params) => {
        const id = generateId();
        const commission = params.commission ?? (params.entryPrice * params.size * get().defaultCommissionRate);
        const marginUsed = params.entryPrice * params.size * get().marginRequirement;

        const position: Position = {
          id,
          symbol: params.symbol,
          name: params.name,
          side: params.side,
          size: params.size,
          entryPrice: params.entryPrice,
          currentPrice: params.entryPrice,
          averageCost: params.entryPrice,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          realizedPnL: 0,
          commission,
          marginUsed,
          openedAt: new Date(),
          updatedAt: new Date(),
          notes: params.notes,
        };

        set((state) => {
          state.positions.set(id, position);
          state.balance -= commission;
          state.marginUsed += marginUsed;
          state.totalCommission += commission;

          // Add event
          const event = createTradeEvent('POSITION_OPENED', {
            ...params,
            commission,
            marginUsed,
          }, { positionId: id, symbol: params.symbol });

          state.tradeHistory.push(event);

          // Trim history if needed
          if (state.tradeHistory.length > state.maxHistorySize) {
            state.tradeHistory = state.tradeHistory.slice(-state.maxHistorySize);
          }

          // Invalidate cache
          state._cachedSummary = null;
          state._cachedRiskMetrics = null;
        });

        return id;
      },

      closePosition: (positionId, closePrice, commission) => {
        set((state) => {
          const position = state.positions.get(positionId);
          if (!position) return;

          const pnl = position.side === 'long'
            ? (closePrice - position.entryPrice) * position.size
            : (position.entryPrice - closePrice) * position.size;

          const closeCommission = commission ?? (closePrice * position.size * state.defaultCommissionRate);
          const netPnL = pnl - closeCommission;

          // Update balance
          state.balance += position.marginUsed + netPnL;
          state.marginUsed -= position.marginUsed;
          state.totalCommission += closeCommission;

          // Remove position
          state.positions.delete(positionId);

          // Add event
          const event = createTradeEvent('POSITION_CLOSED', {
            position: { ...position },
            closePrice,
            pnl,
            netPnL,
            commission: closeCommission,
          }, { positionId, symbol: position.symbol });

          state.tradeHistory.push(event);

          // Invalidate cache
          state._cachedSummary = null;
          state._cachedRiskMetrics = null;
        });
      },

      updatePositionPrice: (positionId, price) => {
        set((state) => {
          const position = state.positions.get(positionId);
          if (!position) return;

          const unrealizedPnL = position.side === 'long'
            ? (price - position.entryPrice) * position.size
            : (position.entryPrice - price) * position.size;

          const unrealizedPnLPercent = (unrealizedPnL / (position.entryPrice * position.size)) * 100;

          state.positions.set(positionId, {
            ...position,
            currentPrice: price,
            unrealizedPnL,
            unrealizedPnLPercent,
            updatedAt: new Date(),
          });

          // Invalidate cache
          state._cachedSummary = null;
          state._cachedRiskMetrics = null;
        });
      },

      updateAllPrices: (prices) => {
        set((state) => {
          let totalUnrealizedPnL = 0;

          state.positions.forEach((position, id) => {
            const price = prices.get(position.symbol);
            if (price === undefined) return;

            const unrealizedPnL = position.side === 'long'
              ? (price - position.entryPrice) * position.size
              : (position.entryPrice - price) * position.size;

            const unrealizedPnLPercent = (unrealizedPnL / (position.entryPrice * position.size)) * 100;

            state.positions.set(id, {
              ...position,
              currentPrice: price,
              unrealizedPnL,
              unrealizedPnLPercent,
              updatedAt: new Date(),
            });

            totalUnrealizedPnL += unrealizedPnL;
          });

          // Update equity
          state.equity = state.balance + totalUnrealizedPnL;

          // Invalidate cache
          state._cachedSummary = null;
          state._cachedRiskMetrics = null;
        });
      },

      // =========================================================================
      // ORDER MANAGEMENT
      // =========================================================================

      placeOrder: (params) => {
        const id = generateId();

        const order: Order = {
          id,
          symbol: params.symbol,
          name: params.name,
          side: params.side,
          type: params.type,
          price: params.price,
          triggerPrice: params.triggerPrice,
          size: params.size,
          filled: 0,
          remaining: params.size,
          averagePrice: 0,
          status: 'pending',
          commission: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          notes: params.notes,
        };

        set((state) => {
          state.orders.set(id, order);

          const event = createTradeEvent('ORDER_PLACED', {
            ...params,
          }, { orderId: id, symbol: params.symbol });

          state.tradeHistory.push(event);
        });

        return id;
      },

      fillOrder: (orderId, fillPrice, fillSize, commission) => {
        set((state) => {
          const order = state.orders.get(orderId);
          if (!order || order.status === 'filled' || order.status === 'cancelled') return;

          const actualFillSize = fillSize ?? order.remaining;
          const filledAmount = Math.min(actualFillSize, order.remaining);
          const newFilled = order.filled + filledAmount;
          const newRemaining = order.size - newFilled;

          // Calculate weighted average price
          const newAveragePrice = order.filled > 0
            ? (order.averagePrice * order.filled + fillPrice * filledAmount) / newFilled
            : fillPrice;

          const fillCommission = commission ?? (fillPrice * filledAmount * state.defaultCommissionRate);
          const newStatus: OrderStatus = newRemaining === 0 ? 'filled' : 'partial';

          state.orders.set(orderId, {
            ...order,
            filled: newFilled,
            remaining: newRemaining,
            averagePrice: newAveragePrice,
            commission: order.commission + fillCommission,
            status: newStatus,
            updatedAt: new Date(),
            filledAt: newStatus === 'filled' ? new Date() : undefined,
          });

          state.balance -= fillCommission;
          state.totalCommission += fillCommission;

          const event = createTradeEvent('ORDER_FILLED', {
            orderId,
            fillPrice,
            fillSize: filledAmount,
            commission: fillCommission,
            status: newStatus,
          }, { orderId, symbol: order.symbol });

          state.tradeHistory.push(event);

          state._cachedSummary = null;
        });
      },

      cancelOrder: (orderId) => {
        set((state) => {
          const order = state.orders.get(orderId);
          if (!order || order.status === 'filled' || order.status === 'cancelled') return;

          state.orders.set(orderId, {
            ...order,
            status: 'cancelled',
            updatedAt: new Date(),
            cancelledAt: new Date(),
          });

          const event = createTradeEvent('ORDER_CANCELLED', {
            orderId,
            reason: 'user_cancelled',
          }, { orderId, symbol: order.symbol });

          state.tradeHistory.push(event);
        });
      },

      // =========================================================================
      // ACCOUNT MANAGEMENT
      // =========================================================================

      updateBalance: (newBalance, reason) => {
        set((state) => {
          const oldBalance = state.balance;
          state.balance = newBalance;

          const event = createTradeEvent('BALANCE_UPDATED', {
            oldBalance,
            newBalance,
            reason: reason ?? 'manual_adjustment',
          });

          state.tradeHistory.push(event);
          state._cachedSummary = null;
        });
      },

      deposit: (amount) => {
        set((state) => {
          state.balance += amount;
          state.initialBalance += amount;

          const event = createTradeEvent('BALANCE_UPDATED', {
            type: 'deposit',
            amount,
            newBalance: state.balance,
          });

          state.tradeHistory.push(event);
          state._cachedSummary = null;
        });
      },

      withdraw: (amount) => {
        const state = get();
        const availableBalance = state.balance - state.marginUsed;

        if (amount > availableBalance) {
          return false;
        }

        set((s) => {
          s.balance -= amount;
          s.initialBalance -= amount;

          const event = createTradeEvent('BALANCE_UPDATED', {
            type: 'withdrawal',
            amount,
            newBalance: s.balance,
          });

          s.tradeHistory.push(event);
          s._cachedSummary = null;
        });

        return true;
      },

      resetDailyStats: () => {
        set((state) => {
          state.dailyStartBalance = state.equity;
          state.dailyStartDate = getTodayString();
        });
      },

      // =========================================================================
      // COMPUTED GETTERS
      // =========================================================================

      getAccountSummary: () => {
        const state = get();

        // Return cached if available
        if (state._cachedSummary) {
          return state._cachedSummary;
        }

        // Calculate totals
        let totalUnrealizedPnL = 0;
        let totalRealizedPnL = 0;

        state.positions.forEach((position) => {
          totalUnrealizedPnL += position.unrealizedPnL;
          totalRealizedPnL += position.realizedPnL;
        });

        const equity = state.balance + totalUnrealizedPnL;
        const marginAvailable = equity - state.marginUsed;
        const dailyPnL = equity - state.dailyStartBalance;
        const dailyPnLPercent = state.dailyStartBalance > 0
          ? (dailyPnL / state.dailyStartBalance) * 100
          : 0;

        // Calculate win rate from history
        const closedPositions = state.tradeHistory.filter(
          (e) => e.type === 'POSITION_CLOSED'
        );
        const wins = closedPositions.filter(
          (e) => (e.data.netPnL as number) > 0
        ).length;
        const winRate = closedPositions.length > 0
          ? (wins / closedPositions.length) * 100
          : 0;

        // Calculate profit factor
        const totalProfit = closedPositions
          .filter((e) => (e.data.netPnL as number) > 0)
          .reduce((sum, e) => sum + (e.data.netPnL as number), 0);
        const totalLoss = Math.abs(
          closedPositions
            .filter((e) => (e.data.netPnL as number) < 0)
            .reduce((sum, e) => sum + (e.data.netPnL as number), 0)
        );
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

        const summary: AccountSummary = {
          balance: state.balance,
          equity,
          marginUsed: state.marginUsed,
          marginAvailable,
          unrealizedPnL: totalUnrealizedPnL,
          realizedPnL: totalRealizedPnL,
          dailyPnL,
          dailyPnLPercent,
          totalCommission: state.totalCommission,
          winRate,
          profitFactor,
        };

        // Cache the result
        set((s) => {
          s._cachedSummary = summary;
        });

        return summary;
      },

      getRiskMetrics: () => {
        const state = get();

        if (state._cachedRiskMetrics) {
          return state._cachedRiskMetrics;
        }

        const summary = get().getAccountSummary();

        // Calculate position concentration
        let largestPositionValue = 0;
        let totalPositionValue = 0;

        state.positions.forEach((position) => {
          const value = position.currentPrice * position.size;
          totalPositionValue += value;
          if (value > largestPositionValue) {
            largestPositionValue = value;
          }
        });

        const positionConcentration = totalPositionValue > 0
          ? (largestPositionValue / totalPositionValue) * 100
          : 0;
        const largestPositionPercent = summary.equity > 0
          ? (largestPositionValue / summary.equity) * 100
          : 0;

        // Calculate leverage and margin utilization
        const leverageRatio = summary.equity > 0
          ? totalPositionValue / summary.equity
          : 0;
        const marginUtilization = summary.equity > 0
          ? (state.marginUsed / summary.equity) * 100
          : 0;

        // Calculate drawdown from peak
        const peakEquity = Math.max(state.initialBalance, summary.equity);
        const currentDrawdown = peakEquity > 0
          ? ((peakEquity - summary.equity) / peakEquity) * 100
          : 0;

        // Calculate risk score (0-10, higher is riskier)
        let riskScore = 0;
        if (marginUtilization > 80) riskScore += 3;
        else if (marginUtilization > 50) riskScore += 2;
        else if (marginUtilization > 30) riskScore += 1;

        if (positionConcentration > 50) riskScore += 3;
        else if (positionConcentration > 30) riskScore += 2;
        else if (positionConcentration > 20) riskScore += 1;

        if (leverageRatio > 3) riskScore += 2;
        else if (leverageRatio > 2) riskScore += 1;

        if (currentDrawdown > 10) riskScore += 2;
        else if (currentDrawdown > 5) riskScore += 1;

        const metrics: RiskMetrics = {
          maxDrawdown: currentDrawdown, // Simplified, should track historical max
          currentDrawdown,
          positionConcentration,
          largestPosition: largestPositionPercent,
          leverageRatio,
          marginUtilization,
          riskScore: Math.min(10, riskScore),
        };

        set((s) => {
          s._cachedRiskMetrics = metrics;
        });

        return metrics;
      },

      getPosition: (positionId) => {
        return get().positions.get(positionId);
      },

      getOrder: (orderId) => {
        return get().orders.get(orderId);
      },

      getOpenPositions: () => {
        return Array.from(get().positions.values());
      },

      getPendingOrders: () => {
        return Array.from(get().orders.values()).filter(
          (order) => order.status === 'pending' || order.status === 'partial'
        );
      },

      getTradeHistory: (limit) => {
        const history = get().tradeHistory;
        if (limit) {
          return history.slice(-limit);
        }
        return [...history];
      },

      // =========================================================================
      // UTILITY
      // =========================================================================

      reset: () => {
        set(() => ({ ...INITIAL_STATE }));
      },

      clearHistory: () => {
        set((state) => {
          state.tradeHistory = [];
        });
      },
    })),
    {
      name: 'lucrum-trading-store',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        balance: state.balance,
        equity: state.equity,
        marginUsed: state.marginUsed,
        initialBalance: state.initialBalance,
        currency: state.currency,
        positions: Array.from(state.positions.entries()),
        orders: Array.from(state.orders.entries()),
        tradeHistory: state.tradeHistory.slice(-1000), // Keep last 1000 events
        dailyStartBalance: state.dailyStartBalance,
        dailyStartDate: state.dailyStartDate,
        totalCommission: state.totalCommission,
        defaultCommissionRate: state.defaultCommissionRate,
        marginRequirement: state.marginRequirement,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Restore Maps from arrays
          if (Array.isArray(state.positions)) {
            state.positions = new Map(state.positions as [string, Position][]);
          }
          if (Array.isArray(state.orders)) {
            state.orders = new Map(state.orders as [string, Order][]);
          }

          // Reset daily stats if new day
          const today = getTodayString();
          if (state.dailyStartDate !== today) {
            state.dailyStartBalance = state.equity;
            state.dailyStartDate = today;
          }
        }
      },
    }
  )
);

// =============================================================================
// SELECTORS (for optimized re-renders)
// =============================================================================

/**
 * Select account balance
 */
export const selectBalance = (state: TradingStore) => state.balance;

/**
 * Select all positions
 */
export const selectPositions = (state: TradingStore) => state.positions;

/**
 * Select all pending orders
 */
export const selectPendingOrders = (state: TradingStore) =>
  Array.from(state.orders.values()).filter(
    (order) => order.status === 'pending' || order.status === 'partial'
  );

/**
 * Select position by symbol
 */
export const selectPositionBySymbol = (symbol: string) => (state: TradingStore) =>
  Array.from(state.positions.values()).find((p) => p.symbol === symbol);
