/**
 * Tenant Role-Based Access Control Middleware
 * 租户角色访问控制中间件
 *
 * Composable middleware that wraps withUser and adds tenant-level RBAC.
 * Extracts tenantId from request body, query params, or route params,
 * then verifies the user has a qualifying role in that tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUser, type UserContext } from './with-user';
import { checkTenantAccess, type TenantRole } from '@/lib/services/history-service';

// ============================================================================
// Types
// ============================================================================

/**
 * Tenant context passed to authorized handlers
 */
export interface TenantContext {
  tenantId: number;
  role: TenantRole;
}

/**
 * Handler that receives both user and tenant context
 */
export type TenantAuthorizedHandler<T = unknown> = (
  request: NextRequest,
  user: UserContext,
  tenant: TenantContext
) => Promise<NextResponse<T>>;

interface TenantAuthErrorResponse {
  error: string;
  message: string;
  code: string;
}

// ============================================================================
// Tenant ID Extraction
// ============================================================================

/**
 * Extract tenantId from multiple sources in priority order:
 * 1. Cloned request body (for POST/PATCH/PUT)
 * 2. URL search params
 * 3. URL path segments (looks for /team/[id]/ pattern)
 */
async function extractTenantId(request: NextRequest): Promise<number | null> {
  // 1. Try URL search params first (cheapest)
  const paramId = request.nextUrl.searchParams.get('tenantId');
  if (paramId) {
    const parsed = parseInt(paramId, 10);
    if (!isNaN(parsed)) return parsed;
  }

  // 2. Try URL path segments: /api/team/[id]/...
  const pathSegments = request.nextUrl.pathname.split('/');
  const teamIdx = pathSegments.indexOf('team');
  if (teamIdx >= 0 && teamIdx + 1 < pathSegments.length) {
    const pathId = parseInt(pathSegments[teamIdx + 1]!, 10);
    if (!isNaN(pathId)) return pathId;
  }

  // 3. Try request body (only for methods that have a body)
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      if (body?.tenantId) {
        const bodyId = parseInt(String(body.tenantId), 10);
        if (!isNaN(bodyId)) return bodyId;
      }
    } catch {
      // Body parse failed — not an error, just no tenantId in body
    }
  }

  return null;
}

// ============================================================================
// Middleware Implementation
// ============================================================================

/**
 * Wraps an API route with user auth + tenant role verification.
 *
 * @param request - The incoming request
 * @param requiredRoles - Allowed tenant roles. Use ['*'] to allow any member.
 * @param handler - Handler receiving (request, user, tenant)
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withTenantRole(request, ['*'], async (req, user, tenant) => {
 *     // Any team member can access
 *     return NextResponse.json({ tenantId: tenant.tenantId });
 *   });
 * }
 *
 * export async function DELETE(request: NextRequest) {
 *   return withTenantRole(request, ['owner', 'admin'], async (req, user, tenant) => {
 *     // Only owner/admin can delete
 *     return NextResponse.json({ success: true });
 *   });
 * }
 * ```
 */
export async function withTenantRole<T>(
  request: NextRequest,
  requiredRoles: (TenantRole | '*')[],
  handler: TenantAuthorizedHandler<T>
): Promise<NextResponse<T | TenantAuthErrorResponse>> {
  return withUser<T | TenantAuthErrorResponse>(request, async (req, user) => {
    // Extract tenantId
    const tenantId = await extractTenantId(req);
    if (!tenantId) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: '缺少团队标识 / Missing tenant identifier',
          code: 'TENANT_ID_REQUIRED',
        },
        { status: 400 }
      ) as NextResponse<TenantAuthErrorResponse>;
    }

    // Check access — wildcard '*' means any role is accepted
    const roleFilter = requiredRoles.includes('*') ? undefined : requiredRoles as TenantRole[];
    const access = await checkTenantAccess(user.userId, tenantId, roleFilter);

    if (!access.hasAccess) {
      const msg = access.role
        ? '权限不足，无法执行此操作 / Insufficient permissions for this operation'
        : '您不是此团队的成员 / You are not a member of this team';
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: msg,
          code: 'TENANT_ACCESS_DENIED',
        },
        { status: 403 }
      ) as NextResponse<TenantAuthErrorResponse>;
    }

    return handler(req, user, { tenantId, role: access.role! });
  });
}
