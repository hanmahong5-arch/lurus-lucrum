/**
 * User Authentication Middleware
 * 用户认证中间件
 *
 * Provides authentication wrapper for API routes that require user context.
 * 为需要用户上下文的 API 路由提供认证包装器。
 *
 * Features:
 * - Session validation from NextAuth.js
 * - User ID and role extraction
 * - Consistent error responses
 * - Type-safe user context
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { verifyZitadelJWT } from "./jwt-verify";
import { getEntitlementTier, type EntitlementTier } from "@/lib/platform/entitlements";

// ============================================================================
// Types
// ============================================================================

/**
 * User context passed to authenticated handlers
 * 传递给已认证处理器的用户上下文
 */
export interface UserContext {
  /** User's unique ID / 用户唯一ID */
  userId: string;
  /** User's email / 用户邮箱 */
  email: string;
  /** User's display name / 用户显示名称 */
  name: string | null;
  /** User's subscription tier / 用户订阅层级 */
  role: "free" | "standard" | "premium";
}

/**
 * Authenticated request handler type
 * 已认证的请求处理器类型
 */
export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  user: UserContext
) => Promise<NextResponse<T>>;

/**
 * Error response type for authentication failures
 * 认证失败的错误响应类型
 */
interface AuthErrorResponse {
  error: string;
  message: string;
  code: string;
}

// ============================================================================
// JWT Fallback Helper
// ============================================================================

/**
 * Try to extract UserContext from Bearer JWT when NextAuth session is absent.
 * This enables mobile apps (lucrum-app) that authenticate via Zitadel OIDC
 * to call lucrum-web API routes directly.
 */
async function getUserFromBearerJWT(request: NextRequest): Promise<UserContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const claims = await verifyZitadelJWT(token);
  if (!claims?.sub) return null;

  // Resolve real tier from platform entitlements (cached, fail-open to 'free')
  const tier = await getEntitlementTier(claims.sub);

  return {
    userId: claims.sub,
    email: claims.email ?? "",
    name: claims.name ?? claims.preferred_username ?? null,
    role: tier,
  };
}

// ============================================================================
// Middleware Implementation
// ============================================================================

/**
 * Wraps an API route handler with authentication
 * 使用认证包装 API 路由处理器
 *
 * @param handler - The handler function to wrap / 要包装的处理器函数
 * @returns A wrapped handler that validates authentication / 返回验证认证的包装处理器
 *
 * @example
 * ```typescript
 * // In an API route
 * export async function POST(request: NextRequest) {
 *   return withUser(request, async (req, user) => {
 *     // user.userId, user.email, user.role are available
 *     const data = await req.json();
 *
 *     // Save to database with user isolation
 *     await db.insert(userStrategies).values({
 *       userId: user.userId,
 *       ...data,
 *     });
 *
 *     return NextResponse.json({ success: true });
 *   });
 * }
 * ```
 */
export async function withUser<T>(
  request: NextRequest,
  handler: AuthenticatedHandler<T>
): Promise<NextResponse<T | AuthErrorResponse>> {
  try {
    // Get session from NextAuth.js
    // 从 NextAuth.js 获取会话
    const session = await getServerSession(authOptions);

    let userContext: UserContext | null = null;

    if (session?.user?.id) {
      // Resolve real tier from platform entitlements (cached, fail-open to session role)
      const sessionRole = session.user.role || "free";
      let resolvedRole: EntitlementTier = sessionRole as EntitlementTier;
      try {
        resolvedRole = await getEntitlementTier(session.user.id);
      } catch {
        // Fail-open: use session role
      }

      userContext = {
        userId: session.user.id,
        email: session.user.email || "",
        name: session.user.name || null,
        role: resolvedRole,
      };
    } else {
      // Fallback: try Zitadel JWT from Authorization header (mobile app)
      userContext = await getUserFromBearerJWT(request);
    }

    if (!userContext?.userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "请先登录 / Please log in first",
          code: "AUTH_NO_SESSION",
        },
        { status: 401 }
      ) as NextResponse<AuthErrorResponse>;
    }

    // Call the actual handler with user context
    // 使用用户上下文调用实际处理器
    return await handler(request, userContext);
  } catch (error) {
    console.error("[withUser] Authentication error:", error);

    // Handle specific NextAuth errors
    // 处理特定的 NextAuth 错误
    if (error instanceof Error) {
      if (error.message.includes("JWT")) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            message: "会话已过期，请重新登录 / Session expired, please log in again",
            code: "AUTH_JWT_EXPIRED",
          },
          { status: 401 }
        ) as NextResponse<AuthErrorResponse>;
      }
    }

    // Generic authentication error
    // 通用认证错误
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "认证失败 / Authentication failed",
        code: "AUTH_ERROR",
      },
      { status: 401 }
    ) as NextResponse<AuthErrorResponse>;
  }
}

// ============================================================================
// Role-Based Access Control Helpers
// 基于角色的访问控制辅助函数
// ============================================================================

