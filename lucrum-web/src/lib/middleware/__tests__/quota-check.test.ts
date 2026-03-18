/**
 * Quota-check middleware unit tests
 *
 * Tests the three-layer quota enforcement logic:
 *   Layer 1: Plan monthly token ceiling
 *   Layer 2: Redis monthly counter
 *   Layer 3: LuBell (LB) fallback deduction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock external dependencies ────────────────────────────────────────────────

const mockRedisClient = {
  hmget: vi.fn(),
  pipeline: vi.fn(),
};

const mockPipeline = {
  hincrby: vi.fn().mockReturnThis(),
  hincrbyfloat: vi.fn().mockReturnThis(),
  expireat: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedisClient,
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Import after mocks ────────────────────────────────────────────────────────

import { checkAndConsumeQuota, consumeQuota } from '../quota-check';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockOverviewFetch(planCode: string, balance = 100): void {
  // First call: by-zitadel-sub → returns { id: 1 } (not needed in quota-check)
  // The overview fetch goes directly to /internal/v1/accounts/:id/overview
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      subscription: { plan_code: planCode },
      wallet: { balance },
    }),
  });
}

function mockDebitFetch(success: boolean, balanceAfter = 50): void {
  mockFetch.mockResolvedValueOnce({
    ok: success,
    json: async () => ({ success, balance_after: balanceAfter }),
  });
}

function mockRedisUsage(usedTokens: number, lbSpent = 0): void {
  mockRedisClient.hmget.mockResolvedValueOnce([String(usedTokens), String(lbSpent)]);
  mockRedisClient.pipeline.mockReturnValue(mockPipeline);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkAndConsumeQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.exec.mockResolvedValue([]);
  });

  describe('enterprise plan — unlimited', () => {
    it('allows any token count without redis check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscription: { plan_code: 'enterprise' } }),
      });

      const result = await checkAndConsumeQuota('1', 'user-a', 9_999_999);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1);
      expect(result.total).toBe(-1);
      expect(mockRedisClient.hmget).not.toHaveBeenCalled();
    });
  });

  describe('free plan', () => {
    it('allows when under monthly limit', async () => {
      mockOverviewFetch('free');
      mockRedisUsage(10_000); // 10k used, 40k remaining

      const result = await checkAndConsumeQuota('1', 'user-b', 1_000);

      expect(result.allowed).toBe(true);
      expect(result.plan).toBe('free');
      expect(result.total).toBe(50_000);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(
        expect.stringContaining('quota:user-b:'),
        'used_tokens',
        1_000,
      );
    });

    it('hard-blocks when over monthly limit (no LB fallback)', async () => {
      mockOverviewFetch('free');
      mockRedisUsage(49_999); // 49999 used, only 1 token left

      const result = await checkAndConsumeQuota('1', 'user-c', 2_000); // over by 1001

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('insufficient_quota');
      expect(result.topup_url).toBeDefined();
      // Debit should NOT have been called for free plan
      expect(mockFetch).toHaveBeenCalledTimes(1); // only the overview call
    });

    it('hard-blocks when exactly at limit', async () => {
      mockOverviewFetch('free');
      mockRedisUsage(50_000); // exactly at limit

      const result = await checkAndConsumeQuota('1', 'user-d', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('insufficient_quota');
    });
  });

  describe('basic plan', () => {
    it('allows when within plan limit', async () => {
      mockOverviewFetch('basic');
      mockRedisUsage(100_000);

      const result = await checkAndConsumeQuota('2', 'user-e', 50_000);

      expect(result.allowed).toBe(true);
      expect(result.total).toBe(500_000);
    });

    it('deducts LB when over limit and wallet sufficient', async () => {
      mockOverviewFetch('basic');
      mockRedisUsage(490_000); // 490k used, 10k remaining
      mockDebitFetch(true, 90);

      const result = await checkAndConsumeQuota('2', 'user-f', 50_000); // overage = 40k

      expect(result.allowed).toBe(true);
      expect(result.lb_spent).toBe(4); // ceil(40000 / 10000)
      expect(result.reason).toBeUndefined();
    });

    it('blocks when over limit and wallet insufficient', async () => {
      mockOverviewFetch('basic');
      mockRedisUsage(490_000);
      mockDebitFetch(false); // wallet debit fails

      const result = await checkAndConsumeQuota('2', 'user-g', 50_000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('insufficient_balance');
      expect(result.topup_url).toBeDefined();
    });
  });

  describe('pro plan', () => {
    it('allows large token counts within limit', async () => {
      mockOverviewFetch('pro');
      mockRedisUsage(1_000_000);

      const result = await checkAndConsumeQuota('3', 'user-h', 500_000);

      expect(result.allowed).toBe(true);
      expect(result.total).toBe(5_000_000);
    });

    it('deducts LB for overage and records lb_spent', async () => {
      mockOverviewFetch('pro');
      mockRedisUsage(4_990_000); // near limit
      mockDebitFetch(true, 50);

      const result = await checkAndConsumeQuota('3', 'user-i', 30_000); // overage = 20000

      expect(result.allowed).toBe(true);
      expect(result.lb_spent).toBe(2); // ceil(20000 / 10000)
    });
  });

  describe('fallback behavior', () => {
    it('defaults to free plan when identity service unavailable', async () => {
      // Simulate network error on overview fetch
      mockFetch.mockRejectedValueOnce(new Error('network error'));
      mockRedisUsage(10_000);

      const result = await checkAndConsumeQuota('4', 'user-j', 1_000);

      // Should apply free plan limits
      expect(result.allowed).toBe(true);
      expect(result.total).toBe(50_000);
      expect(result.plan).toBe('free');
    });

    it('allows when Redis unavailable (graceful degradation)', async () => {
      mockOverviewFetch('basic');
      mockRedisClient.hmget.mockRejectedValueOnce(new Error('redis down'));

      const result = await checkAndConsumeQuota('5', 'user-k', 1_000);

      // Redis failure → 0 used reported → within limit
      expect(result.allowed).toBe(true);
    });
  });
});

describe('consumeQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.exec.mockResolvedValue([]);
    mockRedisClient.pipeline.mockReturnValue(mockPipeline);
  });

  it('fires redis increment and identity report (non-blocking)', () => {
    mockFetch.mockResolvedValue({ ok: true });

    // Should not throw
    expect(() => {
      consumeQuota({
        accountId: '1',
        userId: 'user-l',
        tokens: 5_000,
        operationType: 'backtest',
      });
    }).not.toThrow();
  });
});
