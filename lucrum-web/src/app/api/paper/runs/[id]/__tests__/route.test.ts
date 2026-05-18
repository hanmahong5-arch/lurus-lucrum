/**
 * Tests for /api/paper/runs/:id (GET detail + DELETE close).
 *
 * Test design from two perspectives:
 *   USER (sidebar click): "Open my run; if it's not mine, tell me access
 *     denied — don't return 404 (which would leak existence)."
 *   ADVERSARIAL TESTER: "Invalid id formats, IDOR (foreign user), already
 *     closed (idempotency), DB exceptions, malformed params object."
 *
 * @module app/api/paper/runs/[id]/__tests__/route
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();
const mockGetPaperRun = vi.fn();
const mockClosePaperRun = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/services/paper-trading-service", () => ({
  getPaperRun: (...args: unknown[]) => mockGetPaperRun(...args),
  closePaperRun: (...args: unknown[]) => mockClosePaperRun(...args),
  PaperRunNotFoundError: class PaperRunNotFoundError extends Error {
    code = "PAPER_RUN_NOT_FOUND";
    constructor(id: number) {
      super(`paper_run ${id} not found`);
      this.name = "PaperRunNotFoundError";
    }
  },
  PaperRunOwnershipError: class PaperRunOwnershipError extends Error {
    code = "PAPER_RUN_NOT_OWNED";
    constructor(id: number) {
      super(`paper_run ${id} not owned`);
      this.name = "PaperRunOwnershipError";
    }
  },
}));

interface RouteContext {
  params: { id: string };
}
async function GET(req: NextRequest, ctx: RouteContext) {
  const mod = await import("../route");
  return mod.GET(req, ctx);
}
async function DELETE_(req: NextRequest, ctx: RouteContext) {
  const mod = await import("../route");
  return mod.DELETE(req, ctx);
}

function req(method: "GET" | "DELETE" = "GET"): NextRequest {
  return new NextRequest("http://localhost/api/paper/runs/1", { method });
}

beforeEach(() => {
  mockGetServerSession.mockReset();
  mockGetPaperRun.mockReset();
  mockClosePaperRun.mockReset();
});
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// Auth gating
// ---------------------------------------------------------------------------

describe("/api/paper/runs/:id — auth", () => {
  it("GET 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(req("GET"), { params: { id: "1" } });
    expect(res.status).toBe(401);
  });
  it("DELETE 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE_(req("DELETE"), { params: { id: "1" } });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// id validation
// ---------------------------------------------------------------------------

describe("/api/paper/runs/:id — id validation", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("400 INVALID_ID for non-numeric id", async () => {
    const res = await GET(req(), { params: { id: "abc" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_ID");
  });

  it("400 INVALID_ID for negative id", async () => {
    const res = await GET(req(), { params: { id: "-5" } });
    expect(res.status).toBe(400);
  });

  it("400 INVALID_ID for zero id", async () => {
    const res = await GET(req(), { params: { id: "0" } });
    expect(res.status).toBe(400);
  });

  it("400 INVALID_ID for empty id", async () => {
    const res = await GET(req(), { params: { id: "" } });
    expect(res.status).toBe(400);
  });

  it("400 INVALID_ID for float id (1.5)", async () => {
    const res = await GET(req(), { params: { id: "1.5" } });
    expect(res.status).toBe(400);
  });

  it("400 INVALID_ID for SQL-injection-shaped id", async () => {
    const res = await GET(req(), { params: { id: "1 OR 1=1" } });
    expect(res.status).toBe(400);
  });

  it("accepts positive integer id", async () => {
    mockGetPaperRun.mockResolvedValue({ run: { id: 1 }, positions: [], recentTrades: [] });
    const res = await GET(req(), { params: { id: "1" } });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET — detail + error classification
// ---------------------------------------------------------------------------

describe("GET /api/paper/runs/:id — service error mapping", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("returns the loaded run + positions + recentTrades on success", async () => {
    mockGetPaperRun.mockResolvedValue({
      run: { id: 1, userId: "u1" },
      positions: [{ runId: 1, symbol: "X", qty: 10 }],
      recentTrades: [{ id: 100, runId: 1 }],
    });
    const res = await GET(req(), { params: { id: "1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.id).toBe(1);
    expect(body.positions).toHaveLength(1);
    expect(body.recentTrades).toHaveLength(1);
  });

  it("404 on PaperRunNotFoundError", async () => {
    const { PaperRunNotFoundError } = await import("@/lib/services/paper-trading-service");
    mockGetPaperRun.mockRejectedValue(new PaperRunNotFoundError(1));
    const res = await GET(req(), { params: { id: "1" } });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("PAPER_RUN_NOT_FOUND");
  });

  it("403 on PaperRunOwnershipError (NOT 404 — would leak existence)", async () => {
    const { PaperRunOwnershipError } = await import("@/lib/services/paper-trading-service");
    mockGetPaperRun.mockRejectedValue(new PaperRunOwnershipError(1, "u1"));
    const res = await GET(req(), { params: { id: "1" } });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PAPER_RUN_NOT_OWNED");
  });

  it("500 LOAD_FAILED on unexpected exception", async () => {
    mockGetPaperRun.mockRejectedValue(new Error("DB connection lost"));
    const res = await GET(req(), { params: { id: "1" } });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("LOAD_FAILED");
    // Don't leak DB error to caller
    expect(body.error.description).not.toMatch(/DB connection lost/);
  });
});

// ---------------------------------------------------------------------------
// DELETE — idempotent close + error classification
// ---------------------------------------------------------------------------

describe("DELETE /api/paper/runs/:id — close path", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("returns the closed run on success", async () => {
    mockClosePaperRun.mockResolvedValue({ id: 1, status: "closed" });
    const res = await DELETE_(req("DELETE"), { params: { id: "1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.status).toBe("closed");
  });

  it("idempotent — double DELETE returns the already-closed row (200)", async () => {
    mockClosePaperRun.mockResolvedValue({ id: 1, status: "closed" });
    const res1 = await DELETE_(req("DELETE"), { params: { id: "1" } });
    const res2 = await DELETE_(req("DELETE"), { params: { id: "1" } });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("404 on NotFound", async () => {
    const { PaperRunNotFoundError } = await import("@/lib/services/paper-trading-service");
    mockClosePaperRun.mockRejectedValue(new PaperRunNotFoundError(1));
    const res = await DELETE_(req("DELETE"), { params: { id: "1" } });
    expect(res.status).toBe(404);
  });

  it("403 on Ownership", async () => {
    const { PaperRunOwnershipError } = await import("@/lib/services/paper-trading-service");
    mockClosePaperRun.mockRejectedValue(new PaperRunOwnershipError(1, "u1"));
    const res = await DELETE_(req("DELETE"), { params: { id: "1" } });
    expect(res.status).toBe(403);
  });

  it("500 CLOSE_FAILED on unexpected exception", async () => {
    mockClosePaperRun.mockRejectedValue(new Error("something else"));
    const res = await DELETE_(req("DELETE"), { params: { id: "1" } });
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("CLOSE_FAILED");
  });
});