/**
 * Check if user has required role level
 * 检查用户是否具有所需的角色级别
 *
 * @param userRole - User's current role / 用户当前角色
 * @param requiredRole - Minimum required role / 最低要求角色
 * @returns boolean indicating access / 表示访问权限的布尔值
 */
export function hasRequiredRole(
  userRole: "free" | "standard" | "premium",
  requiredRole: "free" | "standard" | "premium"
): boolean {
  const roleHierarchy = { free: 0, standard: 1, premium: 2 };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Wraps an API route handler with authentication AND role validation
 * 使用认证和角色验证包装 API 路由处理器
 *
 * @param requiredRole - Minimum role required / 最低要求的角色
 * @param handler - The handler function to wrap / 要包装的处理器函数
 * @returns A wrapped handler that validates authentication and role / 返回验证认证和角色的包装处理器
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   return withRole("premium", request, async (req, user) => {
 *     // Only premium users can access this endpoint
 *     return NextResponse.json({ success: true });
 *   });
 * }
 * ```
 */
export async function withRole<T>(
  requiredRole: "free" | "standard" | "premium",
  request: NextRequest,
  handler: AuthenticatedHandler<T>
): Promise<NextResponse<T | AuthErrorResponse>> {
  // Authenticate the user (session or JWT fallback)
  const session = await getServerSession(authOptions);

  let userContext: UserContext | null = null;

  if (session?.user?.id) {
    userContext = {
      userId: session.user.id,
      email: session.user.email || "",
      name: session.user.name || null,
      role: session.user.role || "free",
    };
  } else {
    userContext = await getUserFromBearerJWT(request);
  }

  if (!userContext?.userId) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "请先登录 / Please log in first",
        code: "AUTH_NO_SESSION",
      },
      { status: 401 }
    ) as NextResponse<AuthErrorResponse>;
  }

  // Check role level
  // 检查角色级别
  if (!hasRequiredRole(userContext.role, requiredRole)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `此功能需要 ${requiredRole} 或更高级别会员 / This feature requires ${requiredRole} or higher subscription`,
        code: "AUTH_INSUFFICIENT_ROLE",
      },
      { status: 403 }
    ) as NextResponse<AuthErrorResponse>;
  }

  return await handler(request, userContext);
}

// ============================================================================
// Optional Authentication
// 可选认证
// ============================================================================

/**
 * Wraps an API route handler with optional authentication
 * 使用可选认证包装 API 路由处理器
 *
 * Handler receives user context if authenticated, null otherwise.
 * 如果已认证，处理器接收用户上下文，否则接收 null。
 *
 * @param handler - The handler function to wrap / 要包装的处理器函数
 * @returns A wrapped handler / 返回包装的处理器
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return withOptionalUser(request, async (req, user) => {
 *     if (user) {
 *       // Personalized response for logged-in users
 *       return NextResponse.json({ greeting: `Hello, ${user.name}!` });
 *     } else {
 *       // Generic response for anonymous users
 *       return NextResponse.json({ greeting: "Hello, visitor!" });
 *     }
 *   });
 * }
 * ```
 */
export async function withOptionalUser<T>(
  request: NextRequest,
  handler: (
    request: NextRequest,
    user: UserContext | null
  ) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  try {
    const session = await getServerSession(authOptions);

    let userContext: UserContext | null = null;

    if (session?.user?.id) {
      userContext = {
        userId: session.user.id,
        email: session.user.email || "",
        name: session.user.name || null,
        role: session.user.role || "free",
      };
    } else {
      // Fallback: try Zitadel JWT from Authorization header (mobile app)
      userContext = await getUserFromBearerJWT(request);
    }

    return await handler(request, userContext);
  } catch (error) {
    console.error("[withOptionalUser] Error checking authentication:", error);
    // On error, proceed without user context
    // 出错时，不使用用户上下文继续
    return await handler(request, null);
  }
}

// ============================================================================
// Client-Side Helpers (for use in components)
// 客户端辅助函数（用于组件）
// ============================================================================

/**
 * Generate a user-scoped storage key for localStorage/sessionStorage
 * 为 localStorage/sessionStorage 生成用户范围的存储键
 *
 * @param baseKey - The base storage key / 基础存储键
 * @param userId - The user's ID / 用户 ID
 * @returns A user-scoped key / 用户范围的键
 *
 * @example
 * ```typescript
 * const key = getUserScopedKey("strategy-workspace", userId);
 * // Returns: "lucrum:user123:strategy-workspace"
 * ```
 */
export function getUserScopedKey(baseKey: string, userId: string): string {
  return `lucrum:${userId}:${baseKey}`;
}

/**
 * Parse a user-scoped storage key to extract the base key and user ID
 * 解析用户范围的存储键以提取基础键和用户 ID
 *
 * @param scopedKey - The user-scoped key / 用户范围的键
 * @returns Object with baseKey and userId, or null if invalid / 包含 baseKey 和 userId 的对象，如果无效则返回 null
 */
export function parseUserScopedKey(
  scopedKey: string
): { baseKey: string; userId: string } | null {
  const match = scopedKey.match(/^lucrum:([^:]+):(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { userId: match[1], baseKey: match[2] };
}
