/**
 * Lucrum Agentic Advisor - Prediction System: Alert Generator
 *
 * Generates proactive alerts for market events, anomalies, and opportunities
 * Part of the prediction system for autonomous monitoring
 */

import type { ProactiveAlert, AlertType, AlertPriority } from "../agent/types";

// ============================================================================
// Alert ID Generation
// ============================================================================

function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Alert Factory Functions
// ============================================================================

/**
 * Generate price breakout alert / 生成价格突破预警
 */
export function generatePriceBreakoutAlert(
  symbol: string,
  symbolName: string,
  currentPrice: number,
  breakoutPrice: number,
  direction: "up" | "down",
  volumeRatio: number,
): ProactiveAlert {
  const directionText = direction === "up" ? "向上突破" : "向下突破";
  const priority: AlertPriority = volumeRatio > 2 ? "high" : "medium";

  return {
    id: generateAlertId(),
    type: "price_breakout",
    priority,
    symbol,
    symbolName,
    title: `${symbolName} ${directionText}关键价位`,
    summary: `${symbolName}(${symbol}) 当前价格 ¥${currentPrice.toFixed(2)} ${directionText} ¥${breakoutPrice.toFixed(2)}，成交量是平均的 ${volumeRatio.toFixed(1)} 倍`,
    analysis:
      direction === "up"
        ? `价格突破前期阻力位，且成交量放大，可能形成新的上涨趋势。建议关注后续量价配合情况。`
        : `价格跌破重要支撑位，需警惕进一步下跌风险。建议控制仓位，设置止损。`,
    suggestedAction:
      direction === "up" ? "关注回踩确认机会" : "注意风险控制，考虑减仓",
    data: {
      currentPrice,
      breakoutPrice,
      direction,
      volumeRatio,
    },
    triggeredBy: "market_monitor",
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
  };
}

/**
 * Generate volume surge alert / 生成放量异动预警
 */
export function generateVolumeSurgeAlert(
  symbol: string,
  symbolName: string,
  currentVolume: number,
  avgVolume: number,
  priceChange: number,
  priceChangePercent: number,
): ProactiveAlert {
  const volumeRatio = currentVolume / avgVolume;
  const priority: AlertPriority = volumeRatio > 3 ? "high" : "medium";
  const priceDirection = priceChange >= 0 ? "上涨" : "下跌";

  return {
    id: generateAlertId(),
    type: "volume_surge",
    priority,
    symbol,
    symbolName,
    title: `${symbolName} 成交量异常放大`,
    summary: `${symbolName}(${symbol}) 成交量达到日均的 ${volumeRatio.toFixed(1)} 倍，价格${priceDirection} ${Math.abs(priceChangePercent).toFixed(2)}%`,
    analysis:
      volumeRatio > 3
        ? `成交量极度放大，可能有重大资金动向。需关注是主力建仓还是出货。`
        : `成交量明显放大，市场关注度提升。结合价格走势判断后续方向。`,
    suggestedAction:
      priceChange >= 0
        ? "关注是否突破关键位，放量上涨可能延续"
        : "注意是否为放量下跌，警惕主力出货",
    data: {
      currentVolume,
      avgVolume,
      volumeRatio,
      priceChange,
      priceChangePercent,
    },
    triggeredBy: "anomaly_detector",
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
  };
}

/**
 * Generate technical signal alert / 生成技术信号预警
 */
export function generateTechnicalSignalAlert(
  symbol: string,
  symbolName: string,
  signalType: string,
  signalDescription: string,
  direction: "bullish" | "bearish" | "neutral",
  confidence: number,
): ProactiveAlert {
  const priority: AlertPriority =
    confidence > 0.8 ? "high" : confidence > 0.6 ? "medium" : "low";
  const directionText =
    direction === "bullish"
      ? "看多"
      : direction === "bearish"
        ? "看空"
        : "中性";

  return {
    id: generateAlertId(),
    type: "technical_signal",
    priority,
    symbol,
    symbolName,
    title: `${symbolName} ${signalType}信号`,
    summary: `${symbolName}(${symbol}) 出现${signalType}，信号方向: ${directionText}，置信度: ${(confidence * 100).toFixed(0)}%`,
    analysis: signalDescription,
    suggestedAction:
      direction === "bullish"
        ? "关注买入机会，注意设置止损"
        : direction === "bearish"
          ? "考虑减仓或观望，等待趋势明朗"
          : "保持观望，等待方向明确",
    data: {
      signalType,
      direction,
      confidence,
    },
    triggeredBy: "technical_analyst",
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
  };
}

/**
 * Generate risk warning alert / 生成风险预警
 */
export function generateRiskWarningAlert(
  symbol: string,
  symbolName: string,
  riskType: string,
  riskDescription: string,
  severity: "low" | "medium" | "high" | "critical",
): ProactiveAlert {
  const priorityMap: Record<string, AlertPriority> = {
    low: "low",
    medium: "medium",
    high: "high",
    critical: "urgent",
  };

  return {
    id: generateAlertId(),
    type: "risk_warning",
    priority: priorityMap[severity] || "medium",
    symbol,
    symbolName,
    title: `${symbolName} 风险预警: ${riskType}`,
    summary: `${symbolName}(${symbol}) ${riskDescription}`,
    analysis: `检测到潜在风险因素，建议密切关注并做好风险管理。`,
    suggestedAction:
      severity === "critical"
        ? "建议立即采取风控措施"
        : severity === "high"
          ? "建议审视持仓，考虑减仓"
          : "保持关注，做好预案",
    data: {
      riskType,
      severity,
    },
    triggeredBy: "risk_monitor",
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };
}

