/**
 * Broker Module Index
 * 券商模块索引
 *
 * Central export point for all broker-related functionality.
 * 所有券商相关功能的中央导出点。
 *
 * @module lib/broker
 */

// =============================================================================
// Interfaces & Types
// =============================================================================

export type {
  // Enums
  OrderSide,
  OrderType,
  OrderStatus,
  PositionSide,
  MarketType,
  BrokerType,
  // Credentials
  BrokerCredentials,
  MockBrokerCredentials,
  // Account
  AccountInfo,
  BalanceInfo,
  // Position
  Position,
  // Order
  OrderRequest,
  Order,
  OrderFilter,
  // Results
  ConnectionResult,
  OrderResult,
  CancelResult,
  // Market Data
  Quote,
  QuoteCallback,
  Subscription,
  // Events
  BrokerEventType,
  BrokerEvent,
  BrokerEventListener,
  // Main Interface
  IBrokerAdapter,
} from './interfaces';

// =============================================================================
// Factory & Registry
// =============================================================================

export {
  // Factory functions
  createBrokerAdapter,
  getBrokerInstance,
  removeBrokerInstance,
  clearAllBrokerInstances,
  // Registry functions
  getAvailableBrokers,
  getAllBrokers,
  getBrokerInfo,
  isBrokerAvailable,
  // Registry
  BROKER_REGISTRY,
} from './broker-factory';

export type { BrokerInfo } from './broker-factory';

// =============================================================================
// Adapters
// =============================================================================

export { MockBrokerAdapter } from './adapters/mock-broker';
