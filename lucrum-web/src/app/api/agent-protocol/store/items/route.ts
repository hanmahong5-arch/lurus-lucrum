/**
 * Agent Protocol - Memory Store API
 * Agent Protocol - 记忆存储 API
 *
 * Handles long-term memory storage for agents.
 * PUT /api/agent-protocol/store/items - Create/update memory item
 * GET /api/agent-protocol/store/items - Get memory items
 * POST /api/agent-protocol/store/items/search - Search memory items
 * DELETE /api/agent-protocol/store/items - Delete memory items
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { MemoryItem } from "@/lib/agent/graphs/types";

// ============================================================================
// Request Validation Schemas
// ============================================================================

const PutItemSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.unknown(),
  namespace: z.string().default("default"),
  metadata: z.record(z.unknown()).optional(),
});

const GetItemsSchema = z.object({
  keys: z.array(z.string()).optional(),
  namespace: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const SearchItemsSchema = z.object({
  query: z.string().min(1, "Query is required"),
  namespace: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

const DeleteItemsSchema = z.object({
  keys: z.array(z.string()).min(1, "At least one key is required"),
  namespace: z.string().optional(),
});

// ============================================================================
// In-Memory Store (for demo - use Redis/DB in production)
// ============================================================================

interface StoredMemoryItem extends MemoryItem {
  searchText?: string;
}

const memoryStore = new Map<string, StoredMemoryItem>();

/**
 * Generate composite key for storage
 * 生成复合存储键
 */
function getCompositeKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

/**
 * Extract searchable text from value
 * 从值中提取可搜索文本
 */
function extractSearchText(value: unknown): string {
  if (typeof value === "string") {
    return value.toLowerCase();
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value).toLowerCase();
  }
  return String(value).toLowerCase();
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * PUT /api/agent-protocol/store/items
 * Create or update a memory item
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = PutItemSchema.safeParse(body);

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
    const compositeKey = getCompositeKey(input.namespace, input.key);
    const now = new Date();

    // Check if item exists (for update)
    const existingItem = memoryStore.get(compositeKey);

    const item: StoredMemoryItem = {
      key: input.key,
      value: input.value,
      namespace: input.namespace,
      createdAt: existingItem?.createdAt || now,
      updatedAt: now,
      metadata: input.metadata,
      searchText: extractSearchText(input.value),
    };

    memoryStore.set(compositeKey, item);
    console.log(`[Agent Protocol Store] Item ${compositeKey} ${existingItem ? "updated" : "created"}`);

    return NextResponse.json({
      success: true,
      key: input.key,
      namespace: input.namespace,
      operation: existingItem ? "updated" : "created",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (error) {
    console.error("[Agent Protocol Store] Put failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent-protocol/store/items
 * Get memory items by keys or namespace
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const keysParam = searchParams.get("keys");
    const namespace = searchParams.get("namespace") || "default";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let items: StoredMemoryItem[] = [];

    if (keysParam) {
      // Get specific keys
      const keys = keysParam.split(",");
      for (const key of keys) {
        const compositeKey = getCompositeKey(namespace, key);
        const item = memoryStore.get(compositeKey);
        if (item) {
          items.push(item);
        }
      }
    } else {
      // Get all items in namespace
      const entries = Array.from(memoryStore.entries());
      for (const [compositeKey, item] of entries) {
        if (compositeKey.startsWith(`${namespace}:`)) {
          items.push(item);
        }
      }
    }

    // Sort by updatedAt (newest first) and paginate
    items = items
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      items: items.map((item) => ({
        key: item.key,
        value: item.value,
        namespace: item.namespace,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        metadata: item.metadata,
      })),
      total: items.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Agent Protocol Store] Get failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent-protocol/store/items
 * Search memory items (uses POST for complex query body)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = SearchItemsSchema.safeParse(body);

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
    const queryLower = input.query.toLowerCase();

    // Search items
    const results: StoredMemoryItem[] = [];
    const entries = Array.from(memoryStore.entries());
    for (const [compositeKey, item] of entries) {
      // Filter by namespace if specified
      if (input.namespace && !compositeKey.startsWith(`${input.namespace}:`)) {
        continue;
      }

      // Search in key and value text
      if (
        item.key.toLowerCase().includes(queryLower) ||
        (item.searchText && item.searchText.includes(queryLower))
      ) {
        results.push(item);
      }
    }

    // Sort by relevance (key matches first) and limit
    const sortedResults = results
      .sort((a, b) => {
        const aKeyMatch = a.key.toLowerCase().includes(queryLower) ? 1 : 0;
        const bKeyMatch = b.key.toLowerCase().includes(queryLower) ? 1 : 0;
        if (aKeyMatch !== bKeyMatch) return bKeyMatch - aKeyMatch;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, input.limit);

    return NextResponse.json({
      success: true,
      query: input.query,
      results: sortedResults.map((item) => ({
        key: item.key,
        value: item.value,
        namespace: item.namespace,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        metadata: item.metadata,
      })),
      total: sortedResults.length,
    });
  } catch (error) {
    console.error("[Agent Protocol Store] Search failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agent-protocol/store/items
 * Delete memory items
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = DeleteItemsSchema.safeParse(body);

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
    const namespace = input.namespace || "default";
    const deleted: string[] = [];

    for (const key of input.keys) {
      const compositeKey = getCompositeKey(namespace, key);
      if (memoryStore.has(compositeKey)) {
        memoryStore.delete(compositeKey);
        deleted.push(key);
      }
    }

    console.log(`[Agent Protocol Store] Deleted ${deleted.length} items`);

    return NextResponse.json({
      success: true,
      deleted,
      count: deleted.length,
    });
  } catch (error) {
    console.error("[Agent Protocol Store] Delete failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
