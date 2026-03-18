/**
 * Broker Adapter Interfaces
 * 券商适配器接口定义
 *
 * Defines the standard interface for broker integrations:
 * - Connection management
 * - Account operations
 * - Order management
 * - Market data (optional)
 *
 * @module lib/broker/interfaces
 */

// =============================================================================
// Enums
// =============================================================================

/**
 * Order side - buy or sell
 * 交易方向
 */
export type OrderSide = 'buy' | 'sell';

/**
 * Order type
 * 订单类型
 */
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';

/**
 * Order status
 * 订单状态
 */
export type OrderStatus =
  | 'pending'     // Waiting to be sent
  | 'submitted'   // Sent to broker
  | 'partial'     // Partially filled
  | 'filled'      // Completely filled
  | 'cancelled'   // Cancelled
  | 'rejected'    // Rejected by broker
  | 'expired';    // Expired

/**
 * Position side
 * 持仓方向
 */
export type PositionSide = 'long' | 'short' | 'flat';

/**
 * Market type
 * 市场类型
 */
export type MarketType = 'a_share' | 'hk_stock' | 'us_stock' | 'crypto' | 'futures';

/**
 * Broker type
 * 券商类型
 */
export type BrokerType = 'mock' | 'eastmoney' | 'futu' | 'tiger' | 'ib';

// =============================================================================
// Credential Types
// =============================================================================

/**
 * Base credentials interface
 * 基础凭证接口
 */
export interface BrokerCredentials {
  /** Broker type / 券商类型 */
  brokerType: BrokerType;
  /** API key or account ID / API密钥或账户ID */
  apiKey?: string;
  /** API secret / API密钥 */
  apiSecret?: string;
  /** Additional auth data / 额外认证数据 */
  authData?: Record<string, string>;
}

/**
 * Mock broker credentials
 * 模拟券商凭证
 */
export interface MockBrokerCredentials extends BrokerCredentials {
  brokerType: 'mock';
  /** Initial balance / 初始资金 */
  initialBalance?: number;
  /** Simulation mode / 模拟模式 */
  simulationMode?: 'instant' | 'delayed' | 'realistic';
}

// =============================================================================
// Account Types
// =============================================================================

/**
 * Account information
 * 账户信息
 */
export interface AccountInfo {
  /** Account ID / 账户ID */
  accountId: string;
  /** Account name / 账户名称 */
  accountName: string;
  /** Account type / 账户类型 */
  accountType: 'cash' | 'margin' | 'paper';
  /** Currency / 币种 */
  currency: string;
  /** Creation time / 创建时间 */
  createdAt: Date;
  /** Is paper trading account / 是否模拟账户 */
  isPaperTrading: boolean;
}

/**
 * Balance information
 * 资金信息
 */
export interface BalanceInfo {
  /** Total equity / 总资产 */
  totalEquity: number;
  /** Available cash / 可用资金 */
  availableCash: number;
  /** Frozen cash / 冻结资金 */
  frozenCash: number;
  /** Market value of positions / 持仓市值 */
  positionValue: number;
  /** Unrealized P&L / 未实现盈亏 */
  unrealizedPnl: number;
  /** Realized P&L (today) / 今日已实现盈亏 */
  realizedPnl: number;
  /** Buying power / 购买力 */
  buyingPower: number;
  /** Currency / 币种 */
  currency: string;
  /** Last update time / 最后更新时间 */
  updatedAt: Date;
}

// =============================================================================
// Position Types
// =============================================================================

/**
 * Position information
 * 持仓信息
 */
export interface Position {
  /** Symbol / 股票代码 */
  symbol: string;
  /** Stock name / 股票名称 */
  stockName?: string;
  /** Position side / 持仓方向 */
  side: PositionSide;
  /** Quantity / 持仓数量 */
  quantity: number;
  /** Available quantity (can sell) / 可卖数量 */
  availableQty: number;
  /** Average cost / 平均成本 */
  avgCost: number;
  /** Current price / 当前价格 */
  currentPrice: number;
  /** Market value / 市值 */
  marketValue: number;
  /** Unrealized P&L / 未实现盈亏 */
  unrealizedPnl: number;
  /** Unrealized P&L percentage / 未实现盈亏百分比 */
  unrealizedPnlPct: number;
  /** Today's P&L / 今日盈亏 */
  todayPnl?: number;
  /** Last update time / 最后更新时间 */
  updatedAt: Date;
}

