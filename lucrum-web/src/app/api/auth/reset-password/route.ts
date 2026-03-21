/**
 * Password Reset API Routes
 *
 * Local password reset is disabled. Users authenticate via Zitadel SSO
 * and must reset passwords through the unified identity provider.
 *
 * All methods (POST/PUT/GET) return 501 with a redirect to Zitadel.
 */

import { NextResponse } from "next/server";

// =============================================================================
// Zitadel SSO password reset redirect URL
// =============================================================================

const ZITADEL_RESET_URL = `${process.env.ZITADEL_ISSUER || "https://auth.lurus.cn"}/ui/login/password/reset`;

function localResetDisabledResponse() {
  // Local password reset is not available in production.
  // Users authenticate via Zitadel SSO — password reset goes through auth.lurus.cn
  return NextResponse.json(
    {
      error: {
        code: "AUTH_LOCAL_DISABLED",
        title: "本地密码重置不可用",
        description: "请通过 Lurus 统一账户系统重置密码",
        severity: "info",
        recoveryActions: [
          {
            type: "navigate",
            href: ZITADEL_RESET_URL,
            label: "去重置密码",
          },
        ],
      },
    },
    { status: 501 }
  );
}

// =============================================================================
// POST - Request Password Reset (disabled, redirects to Zitadel)
// =============================================================================

export async function POST() {
  return localResetDisabledResponse();
}

// =============================================================================
// PUT - Reset Password with Token (disabled, redirects to Zitadel)
// =============================================================================

export async function PUT() {
  return localResetDisabledResponse();
}

// =============================================================================
// GET - Validate Token (disabled, redirects to Zitadel)
// =============================================================================

export async function GET() {
  return localResetDisabledResponse();
}
