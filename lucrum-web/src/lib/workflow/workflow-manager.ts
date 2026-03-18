/**
 * Workflow Manager
 * 工作流管理器
 *
 * Central manager for workflow sessions.
 * Handles session CRUD, step execution, and state management.
 *
 * 工作流会话的中央管理器
 * 处理会话CRUD、步骤执行和状态管理
 */

import { eq, and, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userWorkflowSessions, workflowStepCache } from '@/lib/db/schema';
import type {
  WorkflowType,
  WorkflowSession,
  WorkflowDefinition,
  WorkflowStepDefinition,
  StepData,
  StepStatus,
  CreateSessionRequest,
  ExecuteStepRequest,
  SessionResponse,
  StepResultResponse,
  StepExecutionContext,
  StepExecutionResult,
  WorkflowEvent,
  WorkflowEventType,
} from './types';
import { STRATEGY_DEV_WORKFLOW } from './workflows/strategy-workflow';
import {
  getCachedStepResult,
  setCachedStepResult,
  shouldCacheStep,
} from './cache-strategy';
import { executeStep } from './step-executor';

// =============================================================================
// Workflow Definitions Registry / 工作流定义注册表
// =============================================================================

const WORKFLOW_DEFINITIONS: Record<WorkflowType, WorkflowDefinition> = {
  strategy_dev: STRATEGY_DEV_WORKFLOW,
  backtest_analysis: {
    type: 'backtest_analysis',
    name: '回测分析 / Backtest Analysis',
    description: 'Analyze and compare backtest results',
    steps: [],
    defaultExpirationHours: 24,
  },
  advisor_chat: {
    type: 'advisor_chat',
    name: '投资顾问 / Investment Advisor',
    description: 'Interactive investment advisory chat',
    steps: [],
    defaultExpirationHours: 24,
  },
};

// =============================================================================
// Workflow Manager Class / 工作流管理器类
// =============================================================================

export class WorkflowManager {
  private eventHandlers: Map<WorkflowEventType, ((event: WorkflowEvent) => void)[]> = new Map();

  /**
   * Get workflow definition
   * 获取工作流定义
   */
  getWorkflowDefinition(type: WorkflowType): WorkflowDefinition {
    return WORKFLOW_DEFINITIONS[type];
  }

  /**
   * Create a new workflow session
   * 创建新的工作流会话
   */
  async createSession(
    userId: string,
    request: CreateSessionRequest
  ): Promise<SessionResponse> {
    const definition = this.getWorkflowDefinition(request.workflowType);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + definition.defaultExpirationHours);

    // Create session in database
    const [session] = await db
      .insert(userWorkflowSessions)
      .values({
        userId,
        workflowType: request.workflowType,
        status: 'active',
        currentStep: 0,
        totalSteps: definition.steps.length,
        title: request.title,
        context: request.initialContext,
        stepData: {},
        expiresAt,
      })
      .returning();

    if (!session) {
      throw new Error('Failed to create workflow session');
    }

    this.emit({
      type: 'session:created',
      sessionId: session.id,
      userId,
      timestamp: new Date(),
    });

