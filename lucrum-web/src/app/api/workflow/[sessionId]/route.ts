/**
 * Workflow Session API
 * 工作流会话API
 *
 * GET /api/workflow/[sessionId] - Get session details
 * PUT /api/workflow/[sessionId] - Update session (go to step)
 * DELETE /api/workflow/[sessionId] - Cancel session
 * 获取会话详情 / 更新会话 / 取消会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWorkflowManager } from '@/lib/workflow';

// =============================================================================
// GET - Get Session Details / 获取会话详情
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const manager = getWorkflowManager();
    const workflowSession = await manager.getSession(sessionId, session.user.id);

    if (!workflowSession) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json(workflowSession);
  } catch (error) {
    console.error('[API] Get workflow session error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow session' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update Session (Go to Step) / 更新会话（跳转到步骤）
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const body = await request.json();

    if (typeof body.stepNumber !== 'number') {
      return NextResponse.json(
        { error: 'stepNumber is required and must be a number' },
        { status: 400 }
      );
    }

    const manager = getWorkflowManager();

    // Validate step number
    const currentSession = await manager.getSession(sessionId, session.user.id);
    if (!currentSession) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    if (body.stepNumber < 0 || body.stepNumber >= currentSession.session.totalSteps) {
      return NextResponse.json(
        { error: 'Invalid step number' },
        { status: 400 }
      );
    }

    // Go to step
    const updatedSession = await manager.goToStep(
      sessionId,
      session.user.id,
      body.stepNumber
    );

    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('[API] Update workflow session error:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow session' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Cancel Session / 取消会话
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await params;
    const manager = getWorkflowManager();
    const success = await manager.cancelSession(sessionId, session.user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Session not found or already cancelled' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Session cancelled' });
  } catch (error) {
    console.error('[API] Cancel workflow session error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel workflow session' },
      { status: 500 }
    );
  }
}
