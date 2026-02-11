/**
 * Status Bar Component
 * 底部状态栏组件
 *
 * Fixed bottom status bar displaying:
 * - Save status (saved/saving/unsaved/error)
 * - Data source (db/api/simulated)
 * - Workflow step (current/total)
 * - Network status (online/offline)
 *
 * Story 1.3: 底部状态栏
 */

"use client";

import { useStatusBarStore, useNetworkStatusListener } from "@/lib/stores/status-bar-store";
import type { SaveStatus, DataSource, NetworkStatus } from "@/lib/stores/status-bar-store";

// =============================================================================
// Save Status Slot
// =============================================================================

interface SaveStatusConfig {
  label: string;
  colorClass: string;
  ariaLabel: string;
}

const SAVE_STATUS_CONFIG: Record<SaveStatus, SaveStatusConfig> = {
  saved: {
    label: "已保存",
    colorClass: "bg-status-ready",
    ariaLabel: "已保存",
  },
  saving: {
    label: "保存中...",
    colorClass: "bg-primary",
    ariaLabel: "正在保存",
  },
  unsaved: {
    label: "未保存",
    colorClass: "bg-step-pending",
    ariaLabel: "有未保存的更改",
  },
  error: {
    label: "保存失败",
    colorClass: "bg-status-block",
    ariaLabel: "保存失败",
  },
};

function SaveStatusSlot({ status }: { status: SaveStatus }) {
  const config = SAVE_STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5" aria-label={config.ariaLabel}>
      <span
        className={`w-2 h-2 rounded-full ${config.colorClass}`}
        aria-hidden="true"
      />
      <span className="text-neutral-300">{config.label}</span>
    </div>
  );
}

// =============================================================================
// Data Source Slot
// =============================================================================

interface DataSourceConfig {
  label: string;
  colorClass: string;
  ariaLabel: string;
}

const DATA_SOURCE_CONFIG: Record<DataSource, DataSourceConfig> = {
  db: {
    label: "DB",
    colorClass: "text-source-db",
    ariaLabel: "数据来源：数据库",
  },
  api: {
    label: "API",
    colorClass: "text-source-api",
    ariaLabel: "数据来源：实时 API",
  },
  simulated: {
    label: "模拟",
    colorClass: "text-source-sim",
    ariaLabel: "数据来源：模拟数据",
  },
};

function DataSourceSlot({ source }: { source: DataSource | null }) {
  if (!source) return null;

  const config = DATA_SOURCE_CONFIG[source];

  return (
    <div className="flex items-center gap-1.5" aria-label={config.ariaLabel}>
      <span className="text-neutral-500">数据:</span>
      <span className={config.colorClass}>{config.label}</span>
    </div>
  );
}

// =============================================================================
// Workflow Step Slot
// =============================================================================

interface WorkflowStepProps {
  current: number;
  total: number;
}

function WorkflowStepSlot({ current, total }: WorkflowStepProps) {
  return (
    <div
      className="flex items-center gap-1.5 text-neutral-300"
      aria-label={`工作流步骤 ${current}，共 ${total} 步`}
    >
      <span className="text-neutral-500">步骤</span>
      <span className="font-mono tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}

// =============================================================================
// Network Status Slot
// =============================================================================

interface NetworkStatusConfig {
  icon: string;
  label: string;
  colorClass: string;
  ariaLabel: string;
}

const NETWORK_STATUS_CONFIG: Record<NetworkStatus, NetworkStatusConfig> = {
  online: {
    icon: "✓",
    label: "",
    colorClass: "text-status-ready",
    ariaLabel: "网络连接正常",
  },
  offline: {
    icon: "✕",
    label: "网络断开",
    colorClass: "text-status-block",
    ariaLabel: "网络连接已断开",
  },
};

function NetworkStatusSlot({ status }: { status: NetworkStatus }) {
  const config = NETWORK_STATUS_CONFIG[status];

  return (
    <div
      className={`flex items-center gap-1 ${config.colorClass}`}
      aria-label={config.ariaLabel}
    >
      <span aria-hidden="true">{config.icon}</span>
      {config.label && <span>{config.label}</span>}
    </div>
  );
}

// =============================================================================
// Divider Component
// =============================================================================

function Divider() {
  return (
    <div
      className="h-3 w-px bg-neutral-700"
      aria-hidden="true"
    />
  );
}

// =============================================================================
// Main StatusBar Component
// =============================================================================

/**
 * StatusBar - Fixed bottom status bar
 *
 * Displays system status information at the bottom of the screen.
 * Hidden on mobile devices (< 768px).
 *
 * @example
 * ```tsx
 * // In layout or page component
 * <StatusBar />
 *
 * // Update status from anywhere
 * const { setSaveStatus } = useStatusBarStore.getState();
 * setSaveStatus('saving');
 * ```
 */
export function StatusBar() {
  // Auto-detect network status changes (online/offline events)
  useNetworkStatusListener();

  const {
    saveStatus,
    dataSource,
    workflowStep,
    networkStatus,
  } = useStatusBarStore();

  return (
    <footer
      role="status"
      aria-live="polite"
      aria-label="系统状态栏"
      className="fixed bottom-0 left-0 right-0 h-7 bg-surface border-t border-surface-border hidden md:flex items-center px-4 text-xs gap-4 z-10"
    >
      {/* Save Status Slot */}
      <SaveStatusSlot status={saveStatus} />

      {/* Data Source Slot (conditional) */}
      {dataSource && (
        <>
          <Divider />
          <DataSourceSlot source={dataSource} />
        </>
      )}

      {/* Workflow Step Slot (conditional) */}
      {workflowStep && (
        <>
          <Divider />
          <WorkflowStepSlot
            current={workflowStep.current}
            total={workflowStep.total}
          />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Network Status Slot (right-aligned) */}
      <NetworkStatusSlot status={networkStatus} />
    </footer>
  );
}

export default StatusBar;
