/**
 * Agent Protocol - Runs API
 * Agent Protocol - 运行 API
 *
 * Handles stateless single-execution runs of the advisor graph.
 * POST /api/agent-protocol/runs - Create and execute a run
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdvisorGraph } from "@/lib/agent/graphs/advisor-graph";
import { createDefaultAdvisorState } from "@/lib/agent/graphs/types";
import type { RunStatus, RunResult, ChatMode } from "@/lib/agent/graphs/types";

// ============================================================================
// Request Validation Schemas
// ============================================================================

const RunRequestSchema = z.object({
  // Input for the advisor
  question: z.string().min(1, "Question is required"),
  symbol: z.string().optional(),
  mode: z.enum(["quick", "deep", "debate", "diagnose"]).default("quick"),

  // User context (optional)
  userContext: z.object({
    corePhilosophy: z.enum(["value", "growth", "trend", "quantitative", "index", "dividend", "momentum"]).optional(),
    analysisMethods: z.array(z.enum(["fundamental", "technical", "macro", "behavioral", "factor"])).optional(),
    tradingStyle: z.string().optional(),
    specialtyStrategies: z.array(z.string()).optional(),
    riskProfile: z.object({
      tolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
      investmentHorizon: z.enum(["short", "medium", "long"]).optional(),
      capitalSize: z.enum(["small", "medium", "large"]).optional(),
    }).optional(),
    masterAgent: z.string().optional(),
  }).optional(),

  // Market data (optional)
  marketData: z.object({
    symbol: z.string(),
    name: z.string(),
    price: z.number(),
    change: z.number(),
    changePercent: z.number(),
    volume: z.number(),
    turnover: z.number(),
    high: z.number(),
    low: z.number(),
    open: z.number(),
    prevClose: z.number(),
    pe: z.number().optional(),
    pb: z.number().optional(),
    marketCap: z.number().optional(),
    timestamp: z.string().or(z.date()),
  }).optional(),

  // Debate-specific
  maxDebateRounds: z.number().min(1).max(5).default(2),
});

type RunRequest = z.infer<typeof RunRequestSchema>;

// ============================================================================
// In-Memory Run Storage (for demo - use Redis/DB in production)
// ============================================================================

interface StoredRun extends RunResult {
  input: RunRequest;
  output?: unknown;
}

const runStore = new Map<string, StoredRun>();

// ============================================================================
// API Handlers
// ============================================================================

/**
 * POST /api/agent-protocol/runs
 * Create and execute a single run (wait for completion)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    // Parse and validate request
    const body = await request.json();
    const validationResult = RunRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const input = validationResult.data;
    console.log(`[Agent Protocol] Run ${runId} started - Mode: ${input.mode}, Question: ${input.question.substring(0, 50)}...`);

    // Create initial run record
    const run: StoredRun = {
      runId,
      status: "running" as RunStatus,
      createdAt: new Date(),
      input,
    };
    runStore.set(runId, run);

    // Build initial state
    const defaultState = createDefaultAdvisorState();
    const initialState = {
      ...defaultState,
      question: input.question,
      symbol: input.symbol,
      mode: input.mode as ChatMode,
      userContext: {
        ...defaultState.userContext,
        ...input.userContext,
        riskProfile: {
          ...defaultState.userContext.riskProfile,
          ...input.userContext?.riskProfile,
        },
      },
      marketData: input.marketData ? {
        ...input.marketData,
        timestamp: new Date(input.marketData.timestamp),
      } : undefined,
      isDebate: input.mode === "debate",
      maxDebateRounds: input.maxDebateRounds,
    };

    // Create and invoke the graph
    const graph = createAdvisorGraph();
    const result = await graph.invoke(initialState);

    // Update run record
    run.status = "completed";
    run.completedAt = new Date();
    run.result = {
      finalResponse: result.finalResponse,
      analyses: result.analyses,
      debateConclusion: result.debateConclusion,
      errors: result.errors,
    };
    run.output = result;
    runStore.set(runId, run);

    const duration = Date.now() - startTime;
    console.log(`[Agent Protocol] Run ${runId} completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      runId,
      status: "completed",
      duration,
      result: {
        finalResponse: result.finalResponse,
        analyses: result.analyses.map((a: { agentId: string; agentName: string; agentType: string; stance?: string; keyPoints: string[]; confidence?: number; timestamp: Date }) => ({
          agentId: a.agentId,
          agentName: a.agentName,
          agentType: a.agentType,
          stance: a.stance,
          keyPoints: a.keyPoints,
          confidence: a.confidence,
          timestamp: a.timestamp,
        })),
        debateConclusion: result.debateConclusion,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error(`[Agent Protocol] Run ${runId} failed:`, error);

    // Update run record with error
    const existingRun = runStore.get(runId);
    if (existingRun) {
      existingRun.status = "failed";
      existingRun.error = error instanceof Error ? error.message : "Unknown error";
      existingRun.completedAt = new Date();
      runStore.set(runId, existingRun);
    }

    return NextResponse.json(
      {
        success: false,
        runId,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent-protocol/runs
 * List recent runs (for debugging/monitoring)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  // Get recent runs
  const runs = Array.from(runStore.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((run) => ({
      runId: run.runId,
      status: run.status,
      mode: run.input.mode,
      question: run.input.question.substring(0, 100),
      createdAt: run.createdAt,
      completedAt: run.completedAt,
      error: run.error,
    }));

  return NextResponse.json({
    success: true,
    runs,
    total: runStore.size,
  });
}
