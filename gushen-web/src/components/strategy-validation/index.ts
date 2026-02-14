/**
 * Strategy Validation Components
 * 策略验证组件
 *
 * Export all strategy validation related components
 * 导出所有策略验证相关组件
 */

export { ConfigPanel } from "./config-panel";
export type {
  ValidationConfig,
  StrategyOption,
  SectorOption,
} from "./config-panel";

export { ResultSummary } from "./result-summary";
export type { ValidationSummary, ValidationWarning } from "./result-summary";

export { ReturnDistribution } from "./return-distribution";
export type { DistributionBucket } from "./return-distribution";

export { SignalTimeline } from "./signal-timeline";
export type { TimelinePoint } from "./signal-timeline";

export { StockRanking } from "./stock-ranking";
export type { StockRankingItem } from "./stock-ranking";

export { SignalDetails } from "./signal-details";
export type { SignalDetailItem, SignalStatusType } from "./signal-details";

export { BatchProgressBar } from "./batch-progress-bar";
export type { BatchProgressBarProps, BatchStatus } from "./batch-progress-bar";

export { FailureAnalysisPanel } from "./failure-analysis-panel";
export type { FailureAnalysisPanelProps } from "./failure-analysis-panel";
