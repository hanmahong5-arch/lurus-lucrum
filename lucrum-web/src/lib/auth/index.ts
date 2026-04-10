/**
 * Authentication Module Exports
 * 认证模块导出
 *
 * Re-exports all authentication-related utilities from a single entry point.
 * 从单一入口点重新导出所有与认证相关的工具。
 */

// NextAuth.js configuration
// NextAuth.js 配置
export { authOptions } from "./auth";

// Authentication middleware and helpers
// 认证中间件和辅助函数
export {
  withUser,
  withRole,
  withOptionalUser,
  hasRequiredRole,
  type UserContext,
  type AuthenticatedHandler,
} from "./with-user";

// Tenant role-based access control
export {
  withTenantRole,
  type TenantContext,
  type TenantAuthorizedHandler,
} from "./with-tenant-role";

// Client-safe utilities (no server dependencies)
export { getUserScopedKey, parseUserScopedKey } from "./user-scoped-key";

// JWT verification for mobile app Bearer token fallback
export { verifyZitadelJWT, type ZitadelClaims } from "./jwt-verify";
