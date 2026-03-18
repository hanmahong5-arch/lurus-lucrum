/**
 * Broker Factory
 * 券商工厂
 *
 * Creates and manages broker adapter instances.
 * 创建和管理券商适配器实例。
 *
 * Supported Brokers:
 * - mock: 模拟券商（已实现）
 * - eastmoney: 东方财富（即将支持）
 * - futu: 富途证券（即将支持）
 * - tiger: 老虎证券（即将支持）
 * - ib: Interactive Brokers（即将支持）
 *
 * @module lib/broker/broker-factory
 */

import type {
  IBrokerAdapter,
  BrokerType,
  BrokerCredentials,
  MockBrokerCredentials,
} from './interfaces';
import { MockBrokerAdapter } from './adapters/mock-broker';

// =============================================================================
// Broker Registry
// =============================================================================

/**
 * Broker metadata
 * 券商元数据
 */
export interface BrokerInfo {
  type: BrokerType;
  name: string;
  displayName: string;
  description: string;
  status: 'available' | 'coming_soon' | 'beta' | 'deprecated';
  supportedMarkets: string[];
  features: string[];
  requiresAuth: boolean;
  iconUrl?: string;
}

/**
 * Registry of all supported brokers
 * 所有支持的券商注册表
 */
export const BROKER_REGISTRY: Record<BrokerType, BrokerInfo> = {
  mock: {
    type: 'mock',
    name: 'mock',
    displayName: '模拟交易',
    description: '本地模拟交易，无需真实账户，适合策略测试和学习',
    status: 'available',
    supportedMarkets: ['a_share'],
    features: [
      '即时成交模拟',
      '真实市场规则',
      '无资金限制',
      '完整交易记录',
    ],
    requiresAuth: false,
  },
  eastmoney: {
    type: 'eastmoney',
    name: 'eastmoney',
    displayName: '东方财富',
    description: '东方财富证券交易接口',
    status: 'coming_soon',
    supportedMarkets: ['a_share'],
    features: [
      'A股交易',
      '实时行情',
      '条件单',
    ],
    requiresAuth: true,
  },
  futu: {
    type: 'futu',
    name: 'futu',
    displayName: '富途证券',
    description: '富途证券 OpenAPI 接口',
    status: 'coming_soon',
    supportedMarkets: ['a_share', 'hk_stock', 'us_stock'],
    features: [
      'A股/港股/美股交易',
      '实时行情',
      '期权交易',
    ],
    requiresAuth: true,
  },
  tiger: {
    type: 'tiger',
    name: 'tiger',
    displayName: '老虎证券',
    description: '老虎证券 Open API 接口',
    status: 'coming_soon',
    supportedMarkets: ['us_stock', 'hk_stock'],
    features: [
      '港股/美股交易',
      '期权交易',
      '实时行情',
    ],
    requiresAuth: true,
  },
  ib: {
    type: 'ib',
    name: 'ib',
    displayName: 'Interactive Brokers',
    description: '盈透证券 TWS API 接口',
    status: 'coming_soon',
    supportedMarkets: ['us_stock', 'hk_stock', 'futures'],
    features: [
      '全球市场',
      '期货期权',
      '外汇',
    ],
    requiresAuth: true,
  },
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a broker adapter instance
 * 创建券商适配器实例
 *
 * @param type - Broker type / 券商类型
 * @param credentials - Optional credentials / 可选凭证
 */
export function createBrokerAdapter(
  type: BrokerType,
  credentials?: BrokerCredentials
): IBrokerAdapter {
  switch (type) {
    case 'mock':
      return new MockBrokerAdapter(credentials as MockBrokerCredentials);

    case 'eastmoney':
      throw new Error('EastMoney broker is coming soon / 东方财富券商即将支持');

    case 'futu':
      throw new Error('Futu broker is coming soon / 富途证券即将支持');

    case 'tiger':
      throw new Error('Tiger broker is coming soon / 老虎证券即将支持');

    case 'ib':
      throw new Error('Interactive Brokers is coming soon / 盈透证券即将支持');

    default:
      throw new Error(`Unknown broker type: ${type} / 未知的券商类型`);
  }
}

/**
 * Get list of available brokers
 * 获取可用的券商列表
 */
export function getAvailableBrokers(): BrokerInfo[] {
  return Object.values(BROKER_REGISTRY).filter(
    (broker) => broker.status === 'available' || broker.status === 'beta'
  );
}

/**
 * Get all brokers including coming soon
 * 获取所有券商（包括即将支持的）
 */
export function getAllBrokers(): BrokerInfo[] {
  return Object.values(BROKER_REGISTRY);
}

/**
 * Get broker info by type
 * 根据类型获取券商信息
 */
export function getBrokerInfo(type: BrokerType): BrokerInfo | undefined {
  return BROKER_REGISTRY[type];
}

/**
 * Check if a broker is available
 * 检查券商是否可用
 */
export function isBrokerAvailable(type: BrokerType): boolean {
  const info = BROKER_REGISTRY[type];
  return info?.status === 'available' || info?.status === 'beta';
}

// =============================================================================
// Singleton Instance Management
// =============================================================================

/** Singleton broker instances / 单例券商实例 */
const brokerInstances: Map<BrokerType, IBrokerAdapter> = new Map();

/**
 * Get or create a broker instance (singleton pattern)
 * 获取或创建券商实例（单例模式）
 *
 * @param type - Broker type / 券商类型
 * @param credentials - Optional credentials / 可选凭证
 */
export function getBrokerInstance(
  type: BrokerType,
  credentials?: BrokerCredentials
): IBrokerAdapter {
  let instance = brokerInstances.get(type);

  if (!instance) {
    instance = createBrokerAdapter(type, credentials);
    brokerInstances.set(type, instance);
  }

  return instance;
}

/**
 * Remove a broker instance
 * 移除券商实例
 */
export async function removeBrokerInstance(type: BrokerType): Promise<void> {
  const instance = brokerInstances.get(type);

  if (instance) {
    if (instance.isConnected()) {
      await instance.disconnect();
    }
    brokerInstances.delete(type);
  }
}

/**
 * Remove all broker instances
 * 移除所有券商实例
 */
export async function clearAllBrokerInstances(): Promise<void> {
  const brokerTypes = Array.from(brokerInstances.keys());
  for (const type of brokerTypes) {
    await removeBrokerInstance(type);
  }
}

// =============================================================================
// Export Convenience Types
// =============================================================================

export type { BrokerType, BrokerCredentials, MockBrokerCredentials };
