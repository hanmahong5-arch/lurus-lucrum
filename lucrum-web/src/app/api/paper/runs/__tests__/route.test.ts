/**
 * Tests for /api/paper/runs (GET list + POST create).
 *
 * Test design from two perspectives:
 *   USER (clicks "纸上跑一遍" CTA): "Tell me the run was created with a
 *     visible ID, or fail loudly so I know what I need to fix."
 *   ADVERSARIAL TESTER: "401 / invalid JSON / no provenance / malformed
 *     seed_position (negative qty, zero price, missing fields) / capital
 *     out of range / DB throws / status filter edge values."
 *
 * @module app/api/paper/runs/__tests__/route
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockCreatePaperRun = vi.fn();
const mockListPaperRunsForUser = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/services/paper-trading-service", () => ({
  createPaperRun: (...args: unknown[]) => mockCreatePaperRun(...args),
  listPaperRunsForUser: (...args: unknown[]) => mockListPaperRunsForUser(...args),
  PaperRunStateError: class PaperRunStateError extends Error {
    code = "PAPER_RUN_INVALID_STATE";
    constructor(msg: string) {
      super(msg);
      this.name = "PaperRunStateError";
    }
  },
}));

async function GET(req: NextRequest) {
  const mod = await import("../route");
  return mod.GET(req);
}
async function POST(req: NextRequest) {
  const mod = await import("../route");
  return mod.POST(req);
}

function jsonPost(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/paper/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
function getReq(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/paper/runs${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

beforeEach(() => {
  mockGetServerSession.mockReset();
  mockCreatePaperRun.mockReset();
  mockListPaperRunsForUser.mockReset();
});
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// GET — auth + filter parsing
// ---------------------------------------------------------------------------

describe("GET /api/paper/runs — auth", () => {
  it("401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });
});

describe("GET /api/paper/runs — query parsing", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
    mockListPaperRunsForUser.mockResolvedValue([]);
  });

  it("calls service with no filter on empty query", async () => {
    await GET(getReq());
    expect(mockListPaperRunsForUser).toHaveBeenCalledWith("u1", {
      status: undefined,
      limit: undefined,
    });
  });

  it("accepts status=active", async () => {
    await GET(getReq("status=active"));
    expect(mockListPaperRunsForUser).toHaveBeenCalledWith("u1", {
      status: "active",
      limit: undefined,
    });
  });

  it("accepts status=paused / closed", async () => {
    for (const status of ["paused", "closed"] as const) {
      mockListPaperRunsForUser.mockClear();
      await GET(getReq(`status=${status}`));
      expect(mockListPaperRunsForUser).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ status }),
      );
    }
  });

  it("ignores invalid status values (treats as undefined)", async () => {
    await GET(getReq("status=running"));
    expect(mockListPaperRunsForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ status: undefined }),
    );
  });

  it("accepts limit=50", async () => {
    await GET(getReq("limit=50"));
    expect(mockListPaperRunsForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ limit: 50 }),
    );
  });

  it("ignores limit out of [1, 100] range", async () => {
    for (const bad of ["0", "-5", "101", "9999", "abc"]) {
      mockListPaperRunsForUser.mockClear();
      await GET(getReq(`limit=${bad}`));
      expect(mockListPaperRunsForUser).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ limit: undefined }),
      );
    }
  });

  it("returns runs array on success", async () => {
    mockListPaperRunsForUser.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// POST — auth + body validation
// ---------------------------------------------------------------------------

describe("POST /api/paper/runs — auth", () => {
  it("401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(jsonPost({ strategy_history_id: 1 }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/paper/runs — body validation", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
    mockCreatePaperRun.mockResolvedValue({ id: 99, userId: "u1" });
  });

  it("400 INVALID_JSON on unparseable body", async () => {
    const req = new NextRequest("http://localhost/api/paper/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("400 MISSING_STRATEGY when no provenance + no name/symbol", async () => {
    const res = await POST(jsonPost({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_STRATEGY");
  });

  it("400 MISSING_STRATEGY when only name (no symbol)", async () => {
    const res = await POST(jsonPost({ strategy_name: "test" }));
    expect(res.status).toBe(400);
  });

  it("400 MISSING_STRATEGY when only symbol (no name)", async () => {
    const res = await POST(jsonPost({ symbol: "600519" }));
    expect(res.status).toBe(400);
  });

  it("201 when strategy_history_id provided alone", async () => {
    const res = await POST(jsonPost({ strategy_history_id: 1 }));
    expect(res.status).toBe(201);
  });

  it("201 when marketplace_strategy_id provided alone", async () => {
    const res = await POST(jsonPost({ marketplace_strategy_id: 7 }));
    expect(res.status).toBe(201);
  });

  it("201 when strategy_name + symbol provided alone (orphan run)", async () => {
    const res = await POST(jsonPost({ strategy_name: "test", symbol: "600519" }));
    expect(res.status).toBe(201);
  });

  it("rejects non-integer strategy_history_id silently (treats as null)", async () => {
    // strategy_history_id=3.7 → truncates to 3 OR null. parseInteger
    // truncates, so this becomes 3. Verify by checking createPaperRun args.
    await POST(jsonPost({ strategy_history_id: 3.7 }));
    expect(mockCreatePaperRun).toHaveBeenCalledWith(
      expect.objectContaining({ strategyHistoryId: 3 }),
    );
  });

  it("treats string strategy_history_id as null (not a number)", async () => {
    const res = await POST(jsonPost({ strategy_history_id: "10" as unknown as number }));
    // No provenance because '10' fails parseInteger's typeof check
    expect(res.status).toBe(400);
  });
});

describe("POST /api/paper/runs — seed_position validation", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
    mockCreatePaperRun.mockResolvedValue({ id: 99 });
  });

  it("accepts well-formed seed_position", async () => {
    const res = await POST(
      jsonPost({
        strategy_history_id: 1,
        seed_position: { symbol: "600519", qty: 100, avg_cost: 1750 },
      }),
    );
    expect(res.status).toBe(201);
    expect(mockCreatePaperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        seedPosition: { symbol: "600519", qty: 100, avgCost: 1750 },
      }),
    );
  });

  it("rejects negative qty", async () => {
    const res = await POST(
      jsonPost({
        strategy_history_id: 1,
        seed_position: { symbol: "X", qty: -10, avg_cost: 100 },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_SEED_POSITION");
  });

  it("rejects zero qty", async () => {
    const res = await POST(
      jsonPost({
        strategy_history_id: 1,
        seed_position: { symbol: "X", qty: 0, avg_cost: 100 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects fractional qty (A-share lot is whole shares)", async () => {
    const res = await POST(
      jsonPost({
        strategy_history_id: 1,
        seed_position: { symbol: "X", qty: 1.5, avg_cost: 100 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects zero or negative avg_cost", async () => {
    for (const cost of [0, -1, -100]) {
      const res = await POST(
        jsonPost({
          strategy_history_id: 1,
          seed_position: { symbol: "X", qty: 10, avg_cost: cost },
        }),
      );
      expect(res.status).toBe(400);
    }
  });

  it("rejects empty / whitespace symbol", async () => {
    for (const sym of ["", "   ", "\t\n"]) {
      const res = await POST(
        jsonPost({
          strategy_history_id: 1,
          seed_position: { symbol: sym, qty: 10, avg_cost: 100 },
        }),
      );
      expect(res.status).toBe(400);
    }
  });

  it("rejects NaN / Infinity in numeric fields", async () => {
    for (const qty of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const res = await POST(
        jsonPost({
          strategy_history_id: 1,
          seed_position: { symbol: "X", qty, avg_cost: 100 },
        }),
      );
      expect(res.status).toBe(400);
    }
  });

  it("rejects missing fields", async () => {
    const res = await POST(
      jsonPost({
        strategy_history_id: 1,
        seed_position: { symbol: "X", qty: 10 } as unknown,
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/paper/runs — service error handling", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("400 with the service's message when PaperRunStateError thrown", async () => {
    const { PaperRunStateError } = await import("@/lib/services/paper-trading-service");
    mockCreatePaperRun.mockRejectedValue(
      new PaperRunStateError("initialCapital must be between 1000 and 100000000"),
    );
    const res = await POST(
      jsonPost({ strategy_history_id: 1, initial_capital: 999_999_999 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.description).toMatch(/initialCapital/);
  });

  it("500 CREATE_FAILED on unexpected exception (DB down)", async () => {
    mockCreatePaperRun.mockRejectedValue(new Error("connection refused"));
    const res = await POST(jsonPost({ strategy_history_id: 1 }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("CREATE_FAILED");
  });

  it("does not leak raw DB error message to caller", async () => {
    mockCreatePaperRun.mockRejectedValue(
      new Error("ECONNREFUSED at lurus-pg-1-1.database.svc:5432"),
    );
    const res = await POST(jsonPost({ strategy_history_id: 1 }));
    const body = await res.json();
    expect(body.error.description).not.toMatch(/lurus-pg-1-1/);
  });

  it("trims strategy_name + symbol before persisting", async () => {
    mockCreatePaperRun.mockResolvedValue({ id: 1 });
    await POST(
      jsonPost({ strategy_name: "  test  ", symbol: "  600519  " }),
    );
    expect(mockCreatePaperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        strategyName: "test",
        symbol: "600519",
      }),
    );
  });
});