// =============================================================================
// Order Types
// =============================================================================

/**
 * Order request
 * 下单请求
 */
export interface OrderRequest {
  /** Symbol / 股票代码 */
  symbol: string;
  /** Order side / 交易方向 */
  side: OrderSide;
  /** Order type / 订单类型 */
  type: OrderType;
  /** Quantity / 数量 */
  quantity: number;
  /** Limit price (for limit orders) / 限价 */
  limitPrice?: number;
  /** Stop price (for stop orders) / 止损价 */
  stopPrice?: number;
  /** Time in force / 有效期 */
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
  /** Client order ID / 客户端订单ID */
  clientOrderId?: string;
  /** Extended hours trading / 盘后交易 */
  extendedHours?: boolean;
}

/**
 * Order information
 * 订单信息
 */
export interface Order {
  /** Order ID / 订单ID */
  orderId: string;
  /** Client order ID / 客户端订单ID */
  clientOrderId?: string;
  /** Symbol / 股票代码 */
  symbol: string;
  /** Stock name / 股票名称 */
  stockName?: string;
  /** Order side / 交易方向 */
  side: OrderSide;
  /** Order type / 订单类型 */
  type: OrderType;
  /** Order status / 订单状态 */
  status: OrderStatus;
  /** Order quantity / 订单数量 */
  quantity: number;
  /** Filled quantity / 已成交数量 */
  filledQty: number;
  /** Remaining quantity / 剩余数量 */
  remainingQty: number;
  /** Limit price / 限价 */
  limitPrice?: number;
  /** Stop price / 止损价 */
  stopPrice?: number;
  /** Average fill price / 平均成交价 */
  avgFillPrice?: number;
  /** Commission / 手续费 */
  commission?: number;
  /** Time in force / 有效期 */
  timeInForce: string;
  /** Created time / 创建时间 */
  createdAt: Date;
  /** Updated time / 更新时间 */
  updatedAt: Date;
  /** Filled time / 成交时间 */
  filledAt?: Date;
  /** Rejection reason / 拒绝原因 */
  rejectReason?: string;
}

/**
 * Order filter for querying
 * 订单查询过滤器
 */
