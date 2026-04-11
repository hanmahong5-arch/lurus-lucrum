/**
 * Shared Portfolios API — CRUD for team investment portfolios
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { sharedPortfolios } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { recordActivity } from '@/lib/services/activity-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/team/[id]/portfolios
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['*'], async (_req, _user, tenant) => {
    const portfolios = await db
      .select()
      .from(sharedPortfolios)
      .where(eq(sharedPortfolios.tenantId, tenant.tenantId))
      .orderBy(desc(sharedPortfolios.updatedAt));

    return NextResponse.json({ success: true, data: portfolios });
  });
}

// POST /api/team/[id]/portfolios — create a new shared portfolio
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin', 'member'], async (req, user, tenant) => {
    const body = await req.json();
    const { name, description, strategies, symbols, config } = body as {
      name?: string;
      description?: string;
      strategies?: number[];
      symbols?: string[];
      config?: Record<string, unknown>;
    };

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const result = await db
      .insert(sharedPortfolios)
      .values({
        tenantId: tenant.tenantId,
        createdBy: user.userId,
        name: name.trim(),
        description: description?.trim() ?? null,
        strategies: strategies ?? null,
        symbols: symbols ?? null,
        config: config ?? null,
      })
      .returning();

    if (!result[0]) {
      return NextResponse.json({ success: false, error: 'Failed to create portfolio' }, { status: 500 });
    }

    recordActivity({
      tenantId: tenant.tenantId,
      userId: user.userId,
      actorName: user.name || user.email,
      actionType: 'strategy_created',
      resourceType: 'strategy',
      resourceId: String(result[0].id),
      metadata: { type: 'portfolio', name },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  });
}

// PATCH /api/team/[id]/portfolios — update portfolio
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin', 'member'], async (req, user, tenant) => {
    const body = await req.json();
    const { portfolioId, name, description, strategies, symbols, config } = body as {
      portfolioId?: number;
      name?: string;
      description?: string;
      strategies?: number[];
      symbols?: string[];
      config?: Record<string, unknown>;
    };

    if (!portfolioId) {
      return NextResponse.json({ success: false, error: 'portfolioId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() ?? null;
    if (strategies !== undefined) updates.strategies = strategies;
    if (symbols !== undefined) updates.symbols = symbols;
    if (config !== undefined) updates.config = config;

    await db
      .update(sharedPortfolios)
      .set(updates)
      .where(and(eq(sharedPortfolios.id, portfolioId), eq(sharedPortfolios.tenantId, tenant.tenantId)));

    return NextResponse.json({ success: true });
  });
}

// DELETE /api/team/[id]/portfolios?portfolioId=123
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withTenantRole<unknown>(request, ['owner', 'admin'], async (req, _user, tenant) => {
    const portfolioId = parseInt(req.nextUrl.searchParams.get('portfolioId') || '0', 10);
    if (!portfolioId) {
      return NextResponse.json({ success: false, error: 'portfolioId is required' }, { status: 400 });
    }

    await db
      .delete(sharedPortfolios)
      .where(and(eq(sharedPortfolios.id, portfolioId), eq(sharedPortfolios.tenantId, tenant.tenantId)));

    return NextResponse.json({ success: true });
  });
}

export const dynamic = 'force-dynamic';
