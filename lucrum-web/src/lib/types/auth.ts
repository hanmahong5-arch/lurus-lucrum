/**
 * Authentication Types with Branded Types and Zod Runtime Validation
 *
 * Design Philosophy (Bloomberg + Two Sigma):
 * - Branded types prevent accidental type confusion at compile time
 * - Zod schemas provide runtime validation at system boundaries
 * - Immutable data structures ensure predictable state
 *
 * @module lib/types/auth
 */

import { z } from 'zod';

// =============================================================================
// BRANDED TYPES - Compile-time type safety (Two Sigma pattern)
// =============================================================================

/**
 * Brand symbol for nominal typing
 * Prevents accidental interchange of structurally similar types
 */
declare const __brand: unique symbol;

/**
 * Generic brand type utility
 * Creates nominal types from structural types
 */
type Brand<T, B> = T & { readonly [__brand]: B };

/** Unique user identifier - prevents mixing with other UUIDs */
export type UserId = Brand<string, 'UserId'>;

/** Unique session identifier */
export type SessionId = Brand<string, 'SessionId'>;

/** Validated email address */
export type Email = Brand<string, 'Email'>;

/** Subscription plan identifier */
export type PlanId = 'free' | 'standard' | 'premium';

// =============================================================================
// ZOD SCHEMAS - Runtime validation at system boundaries
// =============================================================================

/**
 * Email validation schema
 * - Validates format
 * - Normalizes to lowercase
 * - Transforms to branded type
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255, 'Email too long')
  .transform((v) => v.toLowerCase() as Email);

/**
 * UUID validation schema for user IDs
 */
export const userIdSchema = z
  .string()
  .uuid('Invalid user ID format')
  .transform((v) => v as UserId);

/**
 * Session ID validation schema
 */
export const sessionIdSchema = z
  .string()
  .uuid('Invalid session ID format')
  .transform((v) => v as SessionId);

/**
 * Password validation schema
 * Enforces security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

/**
 * Plan ID validation schema
 */
export const planIdSchema = z.enum(['free', 'standard', 'premium']);

// =============================================================================
// USER PROFILE SCHEMA
// =============================================================================

/**
 * User profile schema - mutable user preferences
 */
export const userProfileSchema = z.object({
  displayName: z.string().min(1).max(100).nullable(),
  avatarUrl: z.string().url().nullable(),
  timezone: z.string().default('Asia/Shanghai'),
  locale: z.enum(['zh-CN', 'en-US']).default('zh-CN'),
  preferences: z.record(z.unknown()).default({}),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

// =============================================================================
// SUBSCRIPTION SCHEMA
// =============================================================================

/**
 * Subscription quotas schema
 */
export const subscriptionQuotasSchema = z.object({
  dailyConversations: z.number().int().nonnegative(),
  dailyConversationsUsed: z.number().int().nonnegative(),
  dailyAnalysis: z.number().int().nonnegative(),
  dailyAnalysisUsed: z.number().int().nonnegative(),
  emailNotifications: z.boolean(),
  advancedFeatures: z.boolean(),
});

export type SubscriptionQuotas = z.infer<typeof subscriptionQuotasSchema>;

/**
 * Subscription status enum
 */
export const subscriptionStatusSchema = z.enum([
  'active',
  'cancelled',
  'expired',
  'trial',
]);

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

/**
 * User subscription schema
 */
export const userSubscriptionSchema = z.object({
  plan: planIdSchema,
  status: subscriptionStatusSchema,
  startedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  quotas: subscriptionQuotasSchema,
});

export type UserSubscription = z.infer<typeof userSubscriptionSchema>;

// =============================================================================
// USER METADATA SCHEMA
// =============================================================================

/**
 * User metadata schema - audit and tracking fields
 */
export const userMetadataSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastLoginAt: z.coerce.date().nullable(),
  lastLoginIp: z.string().ip().nullable(),
  loginCount: z.number().int().nonnegative(),
  failedLoginCount: z.number().int().nonnegative(),
  lockedUntil: z.coerce.date().nullable(),
});

export type UserMetadata = z.infer<typeof userMetadataSchema>;

// =============================================================================
// COMPLETE USER SCHEMA
// =============================================================================

/**
 * Complete user entity schema
 * Combines all user-related data with strict typing
 */
export const userSchema = z.object({
  id: userIdSchema,
  email: emailSchema,
  emailVerified: z.boolean(),
  profile: userProfileSchema,
  subscription: userSubscriptionSchema,
  metadata: userMetadataSchema,
});

export type User = z.infer<typeof userSchema>;

// =============================================================================
// SESSION SCHEMA
// =============================================================================

/**
 * Device information schema
 */
export const deviceInfoSchema = z.object({
  userAgent: z.string().max(512),
  platform: z.string().max(50).optional(),
  browser: z.string().max(50).optional(),
  os: z.string().max(50).optional(),
  deviceType: z.enum(['desktop', 'mobile', 'tablet', 'unknown']).default('unknown'),
});

export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

/**
 * User session schema
 */
