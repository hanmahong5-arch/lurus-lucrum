/**
 * Email Verification Utilities
 * 邮箱验证工具
 *
 * Handles generation, storage, and validation of email verification tokens.
 * 处理邮箱验证令牌的生成、存储和验证
 */

import { randomBytes, createHash } from "crypto";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

export interface VerificationToken {
  token: string; // Hashed token for storage / 存储用的哈希令牌
  email: string; // User email / 用户邮箱
  expiresAt: number; // Expiration timestamp / 过期时间戳
  createdAt: number; // Creation timestamp / 创建时间戳
  verified: boolean; // Whether email has been verified / 邮箱是否已验证
}

export interface VerificationResult {
  success: boolean;
  message: string;
  messageEn: string;
  token?: string; // Raw token (only returned on creation) / 原始令牌（仅在创建时返回）
}

// =============================================================================
// CONSTANTS / 常量
// =============================================================================

// Token expiration time (24 hours)
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Token length in bytes (32 bytes = 64 hex chars)
const TOKEN_LENGTH = 32;

// Maximum resend attempts per email (rate limiting)
const MAX_RESEND_ATTEMPTS = 5;

// Minimum time between resend requests (2 minutes)
const MIN_RESEND_INTERVAL_MS = 2 * 60 * 1000;

// =============================================================================
// IN-MEMORY STORAGE (Replace with database in production)
// 内存存储（生产环境应替换为数据库）
// =============================================================================

const verificationStore = new Map<string, VerificationToken>();
const resendAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Track verified emails
const verifiedEmails = new Set<string>();

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
 * Check rate limiting for resend
 * 检查重新发送的频率限制
 */
function checkResendLimit(email: string): {
  allowed: boolean;
  message: string;
  messageEn: string;
} {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const attempts = resendAttempts.get(normalizedEmail);

  if (!attempts) {
    return { allowed: true, message: "", messageEn: "" };
  }

  // Check max attempts
  if (attempts.count >= MAX_RESEND_ATTEMPTS) {
    return {
      allowed: false,
      message: "重发次数过多，请稍后再试",
      messageEn: "Too many resend attempts, please try again later",
    };
  }

  // Check minimum interval
  if (now - attempts.lastAttempt < MIN_RESEND_INTERVAL_MS) {
    const waitSeconds = Math.ceil(
      (MIN_RESEND_INTERVAL_MS - (now - attempts.lastAttempt)) / 1000
    );
    return {
      allowed: false,
      message: `请等待 ${waitSeconds} 秒后再试`,
      messageEn: `Please wait ${waitSeconds} seconds before trying again`,
    };
  }

  return { allowed: true, message: "", messageEn: "" };
}

/**
 * Record a resend attempt for rate limiting
 * 记录重发尝试用于频率限制
 */
function recordResendAttempt(email: string): void {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();
  const attempts = resendAttempts.get(normalizedEmail);

  if (attempts) {
    // Reset count if last attempt was more than 1 hour ago
    if (now - attempts.lastAttempt > 60 * 60 * 1000) {
      resendAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
    } else {
      resendAttempts.set(normalizedEmail, {
        count: attempts.count + 1,
        lastAttempt: now,
      });
    }
  } else {
    resendAttempts.set(normalizedEmail, { count: 1, lastAttempt: now });
  }
}

/**
 * Clean up expired tokens
 * 清理过期令牌
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  const entries = Array.from(verificationStore.entries());
  for (const entry of entries) {
    const [hash, token] = entry;
    if (token.expiresAt < now) {
      verificationStore.delete(hash);
    }
  }
}

// =============================================================================
// PUBLIC API / 公共 API
// =============================================================================

/**
 * Create an email verification token
 * 创建邮箱验证令牌
 *
 * @param email - User email address
 * @returns Result with token if successful
 */
export function createVerificationToken(email: string): VerificationResult {
  const normalizedEmail = email.toLowerCase();

  // Check if already verified
  if (verifiedEmails.has(normalizedEmail)) {
    return {
      success: false,
      message: "该邮箱已验证",
      messageEn: "This email is already verified",
    };
  }

  // Check rate limiting
  const rateCheck = checkResendLimit(normalizedEmail);
  if (!rateCheck.allowed) {
    return {
      success: false,
      message: rateCheck.message,
      messageEn: rateCheck.messageEn,
    };
  }

  // Clean up old tokens
  cleanupExpiredTokens();

  // Invalidate any existing tokens for this email
  const entries = Array.from(verificationStore.entries());
  for (const entry of entries) {
    const [hash, token] = entry;
    if (token.email === normalizedEmail) {
      verificationStore.delete(hash);
    }
  }

  // Generate new token
  const rawToken = generateRandomToken();
  const hashedToken = hashToken(rawToken);
  const now = Date.now();

  // Store token
  const verificationToken: VerificationToken = {
    token: hashedToken,
    email: normalizedEmail,
    expiresAt: now + TOKEN_EXPIRY_MS,
    createdAt: now,
    verified: false,
  };

  verificationStore.set(hashedToken, verificationToken);
  recordResendAttempt(normalizedEmail);

  return {
    success: true,
    message: "验证邮件已发送",
    messageEn: "Verification email has been sent",
    token: rawToken, // Return raw token for email
  };
}

/**
 * Verify an email with token
 * 使用令牌验证邮箱
 *
 * @param token - Raw token from user
 * @returns Verification result
 */
export function verifyEmail(token: string): {
  success: boolean;
  email?: string;
  message: string;
  messageEn: string;
} {
  const hashedToken = hashToken(token);
  const verificationToken = verificationStore.get(hashedToken);

  if (!verificationToken) {
    return {
      success: false,
      message: "无效的验证链接",
      messageEn: "Invalid verification link",
    };
  }

  if (verificationToken.verified) {
    return {
      success: false,
      message: "该邮箱已验证",
      messageEn: "This email is already verified",
    };
  }

  if (Date.now() > verificationToken.expiresAt) {
    verificationStore.delete(hashedToken);
    return {
      success: false,
      message: "验证链接已过期，请重新发送",
      messageEn: "Verification link has expired, please request a new one",
    };
  }

  // Mark as verified
  verificationToken.verified = true;
  verifiedEmails.add(verificationToken.email);

  // Clean up the token
  verificationStore.delete(hashedToken);

  return {
    success: true,
    email: verificationToken.email,
    message: "邮箱验证成功",
    messageEn: "Email verified successfully",
  };
}

/**
 * Check if an email is verified
 * 检查邮箱是否已验证
 *
 * @param email - Email to check
 * @returns Whether the email is verified
 */
export function isEmailVerified(email: string): boolean {
  return verifiedEmails.has(email.toLowerCase());
}

/**
 * Mark an email as verified (for admin/testing purposes)
 * 将邮箱标记为已验证（用于管理/测试目的）
 *
 * @param email - Email to mark as verified
 */
export function markEmailVerified(email: string): void {
  verifiedEmails.add(email.toLowerCase());
}

/**
 * Get verification statistics (for debugging/monitoring)
 * 获取验证统计信息（用于调试/监控）
 */
export function getVerificationStats(): {
  pendingVerifications: number;
  verifiedEmails: number;
} {
  cleanupExpiredTokens();

  const pendingVerifications = Array.from(verificationStore.values()).filter(
    (t) => !t.verified && Date.now() < t.expiresAt
  ).length;

  return {
    pendingVerifications,
    verifiedEmails: verifiedEmails.size,
  };
}
