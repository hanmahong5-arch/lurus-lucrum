/**
 * Password Reset API Routes
 * 密码重置 API 路由
 *
 * POST /api/auth/reset-password - Request password reset
 * PUT /api/auth/reset-password - Reset password with token
 */

import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import {
  createResetToken,
  validateResetToken,
  consumeResetToken,
} from "@/lib/auth/reset-token";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface RequestResetBody {
  email: string;
}

interface ResetPasswordBody {
  token: string;
  password: string;
}

// =============================================================================
// MOCK USER DATABASE (Replace with real database in production)
// 模拟用户数据库（生产环境应替换为真实数据库）
// =============================================================================

// In-memory user store for demo purposes
// This should be imported from a shared location or database
const USERS = new Map([
  [
    "demo@lurus.cn",
    {
      id: "1",
      email: "demo@lurus.cn",
      name: "Demo User",
      password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u",
      role: "free",
    },
  ],
  [
    "admin@lurus.cn",
    {
      id: "2",
      email: "admin@lurus.cn",
      name: "Admin User",
      password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u",
      role: "premium",
    },
  ],
]);

// =============================================================================
// HELPER FUNCTIONS / 辅助函数
// =============================================================================

/**
 * Validate email format
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * 验证密码强度
 */
function isValidPassword(password: string): {
  valid: boolean;
  message: string;
  messageEn: string;
} {
  if (password.length < 6) {
    return {
      valid: false,
      message: "密码至少需要6个字符",
      messageEn: "Password must be at least 6 characters",
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      message: "密码不能超过128个字符",
      messageEn: "Password cannot exceed 128 characters",
    };
  }

  // Optional: Add more password rules here
  // if (!/[A-Z]/.test(password)) { ... }
  // if (!/[0-9]/.test(password)) { ... }

  return {
    valid: true,
    message: "密码有效",
    messageEn: "Password is valid",
  };
}

/**
 * Send reset email (mock implementation)
 * 发送重置邮件（模拟实现）
 */
async function sendResetEmail(email: string, token: string): Promise<boolean> {
  // In production, integrate with email service (e.g., SendGrid, Resend, SES)
  // For demo, we log the reset link
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://gushen.lurus.cn"}/auth/reset-password?token=${token}`;

  console.log("=".repeat(60));
  console.log("PASSWORD RESET EMAIL (Demo Mode)");
  console.log("=".repeat(60));
  console.log(`To: ${email}`);
  console.log(`Subject: 重置您的 Lucrum 密码 / Reset Your Lucrum Password`);
  console.log(`Reset URL: ${resetUrl}`);
  console.log(`Token: ${token}`);
  console.log("=".repeat(60));

  // Simulate email sending delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return true;
}

// =============================================================================
// POST - Request Password Reset
// POST - 请求密码重置
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestResetBody;
    const { email } = body;

    // Validate email format
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "请输入有效的邮箱地址",
          messageEn: "Please enter a valid email address",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Check if user exists (for security, we don't reveal this)
    const userExists = USERS.has(normalizedEmail);

    // Create reset token (even if user doesn't exist, for security)
    const result = createResetToken(normalizedEmail);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          messageEn: result.messageEn,
        },
        { status: 429 } // Too Many Requests
      );
    }

    // Send email only if user exists
    if (userExists && result.token) {
      await sendResetEmail(normalizedEmail, result.token);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "如果该邮箱已注册，您将收到重置链接",
      messageEn: "If this email is registered, you will receive a reset link",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "请求失败，请稍后再试",
        messageEn: "Request failed, please try again later",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Reset Password with Token
// PUT - 使用令牌重置密码
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as ResetPasswordBody;
    const { token, password } = body;

    // Validate inputs
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "缺少重置令牌",
          messageEn: "Missing reset token",
        },
        { status: 400 }
      );
    }

    // Validate password
    const passwordCheck = isValidPassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          message: passwordCheck.message,
          messageEn: passwordCheck.messageEn,
        },
        { status: 400 }
      );
    }

    // Validate token
    const tokenResult = validateResetToken(token);
    if (!tokenResult.valid || !tokenResult.email) {
      return NextResponse.json(
        {
          success: false,
          message: tokenResult.message,
          messageEn: tokenResult.messageEn,
        },
        { status: 400 }
      );
    }

    // Find user
    const user = USERS.get(tokenResult.email);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "用户不存在",
          messageEn: "User not found",
        },
        { status: 404 }
      );
    }

    // Hash new password
    const hashedPassword = await hash(password, 10);

    // Update user password (in-memory for demo)
    user.password = hashedPassword;
    USERS.set(tokenResult.email, user);

    // Consume the token
    consumeResetToken(token);

    console.log(`Password reset successful for: ${tokenResult.email}`);

    return NextResponse.json({
      success: true,
      message: "密码重置成功，请使用新密码登录",
      messageEn: "Password reset successful, please login with your new password",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "重置失败，请稍后再试",
        messageEn: "Reset failed, please try again later",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Validate Token (for UI)
// GET - 验证令牌（用于 UI）
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          message: "缺少令牌参数",
          messageEn: "Missing token parameter",
        },
        { status: 400 }
      );
    }

    const result = validateResetToken(token);

    return NextResponse.json({
      valid: result.valid,
      message: result.message,
      messageEn: result.messageEn,
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      {
        valid: false,
        message: "验证失败",
        messageEn: "Validation failed",
      },
      { status: 500 }
    );
  }
}
