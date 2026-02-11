/**
 * Lurus API Proxy Route
 *
 * Proxies requests to lurus-api V2 endpoints.
 * Handles authentication via NextAuth session and forwards cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const LURUS_API_URL = process.env.LURUS_API_URL || "https://api.lurus.cn";
const TENANT_SLUG = process.env.TENANT_SLUG || "lurus";

/**
 * GET handler
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, "GET");
}

/**
 * POST handler
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, "POST");
}

/**
 * PUT handler
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, "PUT");
}

/**
 * DELETE handler
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, "DELETE");
}

/**
 * Generic request handler
 */
async function handleRequest(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>,
  method: string
) {
  // Verify session
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "未授权，请先登录" },
      { status: 401 }
    );
  }

  const { path } = await paramsPromise;
  const apiPath = `/api/v2/${TENANT_SLUG}/${path.join("/")}`;
  const url = new URL(apiPath, LURUS_API_URL);

  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Prepare request options
  const options: RequestInit = {
    method,
    credentials: "include",
    headers: {
      "Cookie": request.headers.get("cookie") || "",
      "Accept": "application/json",
    },
  };

  // Forward request body for POST/PUT
  if (method !== "GET" && method !== "DELETE") {
    try {
      const body = await request.text();
      if (body) {
        options.body = body;
        (options.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
    } catch (error) {
      console.error("Error reading request body:", error);
    }
  }

  try {
    const response = await fetch(url.toString(), options);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("lurus-api proxy error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "服务暂时不可用，请稍后重试",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    );
  }
}
