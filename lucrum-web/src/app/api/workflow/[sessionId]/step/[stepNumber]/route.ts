/**
 * Workflow Step Execution API
 * 工作流步骤执行API
 *
 * GET /api/workflow/[sessionId]/step/[stepNumber] - Get step details
 * POST /api/workflow/[sessionId]/step/[stepNumber] - Execute step
 * 获取步骤详情 / 执行步骤
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getWorkflowManager } from '@/lib/workflow';

// =============================================================================
// GET - Get Step Details / 获取步骤详情
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; stepNumber: string }> }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, stepNumber: stepNumberStr } = await params;
    const stepNumber = parseInt(stepNumberStr, 10);

    if (isNaN(stepNumber) || stepNumber < 0) {
      return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
    }

    const manager = getWorkflowManager();
    const workflowSession = await manager.getSession(sessionId, session.user.id);

    if (!workflowSession) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    if (stepNumber >= workflowSession.session.totalSteps) {
      return NextResponse.json({ error: 'Step number out of range' }, { status: 400 });
    }

    // Get step definition and data
    const definition = manager.getWorkflowDefinition(workflowSession.session.workflowType);
    const stepDef = definition.steps[stepNumber];
    const stepData = workflowSession.session.stepData?.[stepNumber];

    return NextResponse.json({
      stepNumber,
      stepDef,
      stepData,
      isCurrent: stepNumber === workflowSession.session.currentStep,
      isCompleted: stepData?.status === 'completed',
    });
  } catch (error) {
    console.error('[API] Get step error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch step details' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Execute Step / 执行步骤
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; stepNumber: string }> }
) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, stepNumber: stepNumberStr } = await params;
    const stepNumber = parseInt(stepNumberStr, 10);

    if (isNaN(stepNumber) || stepNumber < 0) {
      return NextResponse.json({ error: 'Invalid step number' }, { status: 400 });
    }

    const body = await request.json();
    const inputData = body.inputData ?? body.input ?? {};
    const skipCache = body.skipCache === true;

    // Execute step
    const manager = getWorkflowManager();
    const result = await manager.executeStep(session.user.id, {
      sessionId,
      stepNumber,
      inputData,
      skipCache,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          stepData: result.stepData,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      stepData: result.stepData,
      nextStep: result.nextStep,
      isComplete: result.isComplete,
      cached: result.cached,
    });
  } catch (error) {
    console.error('[API] Execute step error:', error);
    return NextResponse.json(
      { error: 'Failed to execute step' },
      { status: 500 }
    );
  }
}
