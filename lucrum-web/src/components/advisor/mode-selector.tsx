"use client";

/**
 * Mode Selector Component
 *
 * Allows users to select chat mode (quick, deep, debate, diagnose)
 * and master agent perspective
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { ChatMode } from '@/lib/advisor/agent/types';
import { getChatModeOptions, getAgentOptions } from '@/lib/advisor';

// ============================================================================
// Component Props
// ============================================================================

interface ModeSelectorProps {
  selectedMode: ChatMode;
  selectedMaster?: string;
  onModeChange: (mode: ChatMode) => void;
  onMasterChange?: (masterId: string | undefined) => void;
  showMasterSelector?: boolean;
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function ModeSelector({
  selectedMode,
  selectedMaster,
  onModeChange,
  onMasterChange,
  showMasterSelector = true,
  className,
}: ModeSelectorProps) {
  const modeOptions = getChatModeOptions();
  const agentOptions = getAgentOptions();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode Selection */}
      <div>
        <div className="text-xs text-white/50 mb-2">选择分析模式</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {modeOptions.map((mode) => (
            <ModeCard
              key={mode.id}
              icon={mode.icon}
              name={mode.name}
              description={mode.description}
              tokenLimit={mode.tokenLimit}
              selected={selectedMode === mode.id}
              onClick={() => onModeChange(mode.id as ChatMode)}
            />
          ))}
        </div>
      </div>

      {/* Master Agent Selection */}
      {showMasterSelector && onMasterChange && (
        <div>
          <div className="text-xs text-white/50 mb-2">大师视角（可选）</div>
          <div className="flex flex-wrap gap-2">
            <MasterChip
              icon="🔄"
              name="标准分析"
              selected={!selectedMaster}
              onClick={() => onMasterChange(undefined)}
            />
            {agentOptions.masters.map((master) => (
              <MasterChip
                key={master.id}
                icon={master.icon}
                name={master.name}
                selected={selectedMaster === master.id}
                onClick={() => onMasterChange(master.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ModeCardProps {
  icon: string;
  name: string;
  description: string;
  tokenLimit: number;
  selected: boolean;
  onClick: () => void;
}

function ModeCard({
  icon,
  name,
  description,
  tokenLimit,
  selected,
  onClick,
}: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center p-3 rounded-lg border transition text-center',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-white/10 hover:border-white/30'
      )}
    >
      <span className="text-2xl mb-1">{icon}</span>
      <span className={cn(
        'text-sm font-medium',
        selected ? 'text-accent' : 'text-white'
      )}>
        {name}
      </span>
      <span className="text-xs text-white/50 mt-1 line-clamp-2">
        {description}
      </span>
      <span className="text-xs text-white/30 mt-2">
        ~{tokenLimit} tokens
      </span>
    </button>
  );
}

interface MasterChipProps {
  icon: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}

function MasterChip({ icon, name, selected, onClick }: MasterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition',
        selected
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
          : 'bg-white/5 text-white/70 border border-white/10 hover:border-white/30'
      )}
    >
      <span>{icon}</span>
      <span>{name}</span>
    </button>
  );
}

// ============================================================================
// Compact Mode Selector
// ============================================================================

interface CompactModeSelectorProps {
  selectedMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  className?: string;
}

export function CompactModeSelector({
  selectedMode,
  onModeChange,
  className,
}: CompactModeSelectorProps) {
  const modeOptions = getChatModeOptions();
  const currentMode = modeOptions.find(m => m.id === selectedMode);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {modeOptions.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id as ChatMode)}
          title={mode.description}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-sm transition',
            selectedMode === mode.id
              ? 'bg-accent/20 text-accent'
              : 'text-white/50 hover:text-white hover:bg-white/10'
          )}
        >
          <span>{mode.icon}</span>
          <span className="hidden md:inline">{mode.name}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Mode Badge
// ============================================================================

interface ModeBadgeProps {
  mode: ChatMode;
  master?: string;
  className?: string;
}

export function ModeBadge({ mode, master, className }: ModeBadgeProps) {
  const modeOptions = getChatModeOptions();
  const agentOptions = getAgentOptions();

  const currentMode = modeOptions.find(m => m.id === mode);
  const currentMaster = master
    ? agentOptions.masters.find(m => m.id === master)
    : null;

  return (
    <div className={cn('flex items-center gap-1 text-xs', className)}>
      <span className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-white/10 text-white/70'
      )}>
        <span>{currentMode?.icon}</span>
        <span>{currentMode?.name}</span>
      </span>
      {currentMaster && (
        <span className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full',
          'bg-amber-500/10 text-amber-400'
        )}>
          <span>{currentMaster.icon}</span>
          <span>{currentMaster.name}</span>
        </span>
      )}
    </div>
  );
}

export default ModeSelector;
