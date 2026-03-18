/**
 * Email Verification API Routes
 * 邮箱验证 API 路由
 *
 * POST /api/auth/verify-email - Send verification email
 * PUT /api/auth/verify-email - Verify email with token
 * GET /api/auth/verify-email - Check verification status
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createVerificationToken,
  verifyEmail,
  isEmailVerified,
} from "@/lib/auth/email-verification";

// =============================================================================
// TYPES / 类型定义
// =============================================================================

interface SendVerificationBody {
  email: string;
}

interface VerifyEmailBody {
  token: string;
}

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
 * Send verification email (mock implementation)
 * 发送验证邮件（模拟实现）
 */
async function sendVerificationEmail(
  email: string,
  token: string
): Promise<boolean> {
  // In production, integrate with email service (e.g., SendGrid, Resend, SES)
  // For demo, we log the verification link
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://gushen.lurus.cn"}/auth/verify-email?token=${token}`;

  console.log("=".repeat(60));
  console.log("EMAIL VERIFICATION (Demo Mode)");
  console.log("=".repeat(60));
  console.log(`To: ${email}`);
  console.log(`Subject: 验证您的 Lucrum 账户 / Verify Your Lucrum Account`);
  console.log(`Verify URL: ${verifyUrl}`);
  console.log(`Token: ${token}`);
  console.log("=".repeat(60));

  // Simulate email sending delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return true;
}

// =============================================================================
// POST - Send Verification Email
// POST - 发送验证邮件
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendVerificationBody;
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

    // Check if already verified
    if (isEmailVerified(normalizedEmail)) {
      return NextResponse.json({
        success: true,
        message: "该邮箱已验证",
        messageEn: "This email is already verified",
        verified: true,
      });
    }

    // Create verification token
    const result = createVerificationToken(normalizedEmail);

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

    // Send verification email
    if (result.token) {
      await sendVerificationEmail(normalizedEmail, result.token);
    }

    return NextResponse.json({
      success: true,
      message: "验证邮件已发送，请检查您的收件箱",
      messageEn: "Verification email sent, please check your inbox",
    });
  } catch (error) {
    console.error("Send verification email error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "发送失败，请稍后再试",
        messageEn: "Failed to send, please try again later",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Verify Email with Token
// PUT - 使用令牌验证邮箱
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyEmailBody;
    const { token } = body;

    // Validate input
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "缺少验证令牌",
          messageEn: "Missing verification token",
        },
        { status: 400 }
      );
    }

    // Verify email
    const result = verifyEmail(token);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          messageEn: result.messageEn,
        },
        { status: 400 }
      );
    }

    console.log(`Email verified successfully: ${result.email}`);

    return NextResponse.json({
      success: true,
      message: result.message,
      messageEn: result.messageEn,
      email: result.email,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "验证失败，请稍后再试",
        messageEn: "Verification failed, please try again later",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Check Verification Status
// GET - 检查验证状态
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const token = searchParams.get("token");

    // If token is provided, validate it
    if (token) {
      // Just check if token is valid without consuming it
      // This is for the UI to show appropriate message
      return NextResponse.json({
        valid: true, // We can't check validity without consuming in current implementation
        message: "请点击验证按钮完成验证",
        messageEn: "Please click the verify button to complete verification",
      });
    }

    // If email is provided, check verification status
    if (email) {
      if (!isValidEmail(email)) {
        return NextResponse.json(
          {
            verified: false,
            message: "无效的邮箱地址",
            messageEn: "Invalid email address",
          },
          { status: 400 }
        );
      }

      const verified = isEmailVerified(email.toLowerCase());

      return NextResponse.json({
        verified,
        message: verified ? "邮箱已验证" : "邮箱未验证",
        messageEn: verified ? "Email is verified" : "Email is not verified",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "缺少必要参数",
        messageEn: "Missing required parameters",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Check verification status error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "检查失败",
        messageEn: "Check failed",
      },
      { status: 500 }
    );
  }
}