export interface OrderFilter {
  /** Filter by symbol / 按股票过滤 */
  symbol?: string;
  /** Filter by status / 按状态过滤 */
  status?: OrderStatus[];
  /** Filter by side / 按方向过滤 */
  side?: OrderSide;
  /** Start date / 开始日期 */
  startDate?: Date;
  /** End date / 结束日期 */
  endDate?: Date;
  /** Limit / 限制数量 */
  limit?: number;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Connection result
 * 连接结果
 */
export interface ConnectionResult {
  /** Is connected / 是否已连接 */
  connected: boolean;
  /** Account info / 账户信息 */
  account?: AccountInfo;
  /** Error message / 错误信息 */
  error?: string;
  /** Connection time / 连接时间 */
  connectedAt?: Date;
}

/**
 * Order result
 * 下单结果
 */
export interface OrderResult {
  /** Success / 是否成功 */
  success: boolean;
  /** Order info / 订单信息 */
  order?: Order;
  /** Error code / 错误代码 */
  errorCode?: string;
  /** Error message / 错误信息 */
  errorMessage?: string;
}

/**
 * Cancel result
 * 撤单结果
 */
export interface CancelResult {
  /** Success / 是否成功 */
  success: boolean;
  /** Order ID / 订单ID */
  orderId: string;
  /** Error message / 错误信息 */
  errorMessage?: string;
}

// =============================================================================
// Market Data Types
// =============================================================================

/**
 * Quote information
 * 行情信息
 */
export interface Quote {
  /** Symbol / 股票代码 */
  symbol: string;
  /** Stock name / 股票名称 */
  stockName?: string;
  /** Last price / 最新价 */
  lastPrice: number;
  /** Open price / 开盘价 */
  open: number;
  /** High price / 最高价 */
  high: number;
  /** Low price / 最低价 */
  low: number;
  /** Previous close / 昨收 */
  prevClose: number;
  /** Change / 涨跌额 */
  change: number;
  /** Change percentage / 涨跌幅 */
  changePct: number;
  /** Volume / 成交量 */
  volume: number;
  /** Amount / 成交额 */
  amount: number;
  /** Bid price / 买一价 */
  bidPrice?: number;
  /** Bid size / 买一量 */
  bidSize?: number;
  /** Ask price / 卖一价 */
  askPrice?: number;
  /** Ask size / 卖一量 */
  askSize?: number;
  /** Update time / 更新时间 */
  updatedAt: Date;
}

/**
 * Quote callback function
 * 行情回调函数
 */
export type QuoteCallback = (quote: Quote) => void;

/**
 * Subscription handle
 * 订阅句柄
 */
export interface Subscription {
  /** Unsubscribe / 取消订阅 */
  unsubscribe: () => void;
  /** Subscribed symbols / 已订阅的股票 */
  symbols: string[];
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Broker event types
 * 券商事件类型
 */
export type BrokerEventType =
  | 'connected'
  | 'disconnected'
  | 'order_update'
  | 'position_update'
  | 'balance_update'
  | 'error';

/**
 * Broker event data
 * 券商事件数据
 */
export interface BrokerEvent<T = unknown> {
  type: BrokerEventType;
  data: T;
  timestamp: Date;
}

/**
 * Event listener callback
 * 事件监听回调
 */
export type BrokerEventListener<T = unknown> = (event: BrokerEvent<T>) => void;

// =============================================================================
// Main Interface
// =============================================================================

/**
 * Broker Adapter Interface
 * 券商适配器接口
 *
 * All broker implementations must implement this interface.
 * 所有券商实现必须实现此接口。
 */
export interface IBrokerAdapter {
  // ---------------------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------------------

  /** Broker type / 券商类型 */
  readonly brokerType: BrokerType;
  /** Broker name / 券商名称 */
  readonly brokerName: string;
  /** Supported markets / 支持的市场 */
  readonly supportedMarkets: MarketType[];

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Connect to broker
   * 连接到券商
   */
  connect(credentials: BrokerCredentials): Promise<ConnectionResult>;

  /**
   * Disconnect from broker
   * 断开连接
   */
  disconnect(): Promise<void>;

  /**
   * Check connection status
   * 检查连接状态
   */
  isConnected(): boolean;

  // ---------------------------------------------------------------------------
  // Account Operations
  // ---------------------------------------------------------------------------

  /**
   * Get account information
   * 获取账户信息
   */
  getAccountInfo(): Promise<AccountInfo>;

  /**
   * Get balance information
   * 获取资金信息
   */
  getBalance(): Promise<BalanceInfo>;

  /**
   * Get positions
   * 获取持仓
   */
  getPositions(): Promise<Position[]>;

  // ---------------------------------------------------------------------------
  // Order Management
  // ---------------------------------------------------------------------------

  /**
   * Place an order
   * 下单
   */
  placeOrder(order: OrderRequest): Promise<OrderResult>;

  /**
   * Cancel an order
   * 撤单
   */
  cancelOrder(orderId: string): Promise<CancelResult>;

  /**
   * Get orders
   * 获取订单列表
   */
  getOrders(filter?: OrderFilter): Promise<Order[]>;

  /**
   * Get single order by ID
   * 获取单个订单
   */
  getOrder(orderId: string): Promise<Order | null>;

  // ---------------------------------------------------------------------------
  // Market Data (Optional)
  // ---------------------------------------------------------------------------

  /**
   * Get quote for a symbol
   * 获取行情
   */
  getQuote?(symbol: string): Promise<Quote>;

  /**
   * Subscribe to real-time quotes
   * 订阅实时行情
   */
  subscribe?(symbols: string[], callback: QuoteCallback): Subscription;

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /**
   * Add event listener
   * 添加事件监听
   */
  on<T = unknown>(event: BrokerEventType, listener: BrokerEventListener<T>): void;

  /**
   * Remove event listener
   * 移除事件监听
   */
  off<T = unknown>(event: BrokerEventType, listener: BrokerEventListener<T>): void;
}