    return this.buildSessionResponse(session, definition);
  }

  /**
   * Get session by ID
   * 根据ID获取会话
   */
  async getSession(sessionId: string, userId: string): Promise<SessionResponse | null> {
    const session = await db.query.userWorkflowSessions.findFirst({
      where: and(
        eq(userWorkflowSessions.id, sessionId),
        eq(userWorkflowSessions.userId, userId)
      ),
    });

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      await this.expireSession(sessionId);
      return null;
    }

    const definition = this.getWorkflowDefinition(session.workflowType as WorkflowType);
    return this.buildSessionResponse(session, definition);
  }

  /**
   * Get active sessions for user
   * 获取用户的活动会话
   */
  async getActiveSessions(userId: string): Promise<SessionResponse[]> {
    const sessions = await db.query.userWorkflowSessions.findMany({
      where: and(
        eq(userWorkflowSessions.userId, userId),
        eq(userWorkflowSessions.status, 'active')
      ),
      orderBy: (ws, { desc }) => [desc(ws.updatedAt)],
    });

    return sessions.map((session) => {
      const definition = this.getWorkflowDefinition(session.workflowType as WorkflowType);
      return this.buildSessionResponse(session, definition);
    });
  }

  /**
   * Execute a workflow step
   * 执行工作流步骤
   */
  async executeStep(
    userId: string,
    request: ExecuteStepRequest
  ): Promise<StepResultResponse> {
    // Get session
    const sessionData = await db.query.userWorkflowSessions.findFirst({
      where: and(
        eq(userWorkflowSessions.id, request.sessionId),
        eq(userWorkflowSessions.userId, userId)
      ),
    });

    if (!sessionData) {
      return {
        success: false,
        stepData: this.createErrorStepData(request.stepNumber, 'Session not found'),
        isComplete: false,
        cached: false,
        error: 'Session not found',
      };
    }

    const definition = this.getWorkflowDefinition(sessionData.workflowType as WorkflowType);
    const stepDef = definition.steps[request.stepNumber];

    if (!stepDef) {
      return {
        success: false,
        stepData: this.createErrorStepData(request.stepNumber, 'Invalid step number'),
        isComplete: false,
        cached: false,
        error: 'Invalid step number',
      };
    }

    // Check cache first (unless skip requested)
    if (!request.skipCache && shouldCacheStep(stepDef.stepType)) {
      const cached = await getCachedStepResult<StepExecutionResult>(
        request.sessionId,
        request.stepNumber,
        stepDef.stepType,
        request.inputData
      );

      if (cached) {
        this.emit({
          type: 'cache:hit',
          sessionId: request.sessionId,
          userId,
          timestamp: new Date(),
          data: { stepNumber: request.stepNumber, stepType: stepDef.stepType },
        });

        const stepData = this.createStepData(request.stepNumber, stepDef.stepType, {
          success: true,
          outputData: cached.outputData,
        });

        return {
          success: true,
          stepData,
          nextStep: request.stepNumber + 1,
          isComplete: request.stepNumber >= definition.steps.length - 1,
          cached: true,
        };
      }

      this.emit({
        type: 'cache:miss',
        sessionId: request.sessionId,
        userId,
        timestamp: new Date(),
        data: { stepNumber: request.stepNumber, stepType: stepDef.stepType },
      });
    }

    // Build execution context
    const session = this.dbSessionToWorkflowSession(sessionData);
    const previousSteps = this.getPreviousSteps(session, request.stepNumber);

    const context: StepExecutionContext = {
      session,
      stepDef,
      previousSteps,
      userId,
    };

    // Execute step
    this.emit({
      type: 'step:started',
      sessionId: request.sessionId,
      userId,
      timestamp: new Date(),
      data: { stepNumber: request.stepNumber, stepType: stepDef.stepType },
    });

    try {
      const result = await executeStep(context, request.inputData);

      // Create step data
      const stepData = this.createStepData(request.stepNumber, stepDef.stepType, result);

      // Cache result if successful and caching enabled
      if (result.success && result.shouldCache !== false && shouldCacheStep(stepDef.stepType)) {
        await setCachedStepResult(
          request.sessionId,
          request.stepNumber,
          stepDef.stepType,
          request.inputData,
          result
        );
      }

      // Update session in database
      await this.updateSessionStep(request.sessionId, request.stepNumber, stepData);

      const nextStep = result.nextStep ?? request.stepNumber + 1;
      const isComplete = nextStep >= definition.steps.length;

      if (result.success) {
        this.emit({
          type: 'step:completed',
          sessionId: request.sessionId,
          userId,
          timestamp: new Date(),
          data: { stepNumber: request.stepNumber, stepType: stepDef.stepType },
        });
      } else {
        this.emit({
          type: 'step:failed',
          sessionId: request.sessionId,
          userId,
          timestamp: new Date(),
          data: {
            stepNumber: request.stepNumber,
            stepType: stepDef.stepType,
            error: result.error,
          },
        });
      }

      if (isComplete) {
        await this.completeSession(request.sessionId);
      }

      return {
        success: result.success,
        stepData,
        nextStep: result.success ? nextStep : undefined,
        isComplete,
        cached: false,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stepData = this.createErrorStepData(request.stepNumber, errorMessage);

      this.emit({
        type: 'step:failed',
        sessionId: request.sessionId,
        userId,
        timestamp: new Date(),
        data: {
          stepNumber: request.stepNumber,
          stepType: stepDef.stepType,
          error: errorMessage,
        },
      });

      return {
        success: false,
        stepData,
        isComplete: false,
        cached: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Go back to previous step
   * 返回上一步骤
   */
  async goToStep(
    sessionId: string,
    userId: string,
    stepNumber: number
  ): Promise<SessionResponse | null> {
    const session = await this.getSession(sessionId, userId);
    if (!session) return null;

    // Update current step
    await db
      .update(userWorkflowSessions)
      .set({
        currentStep: stepNumber,
        updatedAt: new Date(),
      })
      .where(eq(userWorkflowSessions.id, sessionId));

    return this.getSession(sessionId, userId);
  }

  /**
   * Cancel session
   * 取消会话
   */
  async cancelSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(userWorkflowSessions)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(
        and(eq(userWorkflowSessions.id, sessionId), eq(userWorkflowSessions.userId, userId))
      );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Clean up expired sessions
   * 清理过期会话
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await db
      .update(userWorkflowSessions)
      .set({ status: 'expired' })
      .where(
        and(
          eq(userWorkflowSessions.status, 'active'),
          lt(userWorkflowSessions.expiresAt, new Date())
        )
      );

    return result.rowCount ?? 0;
  }

  // ===========================================================================
  // Private Helpers / 私有辅助方法
  // ===========================================================================

  private buildSessionResponse(
    dbSession: typeof userWorkflowSessions.$inferSelect,
    definition: WorkflowDefinition
  ): SessionResponse {
    const session = this.dbSessionToWorkflowSession(dbSession);
    const currentStepDef = definition.steps[session.currentStep] ?? definition.steps[0]!;

    return {
      session,
      currentStepDef: currentStepDef!,
      progress: {
        current: session.currentStep,
        total: session.totalSteps,
        percentage: Math.round((session.currentStep / session.totalSteps) * 100),
      },
      canGoBack: session.currentStep > 0,
      canGoForward: session.currentStep < session.totalSteps - 1,
    };
  }

  private dbSessionToWorkflowSession(
    dbSession: typeof userWorkflowSessions.$inferSelect
  ): WorkflowSession {
    return {
      id: dbSession.id,
      userId: dbSession.userId,
      workflowType: dbSession.workflowType as WorkflowType,
      status: dbSession.status as any,
      currentStep: dbSession.currentStep,
      totalSteps: dbSession.totalSteps,
      title: dbSession.title ?? undefined,
      context: dbSession.context as Record<string, unknown> | undefined,
      stepData: dbSession.stepData as Record<number, StepData> | undefined,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt,
      expiresAt: dbSession.expiresAt,
    };
  }

  private getPreviousSteps(session: WorkflowSession, currentStep: number): StepData[] {
    const steps: StepData[] = [];
    const stepData = session.stepData ?? {};

    for (let i = 0; i < currentStep; i++) {
      const step = stepData[i];
      if (step) {
        steps.push(step);
      }
    }

    return steps;
  }

  private createStepData(
    stepNumber: number,
    stepType: string,
    result: StepExecutionResult
  ): StepData {
    return {
      stepNumber,
      stepType: stepType as any,
      status: result.success ? 'completed' : 'failed',
      outputData: result.outputData,
      errorMessage: result.error,
      completedAt: new Date(),
    };
  }

  private createErrorStepData(stepNumber: number, error: string): StepData {
    return {
      stepNumber,
      stepType: 'stock_select', // Default
      status: 'failed',
      errorMessage: error,
      completedAt: new Date(),
    };
  }

  private async updateSessionStep(
    sessionId: string,
    stepNumber: number,
    stepData: StepData
  ): Promise<void> {
    // Get current step data
    const session = await db.query.userWorkflowSessions.findFirst({
      where: eq(userWorkflowSessions.id, sessionId),
    });

    const currentStepData = (session?.stepData as Record<number, StepData>) ?? {};
    currentStepData[stepNumber] = stepData;

    await db
      .update(userWorkflowSessions)
      .set({
        currentStep: stepNumber + 1,
        stepData: currentStepData,
        updatedAt: new Date(),
      })
      .where(eq(userWorkflowSessions.id, sessionId));
  }

  private async completeSession(sessionId: string): Promise<void> {
    await db
      .update(userWorkflowSessions)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(userWorkflowSessions.id, sessionId));

    this.emit({
      type: 'session:completed',
      sessionId,
      userId: '',
      timestamp: new Date(),
    });
  }

  private async expireSession(sessionId: string): Promise<void> {
    await db
      .update(userWorkflowSessions)
      .set({ status: 'expired' })
      .where(eq(userWorkflowSessions.id, sessionId));

    this.emit({
      type: 'session:expired',
      sessionId,
      userId: '',
      timestamp: new Date(),
    });
  }

  // ===========================================================================
  // Event System / 事件系统
  // ===========================================================================

  on(type: WorkflowEventType, handler: (event: WorkflowEvent) => void): void {
    const handlers = this.eventHandlers.get(type) || [];
    handlers.push(handler);
    this.eventHandlers.set(type, handlers);
  }

  private emit(event: WorkflowEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[WorkflowManager] Event handler error:', error);
      }
    }
  }
}

// =============================================================================
// Singleton Instance / 单例实例
// =============================================================================

let managerInstance: WorkflowManager | null = null;

export function getWorkflowManager(): WorkflowManager {
  if (!managerInstance) {
    managerInstance = new WorkflowManager();
  }
  return managerInstance;
}
