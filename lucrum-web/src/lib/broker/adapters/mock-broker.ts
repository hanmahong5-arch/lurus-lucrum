/**
 * Mock Broker Adapter
 * 模拟券商适配器
 *
 * Simulates a real broker for paper trading and strategy testing.
 * 模拟真实券商用于模拟交易和策略测试。
 *
 * Features:
 * - Instant order execution (market orders)
 * - China A-share market rules (T+1, lot size 100)
 * - Commission and slippage simulation
 * - Position and balance tracking
 *
 * @module lib/broker/adapters/mock-broker
 */

import type {
  IBrokerAdapter,
  BrokerType,
  MarketType,
  BrokerCredentials,
  MockBrokerCredentials,
  ConnectionResult,
  AccountInfo,
  BalanceInfo,
  Position,
  OrderRequest,
  OrderResult,
  CancelResult,
  Order,
  OrderFilter,
  OrderStatus,
  Quote,
  QuoteCallback,
  Subscription,
  BrokerEventType,
  BrokerEventListener,
  BrokerEvent,
} from '../interfaces';

// =============================================================================
// Constants
// =============================================================================

/** Default initial balance / 默认初始资金 */
const DEFAULT_INITIAL_BALANCE = 500000;

/** China A-share lot size / A股每手股数 */
const LOT_SIZE = 100;

/** Default commission rate / 默认手续费率 */
const DEFAULT_COMMISSION_RATE = 0.0003;

/** Minimum commission / 最低手续费 */
const MIN_COMMISSION = 5;

/** Stamp duty rate (sell only) / 印花税率（仅卖出） */
const STAMP_DUTY_RATE = 0.001;

/** Transfer fee rate / 过户费率 */
const TRANSFER_FEE_RATE = 0.00001;

// =============================================================================
// Mock Broker Adapter Implementation
// =============================================================================

export class MockBrokerAdapter implements IBrokerAdapter {
  // ---------------------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------------------

  readonly brokerType: BrokerType = 'mock';
  readonly brokerName: string = '模拟交易';
  readonly supportedMarkets: MarketType[] = ['a_share'];

  private connected: boolean = false;
  private connectedAt?: Date;
  private accountId: string;
  private initialBalance: number;
  private cash: number;
  private frozenCash: number = 0;
  private positions: Map<string, Position> = new Map();
  private orders: Map<string, Order> = new Map();
  private orderIdCounter: number = 1;
  private realizedPnl: number = 0;
  private eventListeners: Map<BrokerEventType, Set<BrokerEventListener>> = new Map();

