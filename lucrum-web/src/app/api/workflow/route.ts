/**
 * Workflow API
 * 工作流API
 *
 * POST /api/workflow - Create new workflow session
 * GET /api/workflow - Get active sessions for user
 * 创建新工作流会话 / 获取用户的活动会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWorkflowManager, type CreateSessionRequest } from '@/lib/workflow';

// =============================================================================
// POST - Create Workflow Session / 创建工作流会话
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CreateSessionRequest;

    // Validate request
    if (!body.workflowType) {
      return NextResponse.json(
        { error: 'workflowType is required' },
        { status: 400 }
      );
    }

    const validTypes = ['strategy_dev', 'backtest_analysis', 'advisor_chat'];
    if (!validTypes.includes(body.workflowType)) {
      return NextResponse.json(
        { error: `Invalid workflow type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Create session
    const manager = getWorkflowManager();
    const sessionResponse = await manager.createSession(session.user.id, body);

    return NextResponse.json(sessionResponse, { status: 201 });
  } catch (error) {
    console.error('[API] Create workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow session' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get Active Sessions / 获取活动会话
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active sessions
    const manager = getWorkflowManager();
    const sessions = await manager.getActiveSessions(session.user.id);

    return NextResponse.json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('[API] Get workflows error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow sessions' },
      { status: 500 }
    );
  }
}
