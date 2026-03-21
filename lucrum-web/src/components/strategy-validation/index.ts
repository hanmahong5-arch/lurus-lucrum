/**
 * Strategy Validation Components
 *
 * Export all strategy validation related components.
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

// --- New components (deep UX improvement) ---
export { ModeSelector } from "./mode-selector";
export { SectorPanel } from "./sector-panel";
export { ConfigBar } from "./config-bar";
export { SummaryBanner } from "./summary-banner";
