/**
 * useBroker Hook
 * 券商 Hook
 *
 * React hook for managing broker connections and trading operations.
 * 用于管理券商连接和交易操作的 React Hook。
 *
 * @module hooks/use-broker
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  IBrokerAdapter,
  BrokerType,
  BrokerCredentials,
  AccountInfo,
  BalanceInfo,
  Position,
  Order,
  OrderRequest,
  OrderResult,
  CancelResult,
  OrderFilter,
  Quote,
} from '@/lib/broker/interfaces';
import {
  getBrokerInstance,
  removeBrokerInstance,
  getBrokerInfo,
  type BrokerInfo,
} from '@/lib/broker/broker-factory';

// =============================================================================
// Types
// =============================================================================

export interface UseBrokerOptions {
  /** Auto-connect on mount / 挂载时自动连接 */
  autoConnect?: boolean;
  /** Credentials for connection / 连接凭证 */
  credentials?: BrokerCredentials;
  /** Auto-refresh interval in ms / 自动刷新间隔（毫秒） */
  refreshInterval?: number;
}

export interface UseBrokerResult {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Broker instance / 券商实例 */
  broker: IBrokerAdapter | null;
  /** Broker info / 券商信息 */
  brokerInfo: BrokerInfo | undefined;
  /** Is connected / 是否已连接 */
  isConnected: boolean;
  /** Is connecting / 是否正在连接 */
  isConnecting: boolean;
  /** Connection error / 连接错误 */
  error: string | null;
  /** Account info / 账户信息 */
  account: AccountInfo | null;
  /** Balance info / 资金信息 */
  balance: BalanceInfo | null;
  /** Positions / 持仓 */
  positions: Position[];
  /** Orders / 订单 */
  orders: Order[];
  /** Is loading data / 是否正在加载 */
  isLoading: boolean;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Connect to broker / 连接券商 */
  connect: (credentials?: BrokerCredentials) => Promise<boolean>;
  /** Disconnect from broker / 断开连接 */
  disconnect: () => Promise<void>;
  /** Refresh all data / 刷新所有数据 */
  refresh: () => Promise<void>;
  /** Place an order / 下单 */
  placeOrder: (order: OrderRequest) => Promise<OrderResult>;
  /** Cancel an order / 撤单 */
  cancelOrder: (orderId: string) => Promise<CancelResult>;
  /** Get quote / 获取行情 */
  getQuote: (symbol: string) => Promise<Quote | null>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useBroker(
  brokerType: BrokerType = 'mock',
  options: UseBrokerOptions = {}
): UseBrokerResult {
  const { autoConnect = false, credentials, refreshInterval } = options;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [broker, setBroker] = useState<IBrokerAdapter | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const brokerInfo = getBrokerInfo(brokerType);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // Connect
  // ---------------------------------------------------------------------------

  const connect = useCallback(
    async (creds?: BrokerCredentials): Promise<boolean> => {
      if (isConnecting || isConnected) return isConnected;

      setIsConnecting(true);
      setError(null);

      try {
        const instance = getBrokerInstance(brokerType, creds || credentials);
        const result = await instance.connect(creds || credentials || { brokerType });

        if (result.connected) {
          setBroker(instance);
          setIsConnected(true);
          setAccount(result.account || null);

          // Set up event listeners
          instance.on('order_update', (event) => {
            setOrders((prev) => {
              const order = event.data as Order;
              const index = prev.findIndex((o) => o.orderId === order.orderId);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = order;
                return updated;
              }
              return [order, ...prev];
            });
          });

          instance.on('balance_update', (event) => {
            setBalance(event.data as BalanceInfo);
          });

          instance.on('position_update', () => {
            // Refresh positions on update
            instance.getPositions().then(setPositions).catch(console.error);
          });

          instance.on('disconnected', () => {
            setIsConnected(false);
          });

          // Initial data fetch
          await refreshData(instance);

          return true;
        } else {
          setError(result.error || 'Connection failed / 连接失败');
          return false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [brokerType, credentials, isConnecting, isConnected]
  );

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(async (): Promise<void> => {
    if (!broker) return;

    try {
      await removeBrokerInstance(brokerType);
      setBroker(null);
      setIsConnected(false);
      setAccount(null);
      setBalance(null);
      setPositions([]);
      setOrders([]);
    } catch (err) {
      console.error('[useBroker] Disconnect error:', err);
    }
  }, [broker, brokerType]);

  // ---------------------------------------------------------------------------
  // Refresh Data
  // ---------------------------------------------------------------------------

  const refreshData = async (instance: IBrokerAdapter): Promise<void> => {
    setIsLoading(true);

    try {
      const [balanceData, positionsData, ordersData] = await Promise.all([
        instance.getBalance(),
        instance.getPositions(),
        instance.getOrders({ limit: 50 }),
      ]);

      setBalance(balanceData);
      setPositions(positionsData);
      setOrders(ordersData);
    } catch (err) {
      console.error('[useBroker] Refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = useCallback(async (): Promise<void> => {
    if (!broker || !isConnected) return;
    await refreshData(broker);
  }, [broker, isConnected]);

  // ---------------------------------------------------------------------------
  // Trading Operations
  // ---------------------------------------------------------------------------

  const placeOrder = useCallback(
    async (order: OrderRequest): Promise<OrderResult> => {
      if (!broker || !isConnected) {
        return {
          success: false,
          errorCode: 'NOT_CONNECTED',
          errorMessage: 'Broker not connected / 券商未连接',
        };
      }

      try {
        const result = await broker.placeOrder(order);

        if (result.success && result.order) {
          setOrders((prev) => [result.order!, ...prev]);
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Order failed';
        return {
          success: false,
          errorCode: 'ORDER_ERROR',
          errorMessage: message,
        };
      }
    },
    [broker, isConnected]
  );

  const cancelOrder = useCallback(
    async (orderId: string): Promise<CancelResult> => {
      if (!broker || !isConnected) {
        return {
          success: false,
          orderId,
          errorMessage: 'Broker not connected / 券商未连接',
        };
      }

      try {
        const result = await broker.cancelOrder(orderId);

        if (result.success) {
          // Refresh orders after cancel
          const updatedOrders = await broker.getOrders({ limit: 50 });
          setOrders(updatedOrders);
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Cancel failed';
        return {
          success: false,
          orderId,
          errorMessage: message,
        };
      }
    },
    [broker, isConnected]
  );

  const getQuote = useCallback(
    async (symbol: string): Promise<Quote | null> => {
      if (!broker || !isConnected || !broker.getQuote) {
        return null;
      }

      try {
        return await broker.getQuote(symbol);
      } catch (err) {
        console.error('[useBroker] getQuote error:', err);
        return null;
      }
    },
    [broker, isConnected]
  );

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !isConnected && !isConnecting) {
      connect();
    }
  }, [autoConnect, isConnected, isConnecting, connect]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && isConnected) {
      refreshIntervalRef.current = setInterval(refresh, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [refreshInterval, isConnected, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    broker,
    brokerInfo,
    isConnected,
    isConnecting,
    error,
    account,
    balance,
    positions,
    orders,
    isLoading,
    connect,
    disconnect,
    refresh,
    placeOrder,
    cancelOrder,
    getQuote,
  };
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * useMockBroker - Convenience hook for mock broker
 * 模拟券商便捷 Hook
 */
export function useMockBroker(options: Omit<UseBrokerOptions, 'credentials'> = {}) {
  return useBroker('mock', {
    ...options,
    autoConnect: options.autoConnect ?? true,
  });
}
