import { describe, it, expect, beforeEach } from 'vitest';
import { MockBrokerAdapter } from '../../broker/adapters/mock-broker';
import type { OrderRequest, OrderStatus } from '../../broker/interfaces';

// Helper to connect broker before use
async function createConnectedBroker(initialBalance?: number): Promise<MockBrokerAdapter> {
  const broker = new MockBrokerAdapter(
    initialBalance ? { brokerType: 'mock' as const, initialBalance } : undefined,
  );
  await broker.connect({ brokerType: 'mock' });
  return broker;
}

// Helper to build a valid market buy order
function marketBuy(symbol: string, quantity: number): OrderRequest {
  return { symbol, side: 'buy', type: 'market', quantity };
}

// Helper to build a valid market sell order
function marketSell(symbol: string, quantity: number): OrderRequest {
  return { symbol, side: 'sell', type: 'market', quantity };
}

describe('MockBrokerAdapter', () => {
  // ===========================================================================
  // Connection
  // ===========================================================================

  describe('connection', () => {
    it('starts disconnected', () => {
      const broker = new MockBrokerAdapter();
      expect(broker.isConnected()).toBe(false);
    });

    it('connects successfully and returns account info', async () => {
      const broker = new MockBrokerAdapter();
      const result = await broker.connect({ brokerType: 'mock' });

      expect(result.connected).toBe(true);
      expect(result.account).toBeDefined();
      expect(result.account!.isPaperTrading).toBe(true);
      expect(broker.isConnected()).toBe(true);
    });

    it('disconnects and reflects state', async () => {
      const broker = await createConnectedBroker();
      await broker.disconnect();
      expect(broker.isConnected()).toBe(false);
    });

    it('throws when calling account methods while disconnected', async () => {
      const broker = new MockBrokerAdapter();
      await expect(broker.getBalance()).rejects.toThrow('not connected');
    });
  });

  // ===========================================================================
  // Account & Balance
  // ===========================================================================

  describe('balance', () => {
    it('reports initial balance correctly', async () => {
      const broker = await createConnectedBroker(100000);
      const balance = await broker.getBalance();

      expect(balance.totalEquity).toBeCloseTo(100000, 0);
      expect(balance.availableCash).toBeCloseTo(100000, 0);
      expect(balance.frozenCash).toBe(0);
      expect(balance.currency).toBe('CNY');
    });

    it('uses default balance when no credentials provided', async () => {
      const broker = await createConnectedBroker();
      const balance = await broker.getBalance();
      expect(balance.totalEquity).toBeCloseTo(500000, 0);
    });
  });

  // ===========================================================================
  // Order Validation
  // ===========================================================================

  describe('order validation', () => {
    let broker: MockBrokerAdapter;

    beforeEach(async () => {
      broker = await createConnectedBroker(1000000);
    });

    it('rejects quantity not a multiple of 100 (lot size)', async () => {
      const result = await broker.placeOrder(marketBuy('600000', 150));
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('100');
    });

    it('rejects quantity less than 100', async () => {
      const result = await broker.placeOrder(marketBuy('600000', 50));
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('100');
    });

    it('rejects limit order without limit price', async () => {
      const result = await broker.placeOrder({
        symbol: '600000',
        side: 'buy',
        type: 'limit',
        quantity: 100,
      });
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Limit price');
    });

    it('rejects sell order without sufficient position', async () => {
      const result = await broker.placeOrder(marketSell('600000', 100));
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Insufficient shares');
    });
  });

  // ===========================================================================
  // Order Execution
  // ===========================================================================

  describe('order execution', () => {
    let broker: MockBrokerAdapter;

    beforeEach(async () => {
      broker = await createConnectedBroker(1000000);
    });

    it('executes market buy order and creates position', async () => {
      const result = await broker.placeOrder(marketBuy('600000', 100));

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order!.status).toBe('filled');
      expect(result.order!.filledQty).toBe(100);
      expect(result.order!.avgFillPrice).toBeGreaterThan(0);

      const positions = await broker.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0]!.symbol).toBe('600000');
      expect(positions[0]!.quantity).toBe(100);
    });

    it('executes market sell after buying and removes position', async () => {
      await broker.placeOrder(marketBuy('600000', 200));
      const sellResult = await broker.placeOrder(marketSell('600000', 200));

      expect(sellResult.success).toBe(true);
      expect(sellResult.order!.status).toBe('filled');

      const positions = await broker.getPositions();
      expect(positions.length).toBe(0);
    });

    it('reduces cash after buy order', async () => {
      const balanceBefore = await broker.getBalance();
      await broker.placeOrder(marketBuy('600000', 100));
      const balanceAfter = await broker.getBalance();

      expect(balanceAfter.availableCash).toBeLessThan(balanceBefore.availableCash);
    });
  });

  // ===========================================================================
  // Cancel Order
  // ===========================================================================

  describe('cancel order', () => {
    it('returns error for non-existent order', async () => {
      const broker = await createConnectedBroker();
      const result = await broker.cancelOrder('FAKE_ID');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('not found');
    });

    it('cannot cancel already filled order', async () => {
      const broker = await createConnectedBroker(1000000);
      const orderResult = await broker.placeOrder(marketBuy('600000', 100));
      const cancelResult = await broker.cancelOrder(orderResult.order!.orderId);

      expect(cancelResult.success).toBe(false);
      expect(cancelResult.errorMessage).toContain('filled');
    });
  });

  // ===========================================================================
  // Event System
  // ===========================================================================

  describe('event system', () => {
    it('emits connected event on connect', async () => {
      const broker = new MockBrokerAdapter();
      let emitted = false;
      broker.on('connected', () => { emitted = true; });

      await broker.connect({ brokerType: 'mock' });
      expect(emitted).toBe(true);
    });

    it('removes listener with off()', async () => {
      const broker = new MockBrokerAdapter();
      let count = 0;
      const listener = () => { count++; };

      broker.on('connected', listener);
      await broker.connect({ brokerType: 'mock' });
      expect(count).toBe(1);

      broker.off('connected', listener);
      // Reconnect to check listener was removed
      await broker.disconnect();
      await broker.connect({ brokerType: 'mock' });
      expect(count).toBe(1);
    });
  });

  // ===========================================================================
  // Market Data
  // ===========================================================================

  describe('market data', () => {
    it('returns a quote with valid fields', async () => {
      const broker = await createConnectedBroker();
      const quote = await broker.getQuote('600000');

      expect(quote.symbol).toBe('600000');
      expect(quote.lastPrice).toBeGreaterThan(0);
      expect(quote.volume).toBeGreaterThanOrEqual(0);
      expect(quote.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ===========================================================================
  // Insufficient Funds (lines 471-476)
  // ===========================================================================

  describe('insufficient funds', () => {
    it('rejects buy order when funds are insufficient', async () => {
      const broker = await createConnectedBroker(100); // Very low balance
      const result = await broker.placeOrder(marketBuy('600000', 100));
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Insufficient funds');
    });
  });

  // ===========================================================================
  // Adding to Existing Position (lines 516-525)
  // ===========================================================================

  describe('add to existing position', () => {
    it('updates average cost and quantity when buying same symbol twice', async () => {
      const broker = await createConnectedBroker(10000000);

      // First buy
      await broker.placeOrder(marketBuy('600000', 100));
      const posAfterFirst = await broker.getPositions();
      expect(posAfterFirst.length).toBe(1);
      const firstQty = posAfterFirst[0]!.quantity;
      expect(firstQty).toBe(100);

      // Second buy of the same symbol
      await broker.placeOrder(marketBuy('600000', 200));
      const posAfterSecond = await broker.getPositions();
      expect(posAfterSecond.length).toBe(1);
      expect(posAfterSecond[0]!.quantity).toBe(300);
      expect(posAfterSecond[0]!.avgCost).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Stop Order Validation (lines 460-465)
  // ===========================================================================

  describe('stop order validation', () => {
    it('rejects stop order without stop price', async () => {
      const broker = await createConnectedBroker(1000000);
      const result = await broker.placeOrder({
        symbol: '600000',
        side: 'buy',
        type: 'stop',
        quantity: 100,
      });
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Stop price');
    });

    it('rejects stop_limit order without stop price', async () => {
      const broker = await createConnectedBroker(1000000);
      const result = await broker.placeOrder({
        symbol: '600000',
        side: 'buy',
        type: 'stop_limit',
        quantity: 100,
        limitPrice: 50,
      });
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Stop price');
    });
  });

  // ===========================================================================
  // Limit Order Submission (non-market path, line 241-244)
  // ===========================================================================

  describe('limit order submission', () => {
    it('submits limit order without immediate execution', async () => {
      const broker = await createConnectedBroker(1000000);
      const result = await broker.placeOrder({
        symbol: '600000',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        limitPrice: 10,
      });
      expect(result.success).toBe(true);
      expect(result.order!.status).toBe('submitted');
    });
  });

  // ===========================================================================
  // Cancel Pending Limit Order (lines 276-290)
  // ===========================================================================

  describe('cancel pending order', () => {
    it('cancels a submitted limit order and unfreezes cash', async () => {
      const broker = await createConnectedBroker(1000000);
      const orderResult = await broker.placeOrder({
        symbol: '600000',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        limitPrice: 10,
      });
      const cancelResult = await broker.cancelOrder(orderResult.order!.orderId);
      expect(cancelResult.success).toBe(true);
    });

    it('cannot cancel already cancelled order', async () => {
      const broker = await createConnectedBroker(1000000);
      const orderResult = await broker.placeOrder({
        symbol: '600000',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        limitPrice: 10,
      });
      await broker.cancelOrder(orderResult.order!.orderId);
      const secondCancel = await broker.cancelOrder(orderResult.order!.orderId);
      expect(secondCancel.success).toBe(false);
    });
  });

  // ===========================================================================
  // Order Queries (getOrders, getOrder)
  // ===========================================================================

  describe('order queries', () => {
    it('getOrders returns all orders', async () => {
      const broker = await createConnectedBroker(1000000);
      await broker.placeOrder(marketBuy('600000', 100));
      await broker.placeOrder(marketBuy('600001', 100));
      const orders = await broker.getOrders();
      expect(orders.length).toBe(2);
    });

    it('getOrders filters by symbol', async () => {
      const broker = await createConnectedBroker(1000000);
      await broker.placeOrder(marketBuy('600000', 100));
      await broker.placeOrder(marketBuy('600001', 100));
      const orders = await broker.getOrders({ symbol: '600000' });
      expect(orders.length).toBe(1);
      expect(orders[0]!.symbol).toBe('600000');
    });

    it('getOrders filters by status', async () => {
      const broker = await createConnectedBroker(1000000);
      await broker.placeOrder(marketBuy('600000', 100));
      await broker.placeOrder({
        symbol: '600001',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        limitPrice: 10,
      });
      const filledOrders = await broker.getOrders({ status: ['filled'] as OrderStatus[] });
      expect(filledOrders.every((o) => o.status === 'filled')).toBe(true);
    });

    it('getOrders filters by side', async () => {
      const broker = await createConnectedBroker(1000000);
      await broker.placeOrder(marketBuy('600000', 100));
      const orders = await broker.getOrders({ side: 'sell' });
      expect(orders.length).toBe(0);
    });

    it('getOrders filters by limit', async () => {
      const broker = await createConnectedBroker(1000000);
      await broker.placeOrder(marketBuy('600000', 100));
      await broker.placeOrder(marketBuy('600001', 100));
      const orders = await broker.getOrders({ limit: 1 });
      expect(orders.length).toBe(1);
    });

    it('getOrders filters by date range', async () => {
      const broker = await createConnectedBroker(1000000);
      await broker.placeOrder(marketBuy('600000', 100));
      const futureDate = new Date(Date.now() + 86400000);
      const orders = await broker.getOrders({ startDate: futureDate });
      expect(orders.length).toBe(0);
    });

    it('getOrder returns specific order', async () => {
      const broker = await createConnectedBroker(1000000);
      const result = await broker.placeOrder(marketBuy('600000', 100));
      const order = await broker.getOrder(result.order!.orderId);
      expect(order).toBeDefined();
      expect(order!.orderId).toBe(result.order!.orderId);
    });

    it('getOrder returns null for non-existent order', async () => {
      const broker = await createConnectedBroker();
      const order = await broker.getOrder('FAKE_ID');
      expect(order).toBeNull();
    });
  });

  // ===========================================================================
  // Partial Sell (lines 554-561)
  // ===========================================================================

  describe('partial sell', () => {
    it('reduces position without deleting when partially sold', async () => {
      const broker = await createConnectedBroker(10000000);
      await broker.placeOrder(marketBuy('600000', 300));
      await broker.placeOrder(marketSell('600000', 100));
      const positions = await broker.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0]!.quantity).toBe(200);
    });
  });

  // ===========================================================================
  // Subscribe (lines 352-365)
  // ===========================================================================

  describe('subscribe', () => {
    it('returns a subscription that can be unsubscribed', async () => {
      const broker = await createConnectedBroker();
      const sub = broker.subscribe(['600000'], () => {});
      expect(sub.symbols).toContain('600000');
      expect(typeof sub.unsubscribe).toBe('function');
      sub.unsubscribe();
    });
  });

  // ===========================================================================
  // Event listener error handling (lines 401-403)
  // ===========================================================================

  describe('event listener error handling', () => {
    it('does not throw when event listener throws', async () => {
      const broker = new MockBrokerAdapter();
      broker.on('connected', () => { throw new Error('listener error'); });
      // Should not throw despite listener error
      await expect(broker.connect({ brokerType: 'mock' })).resolves.toBeDefined();
    });
  });
});