export const sessionSchema = z.object({
  id: sessionIdSchema,
  userId: userIdSchema,
  deviceInfo: deviceInfoSchema.nullable(),
  ipAddress: z.string().ip().nullable(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  lastActiveAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullable(),
});

export type Session = z.infer<typeof sessionSchema>;

// =============================================================================
// AUTHENTICATION REQUEST SCHEMAS
// =============================================================================

/**
 * Login request schema
 */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * Registration request schema
 */
export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  displayName: z.string().min(1).max(100).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms of service' }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

/**
 * Password reset confirmation schema
 */
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

// =============================================================================
// SUBSCRIPTION PLANS CONFIGURATION
// =============================================================================

/**
 * Subscription plan definition
 * Immutable configuration for each tier
 */
export interface SubscriptionPlanConfig {
  readonly id: PlanId;
  readonly name: string;
  readonly nameEn: string;
  readonly description: string;
  readonly descriptionEn: string;
  readonly price: {
    readonly monthly: number;
    readonly yearly: number;
  };
  readonly quotas: {
    readonly dailyConversations: number;
    readonly dailyAnalysis: number;
    readonly emailNotifications: boolean;
    readonly advancedFeatures: boolean;
  };
  readonly features: readonly string[];
  readonly featuresEn: readonly string[];
}

/**
 * Subscription plans configuration
 * Immutable definition of all available plans
 */
export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlanConfig> = {
  free: {
    id: 'free',
    name: '顾婶',
    nameEn: 'Lucrum Aunt',
    description: '投资小白的贴心助手',
    descriptionEn: 'Your friendly investment assistant',
    price: { monthly: 0, yearly: 0 },
    quotas: {
      dailyConversations: 3,
      dailyAnalysis: 0,
      emailNotifications: false,
      advancedFeatures: false,
    },
    features: [
      '基础市场资讯',
      '术语解释',
      '入门投资教育',
      '每日3次对话',
    ],
    featuresEn: [
      'Basic market information',
      'Term explanations',
      'Investment education',
      '3 conversations per day',
    ],
  },
  standard: {
    id: 'standard',
    name: '估神',
    nameEn: 'Lucrum Master',
    description: '把握大势的方向指南',
    descriptionEn: 'Your directional guide for market trends',
    price: { monthly: 99, yearly: 999 },
    quotas: {
      dailyConversations: 50,
      dailyAnalysis: 10,
      emailNotifications: false,
      advancedFeatures: true,
    },
    features: [
      '行业轮动分析',
      '宏观政策解读',
      '三道六术框架分析',
      '投资组合建议',
      '风险评估报告',
      '每日50次对话',
    ],
    featuresEn: [
      'Industry rotation analysis',
      'Macro policy interpretation',
      'Three-Ways-Six-Methods framework',
      'Portfolio suggestions',
      'Risk assessment reports',
      '50 conversations per day',
    ],
  },
  premium: {
    id: 'premium',
    name: '股神',
    nameEn: 'Lucrum God',
    description: '精准选股的私人顾问',
    descriptionEn: 'Your personal advisor for precise stock selection',
    price: { monthly: 999, yearly: 9999 },
    quotas: {
      dailyConversations: Infinity,
      dailyAnalysis: Infinity,
      emailNotifications: true,
      advancedFeatures: true,
    },
    features: [
      '包含估神所有功能',
      '个股深度分析',
      'AI选股推荐',
      '每日邮件推送',
      '实时信号通知',
      '私人投顾1对1',
      '无限对话',
    ],
    featuresEn: [
      'All Lucrum Master features',
      'Deep stock analysis',
      'AI stock recommendations',
      'Daily email notifications',
      'Real-time signal alerts',
      'Personal 1-on-1 advisor',
      'Unlimited conversations',
    ],
  },
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if user has sufficient quota for an action
 */
export function hasQuota(
  subscription: UserSubscription,
  quotaType: 'conversations' | 'analysis'
): boolean {
  const { quotas } = subscription;

  if (quotaType === 'conversations') {
    return quotas.dailyConversationsUsed < quotas.dailyConversations;
  }

  return quotas.dailyAnalysisUsed < quotas.dailyAnalysis;
}

/**
 * Get remaining quota for a specific type
 */
export function getRemainingQuota(
  subscription: UserSubscription,
  quotaType: 'conversations' | 'analysis'
): number {
  const { quotas } = subscription;

  if (quotaType === 'conversations') {
    return Math.max(0, quotas.dailyConversations - quotas.dailyConversationsUsed);
  }

  return Math.max(0, quotas.dailyAnalysis - quotas.dailyAnalysisUsed);
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(subscription: UserSubscription): boolean {
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false;
  }

  if (subscription.expiresAt && subscription.expiresAt < new Date()) {
    return false;
  }

  return true;
}

/**
 * Get plan configuration for a given plan ID
 */
export function getPlanConfig(planId: PlanId): SubscriptionPlanConfig {
  return SUBSCRIPTION_PLANS[planId];
}

/**
 * Create a default free user subscription
 */
export function createDefaultSubscription(): UserSubscription {
  const now = new Date();
  const plan = SUBSCRIPTION_PLANS.free;

  return {
    plan: 'free',
    status: 'active',
    startedAt: now,
    expiresAt: null,
    cancelledAt: null,
    quotas: {
      dailyConversations: plan.quotas.dailyConversations,
      dailyConversationsUsed: 0,
      dailyAnalysis: plan.quotas.dailyAnalysis,
      dailyAnalysisUsed: 0,
      emailNotifications: plan.quotas.emailNotifications,
      advancedFeatures: plan.quotas.advancedFeatures,
    },
  };
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for checking if a value is a valid PlanId
 */
export function isPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'standard' || value === 'premium';
}

/**
 * Type guard for checking if a value is a valid SubscriptionStatus
 */
export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    value === 'active' ||
    value === 'cancelled' ||
    value === 'expired' ||
    value === 'trial'
  );
}