/**
 * Generate opportunity alert / 生成投资机会预警
 */
export function generateOpportunityAlert(
  symbol: string,
  symbolName: string,
  opportunityType: string,
  description: string,
  potentialReturn: number,
  timeframe: string,
): ProactiveAlert {
  const priority: AlertPriority =
    potentialReturn > 20 ? "high" : potentialReturn > 10 ? "medium" : "low";

  return {
    id: generateAlertId(),
    type: "opportunity",
    priority,
    symbol,
    symbolName,
    title: `${symbolName} 投资机会: ${opportunityType}`,
    summary: `${symbolName}(${symbol}) ${description}，潜在收益: ${potentialReturn}%，时间框架: ${timeframe}`,
    analysis: `基于当前市场条件和技术形态，该标的可能存在投资机会。请结合自身风险承受能力评估。`,
    suggestedAction: `建议深入研究后决策，注意控制仓位`,
    data: {
      opportunityType,
      potentialReturn,
      timeframe,
    },
    triggeredBy: "opportunity_scanner",
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
  };
}

/**
 * Generate morning briefing alert / 生成每日晨报预警
 */
export function generateMorningBriefingAlert(
  marketOverview: string,
  keyEvents: string[],
  watchlist: Array<{ symbol: string; name: string; highlight: string }>,
): ProactiveAlert {
  const watchlistSummary = watchlist
    .map((w) => `${w.name}: ${w.highlight}`)
    .join("\n");

  return {
    id: generateAlertId(),
    type: "morning_briefing",
    priority: "medium",
    title: "每日晨报 - 今日市场展望",
    summary: marketOverview,
    analysis: `## 今日关注事件\n${keyEvents.map((e) => `- ${e}`).join("\n")}\n\n## 自选股提醒\n${watchlistSummary}`,
    data: {
      keyEvents,
      watchlist,
    },
    triggeredBy: "scheduler",
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
  };
}

/**
 * Generate closing summary alert / 生成收盘总结预警
 */
export function generateClosingSummaryAlert(
  marketSummary: string,
  topGainers: Array<{ symbol: string; name: string; change: number }>,
  topLosers: Array<{ symbol: string; name: string; change: number }>,
  portfolioPerformance?: { totalReturn: number; dayChange: number },
): ProactiveAlert {
  const gainersText = topGainers
    .map((g) => `${g.name}: +${g.change.toFixed(2)}%`)
    .join(", ");
  const losersText = topLosers
    .map((l) => `${l.name}: ${l.change.toFixed(2)}%`)
    .join(", ");

  let analysis = `## 市场回顾\n${marketSummary}\n\n`;
  analysis += `## 今日强势\n${gainersText}\n\n`;
  analysis += `## 今日弱势\n${losersText}`;

  if (portfolioPerformance) {
    analysis += `\n\n## 组合表现\n`;
    analysis += `今日收益: ${portfolioPerformance.dayChange >= 0 ? "+" : ""}${portfolioPerformance.dayChange.toFixed(2)}%\n`;
    analysis += `累计收益: ${portfolioPerformance.totalReturn >= 0 ? "+" : ""}${portfolioPerformance.totalReturn.toFixed(2)}%`;
  }

  return {
    id: generateAlertId(),
    type: "closing_summary",
    priority: "low",
    title: "收盘总结 - 今日市场回顾",
    summary: marketSummary,
    analysis,
    data: {
      topGainers,
      topLosers,
      portfolioPerformance,
    },
    triggeredBy: "scheduler",
    timestamp: new Date(),
    expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000), // 18 hours
  };
}

// ============================================================================
// Alert Filtering and Sorting
// ============================================================================

/**
 * Sort alerts by priority and timestamp / 按优先级和时间排序预警
 */
export function sortAlerts(alerts: ProactiveAlert[]): ProactiveAlert[] {
  const priorityOrder: Record<AlertPriority, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...alerts].sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by timestamp (newest first)
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
}

/**
 * Filter expired alerts / 过滤过期预警
 */
export function filterExpiredAlerts(
  alerts: ProactiveAlert[],
): ProactiveAlert[] {
  const now = new Date();
  return alerts.filter((alert) => !alert.expiresAt || alert.expiresAt > now);
}

/**
 * Filter alerts by type / 按类型过滤预警
 */
export function filterAlertsByType(
  alerts: ProactiveAlert[],
  types: AlertType[],
): ProactiveAlert[] {
  return alerts.filter((alert) => types.includes(alert.type));
}

/**
 * Get unread alerts / 获取未读预警
 */
export function getUnreadAlerts(alerts: ProactiveAlert[]): ProactiveAlert[] {
  return alerts.filter((alert) => !alert.read);
}

/**
 * Mark alert as read / 标记预警为已读
 */
export function markAlertAsRead(
  alerts: ProactiveAlert[],
  alertId: string,
): ProactiveAlert[] {
  return alerts.map((alert) =>
    alert.id === alertId ? { ...alert, read: true } : alert,
  );
}

/**
 * Get alert count by priority / 按优先级获取预警数量
 */
export function getAlertCountByPriority(
  alerts: ProactiveAlert[],
): Record<AlertPriority, number> {
  const counts: Record<AlertPriority, number> = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const alert of alerts) {
    counts[alert.priority]++;
  }

  return counts;
}