  // Simulated market prices (in production, would fetch from market data)
  private mockPrices: Map<string, number> = new Map();

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(credentials?: MockBrokerCredentials) {
    this.accountId = `MOCK_${Date.now()}`;
    this.initialBalance = credentials?.initialBalance ?? DEFAULT_INITIAL_BALANCE;
    this.cash = this.initialBalance;

    // Initialize event listener maps
    const eventTypes: BrokerEventType[] = [
      'connected',
      'disconnected',
      'order_update',
      'position_update',
      'balance_update',
      'error',
    ];
    eventTypes.forEach((type) => this.eventListeners.set(type, new Set()));
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  async connect(_credentials: BrokerCredentials): Promise<ConnectionResult> {
    // Simulate connection delay
    await this.delay(100);

    this.connected = true;
    this.connectedAt = new Date();

    const account = await this.getAccountInfo();

    this.emit('connected', { account });

    return {
      connected: true,
      account,
      connectedAt: this.connectedAt,
    };
  }

  async disconnect(): Promise<void> {
    await this.delay(50);
    this.connected = false;
    this.emit('disconnected', {});
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ---------------------------------------------------------------------------
  // Account Operations
  // ---------------------------------------------------------------------------

  async getAccountInfo(): Promise<AccountInfo> {
    this.ensureConnected();

    return {
      accountId: this.accountId,
      accountName: '模拟账户',
      accountType: 'paper',
      currency: 'CNY',
      createdAt: this.connectedAt || new Date(),
      isPaperTrading: true,
    };
  }

  async getBalance(): Promise<BalanceInfo> {
    this.ensureConnected();

    const positionValue = this.calculatePositionValue();
    const unrealizedPnl = this.calculateUnrealizedPnl();
    const totalEquity = this.cash + positionValue;

    return {
      totalEquity,
      availableCash: this.cash - this.frozenCash,
      frozenCash: this.frozenCash,
      positionValue,
      unrealizedPnl,
      realizedPnl: this.realizedPnl,
      buyingPower: this.cash - this.frozenCash,
      currency: 'CNY',
      updatedAt: new Date(),
    };
  }

  async getPositions(): Promise<Position[]> {
    this.ensureConnected();

    // Update current prices and P&L
    const positionValues = Array.from(this.positions.values());
    for (const position of positionValues) {
      const currentPrice = this.getMockPrice(position.symbol);
      position.currentPrice = currentPrice;
      position.marketValue = position.quantity * currentPrice;
      position.unrealizedPnl = (currentPrice - position.avgCost) * position.quantity;
      position.unrealizedPnlPct = (currentPrice / position.avgCost - 1) * 100;
      position.updatedAt = new Date();
    }

    return Array.from(this.positions.values());
  }

  // ---------------------------------------------------------------------------
  // Order Management
  // ---------------------------------------------------------------------------

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    this.ensureConnected();

    // Validate order
    const validation = this.validateOrder(request);
    if (!validation.valid) {
      return {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: validation.error,
      };
    }

    // Generate order ID
    const orderId = `ORD_${Date.now()}_${this.orderIdCounter++}`;

    // Create order
    const order: Order = {
      orderId,
      clientOrderId: request.clientOrderId,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      status: 'pending',
      quantity: request.quantity,
      filledQty: 0,
      remainingQty: request.quantity,
      limitPrice: request.limitPrice,
      stopPrice: request.stopPrice,
      timeInForce: request.timeInForce || 'day',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(orderId, order);

    // Execute market orders immediately
    if (request.type === 'market') {
      await this.executeOrder(order);
    } else {
      order.status = 'submitted';
      order.updatedAt = new Date();
    }

    this.emit('order_update', order);

    return {
      success: true,
      order,
    };
  }

  async cancelOrder(orderId: string): Promise<CancelResult> {
    this.ensureConnected();

    const order = this.orders.get(orderId);

    if (!order) {
      return {
        success: false,
        orderId,
        errorMessage: 'Order not found / 订单未找到',
      };
    }

    if (order.status === 'filled' || order.status === 'cancelled') {
      return {
        success: false,
        orderId,
        errorMessage: `Cannot cancel order in ${order.status} status / 无法取消${order.status}状态的订单`,
      };
    }

    // Cancel order
    order.status = 'cancelled';
    order.updatedAt = new Date();

    // Unfreeze cash for buy orders
    if (order.side === 'buy' && order.limitPrice) {
      const frozenAmount = order.remainingQty * order.limitPrice;
      this.frozenCash = Math.max(0, this.frozenCash - frozenAmount);
    }

    this.emit('order_update', order);

    return {
      success: true,
      orderId,
    };
  }

  async getOrders(filter?: OrderFilter): Promise<Order[]> {
    this.ensureConnected();

    let orders = Array.from(this.orders.values());

    if (filter) {
      if (filter.symbol) {
        orders = orders.filter((o) => o.symbol === filter.symbol);
      }
      if (filter.status && filter.status.length > 0) {
        orders = orders.filter((o) => filter.status!.includes(o.status));
      }
      if (filter.side) {
        orders = orders.filter((o) => o.side === filter.side);
      }
      if (filter.startDate) {
        orders = orders.filter((o) => o.createdAt >= filter.startDate!);
      }
      if (filter.endDate) {
        orders = orders.filter((o) => o.createdAt <= filter.endDate!);
      }
      if (filter.limit) {
        orders = orders.slice(0, filter.limit);
      }
    }

    return orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getOrder(orderId: string): Promise<Order | null> {
    this.ensureConnected();
    return this.orders.get(orderId) || null;
  }

  // ---------------------------------------------------------------------------
  // Market Data (Mock)
  // ---------------------------------------------------------------------------

  async getQuote(symbol: string): Promise<Quote> {
    const price = this.getMockPrice(symbol);
    const prevClose = price * (1 - (Math.random() * 0.02 - 0.01));
    const change = price - prevClose;
    const changePct = (change / prevClose) * 100;

    return {
      symbol,
      lastPrice: price,
      open: prevClose * (1 + (Math.random() * 0.02 - 0.01)),
      high: price * (1 + Math.random() * 0.03),
      low: price * (1 - Math.random() * 0.03),
      prevClose,
      change,
      changePct,
      volume: Math.floor(Math.random() * 10000000),
      amount: Math.floor(Math.random() * 500000000),
      updatedAt: new Date(),
    };
  }

  subscribe(symbols: string[], callback: QuoteCallback): Subscription {
    // Mock subscription - in production would set up WebSocket
    const intervalId = setInterval(() => {
      symbols.forEach(async (symbol) => {
        const quote = await this.getQuote(symbol);
        callback(quote);
      });
    }, 3000);

    return {
      unsubscribe: () => clearInterval(intervalId),
      symbols,
    };
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  on<T = unknown>(event: BrokerEventType, listener: BrokerEventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener as BrokerEventListener);
    }
  }

  off<T = unknown>(event: BrokerEventType, listener: BrokerEventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as BrokerEventListener);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private emit<T>(type: BrokerEventType, data: T): void {
    const event: BrokerEvent<T> = {
      type,
      data,
      timestamp: new Date(),
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[MockBroker] Event listener error:`, error);
        }
      });
    }
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Broker not connected / 券商未连接');
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getMockPrice(symbol: string): number {
    if (!this.mockPrices.has(symbol)) {
      // Generate random initial price between 10 and 200
      const basePrice = 10 + Math.random() * 190;
      this.mockPrices.set(symbol, basePrice);
    }

    // Simulate small price movement
    const currentPrice = this.mockPrices.get(symbol)!;
    const movement = currentPrice * (Math.random() * 0.002 - 0.001);
    const newPrice = Math.max(0.01, currentPrice + movement);
    this.mockPrices.set(symbol, newPrice);

    return Number(newPrice.toFixed(2));
  }

  private validateOrder(request: OrderRequest): { valid: boolean; error?: string } {
    // Check quantity is multiple of lot size
    if (request.quantity % LOT_SIZE !== 0) {
      return {
        valid: false,
        error: `Quantity must be multiple of ${LOT_SIZE} / 数量必须是${LOT_SIZE}的倍数`,
      };
    }

    // Check minimum quantity
    if (request.quantity < LOT_SIZE) {
      return {
        valid: false,
        error: `Minimum quantity is ${LOT_SIZE} / 最小数量为${LOT_SIZE}`,
      };
    }

    // Check limit price for limit orders
    if (request.type === 'limit' && !request.limitPrice) {
      return {
        valid: false,
        error: 'Limit price required for limit orders / 限价单需要指定限价',
      };
    }

    // Check stop price for stop orders
    if ((request.type === 'stop' || request.type === 'stop_limit') && !request.stopPrice) {
      return {
        valid: false,
        error: 'Stop price required for stop orders / 止损单需要指定止损价',
      };
    }

    // Check buying power for buy orders
    if (request.side === 'buy') {
      const estimatedCost = request.quantity * (request.limitPrice || this.getMockPrice(request.symbol));
      const availableCash = this.cash - this.frozenCash;
      if (estimatedCost > availableCash) {
        return {
          valid: false,
          error: `Insufficient funds: need ¥${estimatedCost.toFixed(2)}, available ¥${availableCash.toFixed(2)} / 资金不足`,
        };
      }
    }

    // Check position for sell orders
    if (request.side === 'sell') {
      const position = this.positions.get(request.symbol);
      if (!position || position.availableQty < request.quantity) {
        const availableQty = position?.availableQty || 0;
        return {
          valid: false,
          error: `Insufficient shares: need ${request.quantity}, available ${availableQty} / 可卖股数不足`,
        };
      }
    }

    return { valid: true };
  }

  private async executeOrder(order: Order): Promise<void> {
    const price = this.getMockPrice(order.symbol);
    const amount = order.quantity * price;

    // Calculate commission
    let commission = amount * DEFAULT_COMMISSION_RATE;
    commission = Math.max(commission, MIN_COMMISSION);

    // Calculate stamp duty (sell only)
    const stampDuty = order.side === 'sell' ? amount * STAMP_DUTY_RATE : 0;

    // Calculate transfer fee
    const transferFee = amount * TRANSFER_FEE_RATE;

    const totalFees = commission + stampDuty + transferFee;

    if (order.side === 'buy') {
      // Deduct cash
      this.cash -= amount + totalFees;

      // Add or update position
      const existingPosition = this.positions.get(order.symbol);
      if (existingPosition) {
        // Calculate new average cost
        const totalValue = existingPosition.avgCost * existingPosition.quantity + amount;
        const totalQty = existingPosition.quantity + order.quantity;
        existingPosition.avgCost = totalValue / totalQty;
        existingPosition.quantity = totalQty;
        existingPosition.availableQty = totalQty; // T+1 rule would set this to old value
        existingPosition.marketValue = totalQty * price;
        existingPosition.currentPrice = price;
        existingPosition.updatedAt = new Date();
      } else {
        this.positions.set(order.symbol, {
          symbol: order.symbol,
          side: 'long',
          quantity: order.quantity,
          availableQty: order.quantity, // T+1 would be 0 initially
          avgCost: price,
          currentPrice: price,
          marketValue: amount,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          updatedAt: new Date(),
        });
      }

      this.emit('position_update', this.positions.get(order.symbol));
    } else {
      // Sell order
      const position = this.positions.get(order.symbol)!;

      // Calculate realized P&L
      const pnl = (price - position.avgCost) * order.quantity - totalFees;
      this.realizedPnl += pnl;

      // Add cash
      this.cash += amount - totalFees;

      // Update position
      position.quantity -= order.quantity;
      position.availableQty -= order.quantity;
      position.marketValue = position.quantity * price;
      position.updatedAt = new Date();

      if (position.quantity <= 0) {
        this.positions.delete(order.symbol);
      }

      this.emit('position_update', position);
    }

    // Update order
    order.status = 'filled';
    order.filledQty = order.quantity;
    order.remainingQty = 0;
    order.avgFillPrice = price;
    order.commission = totalFees;
    order.filledAt = new Date();
    order.updatedAt = new Date();

    this.emit('balance_update', await this.getBalance());
  }

  private calculatePositionValue(): number {
    let total = 0;
    const positionValues = Array.from(this.positions.values());
    for (const position of positionValues) {
      total += position.quantity * this.getMockPrice(position.symbol);
    }
    return total;
  }

  private calculateUnrealizedPnl(): number {
    let total = 0;
    const positionValues = Array.from(this.positions.values());
    for (const position of positionValues) {
      const currentPrice = this.getMockPrice(position.symbol);
      total += (currentPrice - position.avgCost) * position.quantity;
    }
    return total;
  }
}
