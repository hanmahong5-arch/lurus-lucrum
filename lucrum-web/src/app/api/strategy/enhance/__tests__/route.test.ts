/**
 * Tests for POST /api/strategy/enhance.
 *
 * Test design from two perspectives:
 *   USER ("把它变专业" button): "Click enhance — if it works, my prompt
 *     is rewritten clearly; if it fails, I see why and my text stays."
 *   ADVERSARIAL TESTER: "401 / malformed JSON / empty / 600+ char input /
 *     LLM throws / LLM cancels / LLM returns empty string."
 *
 * @module app/api/strategy/enhance/__tests__/route
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the route is imported so the
// route's `import` statements resolve to our stubs.
// ---------------------------------------------------------------------------

const mockGetServerSession = vi.fn();
const mockChatComplete = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/llm", () => ({
  chatComplete: (...args: unknown[]) => mockChatComplete(...args),
  LlmCancelledError: class LlmCancelledError extends Error {
    code = "LLM_CANCELLED";
    constructor(message: string) {
      super(message);
      this.name = "LlmCancelledError";
    }
  },
}));

// Imported AFTER the mocks above so the route binds to the mocked modules.
// Using a top-level import would resolve at module load time.
async function POST(req: NextRequest) {
  const mod = await import("../route");
  return mod.POST(req);
}

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/strategy/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetServerSession.mockReset();
  mockChatComplete.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/strategy/enhance — auth", () => {
  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(buildRequest({ prompt: "test" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when session has no user", async () => {
    mockGetServerSession.mockResolvedValue({});
    const res = await POST(buildRequest({ prompt: "test" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/strategy/enhance — input validation", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", name: "tester" } });
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/strategy/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all {{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("returns 400 when prompt is missing", async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("EMPTY_PROMPT");
  });

  it("returns 400 when prompt is empty string", async () => {
    const res = await POST(buildRequest({ prompt: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("EMPTY_PROMPT");
  });

  it("returns 400 when prompt is whitespace-only", async () => {
    const res = await POST(buildRequest({ prompt: "   \n\t   " }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("EMPTY_PROMPT");
  });

  it("returns 400 when prompt is non-string (number / null / array)", async () => {
    for (const bad of [42, null, ["array"], { obj: true }]) {
      const res = await POST(buildRequest({ prompt: bad }));
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 when prompt exceeds 600 chars", async () => {
    const long = "x".repeat(601);
    const res = await POST(buildRequest({ prompt: long }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("PROMPT_TOO_LONG");
  });

  it("accepts prompt at exactly 600 chars", async () => {
    mockChatComplete.mockResolvedValue({
      content: "fine",
      model: "m",
      fallbackUsed: false,
    });
    const exactly600 = "x".repeat(600);
    const res = await POST(buildRequest({ prompt: exactly600 }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/strategy/enhance — LLM behaviour", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("returns 200 with enhanced content on LLM success", async () => {
    mockChatComplete.mockResolvedValue({
      content: "标的: 沪深300. 周期: 日线. 入场: 双均线金叉. 出场: 死叉或止损 5%.",
      model: "deepseek",
      fallbackUsed: false,
    });
    const res = await POST(buildRequest({ prompt: "均线" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.enhanced).toMatch(/标的: 沪深300/);
    expect(body.data.model).toBe("deepseek");
    expect(body.data.fallbackUsed).toBe(false);
  });

  it("trims the LLM output (no leading/trailing whitespace)", async () => {
    mockChatComplete.mockResolvedValue({
      content: "   trimmed result   ",
      model: "m",
      fallbackUsed: false,
    });
    const res = await POST(buildRequest({ prompt: "x" }));
    const body = await res.json();
    expect(body.data.enhanced).toBe("trimmed result");
  });

  it("caps output at 600 chars (defense-in-depth)", async () => {
    mockChatComplete.mockResolvedValue({
      content: "y".repeat(2000),
      model: "m",
      fallbackUsed: false,
    });
    const res = await POST(buildRequest({ prompt: "x" }));
    const body = await res.json();
    expect(body.data.enhanced.length).toBe(600);
  });

  it("returns 502 ENHANCE_EMPTY when LLM returns empty string", async () => {
    mockChatComplete.mockResolvedValue({
      content: "",
      model: "m",
      fallbackUsed: false,
    });
    const res = await POST(buildRequest({ prompt: "x" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("ENHANCE_EMPTY");
  });

  it("returns 502 ENHANCE_EMPTY when LLM returns whitespace-only string", async () => {
    mockChatComplete.mockResolvedValue({
      content: "   \n   ",
      model: "m",
      fallbackUsed: false,
    });
    const res = await POST(buildRequest({ prompt: "x" }));
    expect(res.status).toBe(502);
  });

  it("returns 502 ENHANCE_LLM_FAILED on generic LLM error", async () => {
    mockChatComplete.mockRejectedValue(new Error("upstream LLM 500"));
    const res = await POST(buildRequest({ prompt: "x" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("ENHANCE_LLM_FAILED");
  });

  it("returns 499 (no body) on LlmCancelledError (user aborted)", async () => {
    const { LlmCancelledError } = await import("@/lib/llm");
    mockChatComplete.mockRejectedValue(new LlmCancelledError("user cancelled"));
    const res = await POST(buildRequest({ prompt: "x" }));
    expect(res.status).toBe(499);
    // 499 returns no body — verify the response is empty/null.
    const text = await res.text();
    expect(text).toBe("");
  });
});

describe("POST /api/strategy/enhance — security / adversarial", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("does not echo malicious prompt back unchanged (LLM rewrites it)", async () => {
    // The contract: enhance produces a REWRITE, not a passthrough. Even if
    // the input contains <script>, output is whatever the LLM produces.
    mockChatComplete.mockResolvedValue({
      content: "safe rewrite",
      model: "m",
      fallbackUsed: false,
    });
    const res = await POST(
      buildRequest({ prompt: '<script>alert("xss")</script>' }),
    );
    const body = await res.json();
    expect(body.data.enhanced).toBe("safe rewrite");
  });

  it("rejects oversized payload before invoking LLM (no token burn)", async () => {
    const huge = "x".repeat(10_000);
    await POST(buildRequest({ prompt: huge }));
    expect(mockChatComplete).not.toHaveBeenCalled();
  });

  it("passes the request.signal through to chatComplete for cancellation", async () => {
    mockChatComplete.mockResolvedValue({
      content: "ok",
      model: "m",
      fallbackUsed: false,
    });
    await POST(buildRequest({ prompt: "x" }));
    expect(mockChatComplete).toHaveBeenCalledWith(
      "routine",
      expect.any(Array),
      expect.objectContaining({
        signal: expect.anything(),
        caller: "strategy.enhance",
        maxTokens: 400,
      }),
    );
  });
});
