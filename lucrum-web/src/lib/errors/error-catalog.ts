/**
 * Error catalog — pre-built AppError factories for common failure scenarios.
 *
 * Usage:
 *   import { ErrorCatalog } from '@/lib/errors/error-catalog';
 *   throw ErrorCatalog.backtestNoData('600519', '贵州茅台', '2024-01-01', '2025-01-01');
 */

import type { AppError, RecoveryAction } from './error-types';

function makeError(
  code: string,
  title: string,
  description: string,
  severity: AppError['severity'],
  recoveryActions: RecoveryAction[],
): AppError {
  return { code, title, description, severity, recoveryActions };
}

export const ErrorCatalog = {
  // === Backtest ===
  backtestNoData(symbol: string, symbolName: string, startDate: string, endDate: string): AppError {
    return makeError(
      'BACKTEST_NO_DATA',
      '无法获取行情数据',
      `${symbolName}(${symbol})在${startDate}~${endDate}期间没有K线数据`,
      'error',
      [
        { type: 'custom', label: '更换股票' },
        { type: 'custom', label: '调整日期范围' },
        { type: 'navigate', href: '/dashboard/settings', label: '导入数据' },
      ],
    );
  },

  backtestInsufficientData(symbol: string, count: number, minRequired: number): AppError {
    return makeError(
      'BACKTEST_INSUFFICIENT',
      '数据量不足',
      `${symbol}仅有${count}根K线，至少需要${minRequired}根才能进行回测`,
      'error',
      [
        { type: 'custom', label: '扩大日期范围' },
        { type: 'custom', label: '更换股票' },
      ],
    );
  },

  backtestTimeout(): AppError {
    return makeError(
      'BACKTEST_TIMEOUT',
      '回测执行超时',
      '回测运行时间过长，请缩小回测范围后重试',
      'error',
      [
        { type: 'custom', label: '缩短日期范围' },
        { type: 'custom', label: '减少股票数量' },
        { type: 'retry', label: '重试' },
      ],
    );
  },

  backtestEngineError(detail: string): AppError {
    return makeError(
      'BACKTEST_ENGINE',
      '回测引擎错误',
      detail || '回测引擎内部错误，请修改策略参数后重试',
      'error',
      [
        { type: 'custom', label: '修改策略参数' },
        { type: 'retry', label: '重试' },
      ],
    );
  },

  backtestQuotaExceeded(used: number, limit: number): AppError {
    return makeError(
      'BACKTEST_QUOTA',
      '今日回测额度已用完',
      `已使用 ${used}/${limit} 次，额度将于明日重置`,
      'warning',
      [
        { type: 'navigate', href: '/dashboard/account', label: '升级套餐' },
        { type: 'dismiss', label: '知道了' },
      ],
    );
  },

  // === Sector Backtest ===
  sectorNoStocks(sectorName: string): AppError {
    return makeError(
      'SECTOR_NO_STOCKS',
      '板块无成分股',
      `"${sectorName}"板块没有符合条件的股票，请放宽筛选条件`,
      'warning',
      [
        { type: 'custom', label: '放宽过滤条件' },
        { type: 'custom', label: '更换板块' },
      ],
    );
  },

  sectorAllFailed(sectorName: string): AppError {
    return makeError(
      'SECTOR_ALL_FAILED',
      '板块回测全部失败',
      `"${sectorName}"中所有股票的回测均失败，可能是数据覆盖不足`,
      'error',
      [
        { type: 'custom', label: '缩短回测周期' },
        { type: 'custom', label: '更换板块' },
        { type: 'retry', label: '重试' },
      ],
    );
  },

  // === Strategy Generation ===
  strategyGenerationFailed(detail: string): AppError {
    return makeError(
      'STRATEGY_GEN_FAILED',
      'AI 策略生成失败',
      detail || 'AI 服务暂时不可用，已使用本地模板生成',
      'warning',
      [
        { type: 'retry', label: '重试' },
        { type: 'custom', label: '使用模板' },
        { type: 'custom', label: '修改描述' },
      ],
    );
  },

  aiQuotaExceeded(used: number, limit: number): AppError {
    return makeError(
      'AI_QUOTA_EXCEEDED',
      'AI 调用额度已用完',
      `今日已使用 ${used}/${limit} 次 AI 调用，额度将于明日重置`,
      'warning',
      [
        { type: 'navigate', href: '/dashboard/account', label: '升级套餐' },
        { type: 'custom', label: '使用模板' },
      ],
    );
  },

  // === Advisor ===
  advisorQuotaExceeded(remaining: number, plan: string): AppError {
    return makeError(
      'ADVISOR_QUOTA',
      'AI 对话次数已达今日上限',
      `当前${plan}计划的对话额度已用完，剩余 ${remaining} 次`,
      'warning',
      [
        { type: 'navigate', href: '/dashboard/account', label: '升级套餐' },
        { type: 'custom', label: '使用模板问题' },
      ],
    );
  },

  advisorLlmError(status: number): AppError {
    return makeError(
      'ADVISOR_LLM',
      'AI 顾问响应失败',
      status === 429
        ? 'AI 服务繁忙，请稍后再试'
        : `AI 服务暂时不可用 (${status})，请稍后重试`,
      'error',
      [
        { type: 'retry', label: '重试' },
        { type: 'custom', label: '简化问题' },
      ],
    );
  },

  advisorTimeout(): AppError {
    return makeError(
      'ADVISOR_TIMEOUT',
      'AI 响应超时',
      '请求时间过长，建议简化问题后重试',
      'error',
      [
        { type: 'retry', label: '重试' },
        { type: 'custom', label: '简化问题' },
      ],
    );
  },

  // === Network / General ===
  networkOffline(): AppError {
    return makeError(
      'NETWORK_OFFLINE',
      '网络连接中断',
      '部分功能暂不可用，请检查网络连接',
      'warning',
      [
        { type: 'retry', label: '重试连接' },
      ],
    );
  },

  dataLoadFailed(resource: string): AppError {
    return makeError(
      'DATA_LOAD_FAILED',
      `${resource}加载失败`,
      `无法获取${resource}数据，请检查网络后重试`,
      'error',
      [
        { type: 'retry', label: '重试' },
      ],
    );
  },

  databaseError(): AppError {
    return makeError(
      'DATABASE_ERROR',
      '数据服务不可用',
      '数据库连接失败，请稍后重试。若持续出现请联系管理员',
      'error',
      [
        { type: 'retry', label: '重试' },
      ],
    );
  },

  // === Trading ===
  orderRejected(reason: string): AppError {
    return makeError(
      'ORDER_REJECTED',
      '委托被拒绝',
      reason,
      'error',
      [
        { type: 'custom', label: '修改订单' },
      ],
    );
  },

  insufficientBalance(needed: number, available: number): AppError {
    return makeError(
      'INSUFFICIENT_BALANCE',
      '可用资金不足',
      `需要 ¥${needed.toLocaleString()}，当前可用 ¥${available.toLocaleString()}`,
      'error',
      [
        { type: 'custom', label: '调整数量' },
      ],
    );
  },

  // === Marketplace ===
  marketplaceLoadFailed(): AppError {
    return makeError(
      'MARKETPLACE_LOAD',
      '策略市场加载失败',
      '无法获取策略列表，请检查网络后重试',
      'error',
      [
        { type: 'retry', label: '重试' },
      ],
    );
  },

  strategyImportFailed(title: string, reason: string): AppError {
    return makeError(
      'STRATEGY_IMPORT',
      '策略导入失败',
      `"${title}" 导入失败: ${reason}`,
      'error',
      [
        { type: 'retry', label: '重试' },
        { type: 'custom', label: '查看详情' },
      ],
    );
  },

  // === Portfolio ===
  portfolioAllocationFailed(reason: string): AppError {
    return makeError(
      'PORTFOLIO_ALLOCATION_FAILED',
      '组合资金分配失败',
      reason,
      'error',
      [
        { type: 'custom', label: '调整分仓方式' },
        { type: 'custom', label: '减少股票数量' },
      ],
    );
  },

  portfolioSectorLimitExceeded(sector: string, limit: string, actual: string): AppError {
    return makeError(
      'PORTFOLIO_SECTOR_LIMIT',
      '行业集中度超限',
      `${sector}板块占比${actual}，超过上限${limit}`,
      'warning',
      [
        { type: 'custom', label: '提高行业上限' },
        { type: 'custom', label: '减少该行业股票' },
      ],
    );
  },

  portfolioInsufficientDiversification(hhi: string): AppError {
    return makeError(
      'PORTFOLIO_LOW_DIVERSIFICATION',
      '分散度不足',
      `HHI指数${hhi}，建议增加不同行业的股票`,
      'warning',
      [
        { type: 'custom', label: '查看行业分布' },
        { type: 'navigate', href: '/dashboard/validation?tab=portfolio', label: '调整组合' },
      ],
    );
  },

  portfolioNoTradeableStocks(total: number, reasons: string[]): AppError {
    return makeError(
      'PORTFOLIO_NO_TRADEABLE',
      '没有可交易的股票',
      `${total}只股票中无一满足交易条件。主要原因: ${reasons[0] || '资金不足'}`,
      'error',
      [
        { type: 'custom', label: '增加总资金' },
        { type: 'custom', label: '更换低价股票' },
        { type: 'custom', label: '调整分仓方式' },
      ],
    );
  },

  portfolioRebalanceFailed(reason: string): AppError {
    return makeError(
      'PORTFOLIO_REBALANCE_FAILED',
      '再平衡失败',
      reason,
      'warning',
      [
        { type: 'custom', label: '跳过再平衡继续回测' },
        { type: 'custom', label: '关闭再平衡' },
      ],
    );
  },
  // === Strategy Recommendation ===
  recommendNoData(sectorName: string): AppError {
    return makeError(
      'RECOMMEND_NO_DATA',
      '无可用数据',
      `"${sectorName}"板块的股票缺少足够的K线数据，无法进行策略推荐`,
      'warning',
      [
        { type: 'custom', label: '更换板块' },
        { type: 'custom', label: '减少股票数量' },
      ],
    );
  },

  recommendNoSignals(sectorName: string): AppError {
    return makeError(
      'RECOMMEND_NO_SIGNALS',
      '未检测到有效信号',
      `所有策略在"${sectorName}"板块中均未产生交易信号，可能该板块近期走势平淡`,
      'warning',
      [
        { type: 'custom', label: '更换板块' },
        { type: 'custom', label: '调整持仓天数' },
      ],
    );
  },

  recommendTimeout(): AppError {
    return makeError(
      'RECOMMEND_TIMEOUT',
      '策略推荐超时',
      '扫描时间过长，请减少股票数量或缩短回测周期后重试',
      'error',
      [
        { type: 'custom', label: '减少股票数量' },
        { type: 'retry', label: '重试' },
      ],
    );
  },

  // === Rate Limiting ===
  rateLimitExceeded(retryAfterSeconds: number): AppError {
    return makeError(
      'RATE_LIMITED',
      '请求过于频繁',
      `请等待${retryAfterSeconds}秒后再试`,
      'warning',
      [
        { type: 'dismiss', label: '知道了' },
      ],
    );
  },

  concurrencyLimitExceeded(activeCount: number): AppError {
    return makeError(
      'CONCURRENCY_LIMIT',
      '服务繁忙',
      `当前有${activeCount}个任务正在执行，请稍后重试`,
      'warning',
      [
        { type: 'retry', label: '稍后重试' },
      ],
    );
  },
  // === Team Collaboration ===
  teamCreationFailed(slug: string): AppError {
    return makeError(
      'TEAM_CREATE_FAILED',
      '团队创建失败',
      `团队标识 "${slug}" 可能已被占用，请更换后重试`,
      'error',
      [
        { type: 'retry', label: '重试' },
        { type: 'custom', label: '更换标识' },
      ],
    );
  },

  teamNotFound(): AppError {
    return makeError(
      'TEAM_NOT_FOUND',
      '团队不存在',
      '该团队已被删除或您无权访问',
      'error',
      [
        { type: 'navigate', href: '/dashboard/team', label: '返回团队列表' },
      ],
    );
  },

  teamAccessDenied(): AppError {
    return makeError(
      'TEAM_ACCESS_DENIED',
      '权限不足',
      '您没有执行此操作的权限，请联系团队管理员',
      'warning',
      [
        { type: 'dismiss', label: '知道了' },
      ],
    );
  },

  teamMemberLimitReached(max: number): AppError {
    return makeError(
      'TEAM_MEMBER_LIMIT',
      '团队成员已满',
      `当前计划最多 ${max} 人，请升级以邀请更多成员`,
      'warning',
      [
        { type: 'navigate', href: '/dashboard/settings?tab=account', label: '升级计划' },
        { type: 'dismiss', label: '知道了' },
      ],
    );
  },

  invitationFailed(email: string, reason: string): AppError {
    return makeError(
      'INVITATION_FAILED',
      '邀请发送失败',
      `无法邀请 ${email}: ${reason}`,
      'error',
      [
        { type: 'retry', label: '重试' },
      ],
    );
  },

  invitationExpired(): AppError {
    return makeError(
      'INVITATION_EXPIRED',
      '邀请已过期',
      '此邀请链接已过期，请联系团队管理员重新发送',
      'warning',
      [
        { type: 'dismiss', label: '知道了' },
      ],
    );
  },

  invitationAlreadyUsed(): AppError {
    return makeError(
      'INVITATION_USED',
      '邀请已使用',
      '此邀请已被接受或已失效',
      'info',
      [
        { type: 'navigate', href: '/dashboard/team', label: '查看团队' },
      ],
    );
  },

  memberRemovalFailed(reason: string): AppError {
    return makeError(
      'MEMBER_REMOVAL_FAILED',
      '成员移除失败',
      reason,
      'error',
      [
        { type: 'retry', label: '重试' },
      ],
    );
  },

  notificationLoadFailed(): AppError {
    return makeError(
      'NOTIFICATION_LOAD_FAILED',
      '通知加载失败',
      '无法获取通知列表，请检查网络后重试',
      'error',
      [
        { type: 'retry', label: '重试' },
      ],
    );
  },
} as const;
