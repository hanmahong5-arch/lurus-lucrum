/**
 * Password Reset Token Utilities
 * 密码重置令牌工具
 *
 * Handles generation, storage, and validation of password reset tokens.
 * 处理密码重置令牌的生成、存储和验证
 */

import { randomBytes, createHash } from "crypto";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface ResetToken {
  token: string; // Hashed token for storage / 存储用的哈希令牌
  email: string; // User email / 用户邮箱
  expiresAt: number; // Expiration timestamp / 过期时间戳
  createdAt: number; // Creation timestamp / 创建时间戳
  used: boolean; // Whether token has been used / 令牌是否已使用
}

export interface ResetTokenResult {
  success: boolean;
  message: string;
  messageEn: string;
  token?: string; // Raw token (only returned on creation) / 原始令牌（仅在创建时返回）
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

// Token expiration time (1 hour)
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

// Token length in bytes (32 bytes = 64 hex chars)
const TOKEN_LENGTH = 32;

// Maximum tokens per email (rate limiting)
const MAX_TOKENS_PER_EMAIL = 3;

// Minimum time between token requests (5 minutes)
const MIN_REQUEST_INTERVAL_MS = 5 * 60 * 1000;

// =============================================================================
// IN-MEMORY STORAGE (Replace with database in production)
// 内存存储（生产环境应替换为数据库）
// =============================================================================

const tokenStore = new Map<string, ResetToken>();
const emailRequestTimes = new Map<string, number[]>();

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Hash a token for secure storage
 * 对令牌进行哈希以安全存储
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a random token
 * 生成随机令牌
 */
function generateRandomToken(): string {
  return randomBytes(TOKEN_LENGTH).toString("hex");
}

/**
 * Check rate limiting for email
 * 检查邮箱的请求频率限制
 */
function checkRateLimit(email: string): {
  allowed: boolean;
  message: string;
  messageEn: string;
} {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const requests = emailRequestTimes.get(normalizedEmail) || [];

  // Filter out old requests (older than 1 hour)
  const recentRequests = requests.filter((t) => now - t < TOKEN_EXPIRY_MS);

  // Check max tokens
  if (recentRequests.length >= MAX_TOKENS_PER_EMAIL) {
    return {
      allowed: false,
      message: "请求过于频繁，请稍后再试",
      messageEn: "Too many requests, please try again later",
    };
  }

  // Check minimum interval
  const lastRequest = recentRequests[recentRequests.length - 1];
  if (lastRequest && now - lastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitMinutes = Math.ceil(
      (MIN_REQUEST_INTERVAL_MS - (now - lastRequest)) / 60000,
    );
    return {
      allowed: false,
      message: `请等待 ${waitMinutes} 分钟后再试`,
      messageEn: `Please wait ${waitMinutes} minutes before trying again`,
    };
  }

  return { allowed: true, message: "", messageEn: "" };
}

/**
 * Record a token request for rate limiting
 * 记录令牌请求用于频率限制
 */
function recordRequest(email: string): void {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const requests = emailRequestTimes.get(normalizedEmail) || [];

  // Filter and add new request
  const recentRequests = requests.filter((t) => now - t < TOKEN_EXPIRY_MS);
  recentRequests.push(now);

  emailRequestTimes.set(normalizedEmail, recentRequests);
}

/**
 * Clean up expired tokens
 * 清理过期令牌
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  const entries = Array.from(tokenStore.entries());
  for (const entry of entries) {
    const [hash, token] = entry;
    if (token.expiresAt < now || token.used) {
      tokenStore.delete(hash);
    }
  }
}

// =============================================================================
// PUBLIC API / 公共 API
// =============================================================================

/**
 * Create a password reset token
 * 创建密码重置令牌
 *
 * @param email - User email address
 * @returns Result with token if successful
 */
export function createResetToken(email: string): ResetTokenResult {
  const normalizedEmail = email.toLowerCase();

  // Check rate limiting
  const rateCheck = checkRateLimit(normalizedEmail);
  if (!rateCheck.allowed) {
    return {
      success: false,
      message: rateCheck.message,
      messageEn: rateCheck.messageEn,
    };
  }

  // Clean up old tokens
  cleanupExpiredTokens();

  // Generate new token
  const rawToken = generateRandomToken();
  const hashedToken = hashToken(rawToken);
  const now = Date.now();

  // Store token
  const resetToken: ResetToken = {
    token: hashedToken,
    email: normalizedEmail,
    expiresAt: now + TOKEN_EXPIRY_MS,
    createdAt: now,
    used: false,
  };

  tokenStore.set(hashedToken, resetToken);
  recordRequest(normalizedEmail);

  return {
    success: true,
    message: "重置链接已发送到您的邮箱",
    messageEn: "Reset link has been sent to your email",
    token: rawToken, // Return raw token for email
  };
}

/**
 * Validate a password reset token
 * 验证密码重置令牌
 *
 * @param token - Raw token from user
 * @returns Result with email if valid
 */
export function validateResetToken(token: string): {
  valid: boolean;
  email?: string;
  message: string;
  messageEn: string;
} {
  const hashedToken = hashToken(token);
  const resetToken = tokenStore.get(hashedToken);

  if (!resetToken) {
    return {
      valid: false,
      message: "无效的重置链接",
      messageEn: "Invalid reset link",
    };
  }

  if (resetToken.used) {
    return {
      valid: false,
      message: "该链接已被使用",
      messageEn: "This link has already been used",
    };
  }

  if (Date.now() > resetToken.expiresAt) {
    tokenStore.delete(hashedToken);
    return {
      valid: false,
      message: "重置链接已过期，请重新申请",
      messageEn: "Reset link has expired, please request a new one",
    };
  }

  return {
    valid: true,
    email: resetToken.email,
    message: "令牌有效",
    messageEn: "Token is valid",
  };
}

/**
 * Consume (mark as used) a password reset token
 * 使用（标记为已使用）密码重置令牌
 *
 * @param token - Raw token from user
 * @returns Success status
 */
export function consumeResetToken(token: string): boolean {
  const hashedToken = hashToken(token);
  const resetToken = tokenStore.get(hashedToken);

  if (!resetToken || resetToken.used || Date.now() > resetToken.expiresAt) {
    return false;
  }

  resetToken.used = true;
  return true;
}

/**
 * Get token statistics (for debugging/monitoring)
 * 获取令牌统计信息（用于调试/监控）
 */
export function getTokenStats(): {
  activeTokens: number;
  totalEmails: number;
} {
  cleanupExpiredTokens();

  const activeTokens = Array.from(tokenStore.values()).filter(
    (t) => !t.used && Date.now() < t.expiresAt,
  ).length;

  return {
    activeTokens,
    totalEmails: emailRequestTimes.size,
  };
}
