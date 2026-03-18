/**
 * Backend API Proxy Route
 * Forwards requests to the FastAPI backend service
 *
 * This proxy handles all /api/backend/* requests and forwards them to the actual backend
 * Endpoints:
 *   /api/backend/strategy/* -> /api/strategy/*
 *   /api/backend/trading/*  -> /api/trading/*
 *   /api/backend/account/*  -> /api/account/*
 *   /api/backend/market/*   -> /api/market/*
 *   /api/backend/data/*     -> /api/data/*
 *   /api/backend/backtest/* -> /api/backtest/*
 */

import { NextRequest, NextResponse } from 'next/server';

// Backend API base URL - in production, this uses the internal K8s service
// In development, you can use localhost or the external URL
const BACKEND_URL = process.env.BACKEND_API_URL || 'https://gushen.lurus.cn';

/**
 * Handle all HTTP methods for backend proxy
 */
async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Construct the backend URL
  const backendPath = `/api/${path.join('/')}`;
  const url = new URL(backendPath, BACKEND_URL);

  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    // Prepare headers - forward relevant headers but exclude host
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Skip headers that shouldn't be forwarded
      if (!['host', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    // Set content-type if not present for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    // Get request body for methods that support it
    let body: BodyInit | null = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        body = await request.text();
      } catch {
        // No body or unable to read body
      }
    }

    // Forward the request to backend
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
      // Don't follow redirects - let the client handle them
      redirect: 'manual',
    });

    // Create response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip headers that shouldn't be forwarded back
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Return the response
    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Backend proxy error:', error);

    // Return appropriate error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Backend service unavailable',
        detail: errorMessage,
      },
      { status: 503 }
    );
  }
}

// Export handlers for all HTTP methods
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
