/**
 * Risk Disclaimer Components
 * 风险声明组件
 *
 * Investment risk warning and agreement checkbox for auth pages.
 * 用于认证页面的投资风险提示和协议同意复选框。
 */

"use client";

import { useState } from "react";
import { AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskDisclaimerProps {
  className?: string;
  compact?: boolean;
}

/**
 * Risk Disclaimer Panel - Displays investment risk warnings
 * 风险声明面板 - 显示投资风险提示
 */
export function RiskDisclaimer({ className, compact = false }: RiskDisclaimerProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  return (
    <div
      className={cn(
        "p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="font-bold text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          投资风险提示 | Investment Risk Warning
        </h3>
        {compact && (
          <span className="text-amber-400/60">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        )}
      </button>

      {isExpanded && (
        <ul className="mt-3 text-sm text-slate-300 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            <span>
              本平台提供的分析和建议仅供参考，<strong className="text-amber-400">不构成投资建议</strong>。
              <br />
              <span className="text-slate-400 text-xs">
                Analysis and suggestions provided are for reference only and do NOT constitute investment advice.
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            <span>
              股票投资有风险，<strong className="text-amber-400">入市需谨慎</strong>。过往业绩不代表未来收益。
              <br />
              <span className="text-slate-400 text-xs">
                Stock investment carries risks. Past performance does not guarantee future results.
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            <span>
              历史回测结果仅供策略评估参考，<strong className="text-amber-400">不代表实际交易表现</strong>。
              <br />
              <span className="text-slate-400 text-xs">
                Backtest results are for strategy evaluation only and do not represent actual trading performance.
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            <span>
              AI分析可能存在误差，请<strong className="text-amber-400">独立判断</strong>并自行承担投资风险。
              <br />
              <span className="text-slate-400 text-xs">
                AI analysis may contain errors. Please make independent judgments and bear investment risks yourself.
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            <span>
              请根据自身<strong className="text-amber-400">风险承受能力</strong>理性投资，量力而行。
              <br />
              <span className="text-slate-400 text-xs">
                Please invest rationally according to your own risk tolerance and financial capability.
              </span>
            </span>
          </li>
        </ul>
      )}
    </div>
  );
}

interface RiskAgreementCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Risk Agreement Checkbox - User must agree to proceed
 * 风险协议复选框 - 用户必须同意才能继续
 */
export function RiskAgreementCheckbox({
  checked,
  onChange,
  className,
  disabled = false,
}: RiskAgreementCheckboxProps) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input
        type="checkbox"
        id="risk-agreement"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 rounded border-slate-600 bg-slate-700/50 text-amber-500 focus:ring-amber-500/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        required
      />
      <label
        htmlFor="risk-agreement"
        className={cn(
          "text-sm text-slate-400 cursor-pointer select-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        我已阅读并理解上述
        <span className="text-amber-400 font-medium mx-1">投资风险提示</span>
        ，确认自愿承担投资风险
        <br />
        <span className="text-xs text-slate-500">
          I have read and understood the investment risk warnings, and voluntarily accept the investment risks
        </span>
      </label>
    </div>
  );
}

/**
 * Compact Risk Notice - For display in headers or footers
 * 紧凑风险提示 - 用于在页头或页脚显示
 */
export function CompactRiskNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-amber-400/80",
        className
      )}
    >
      <Info className="w-3 h-3 flex-shrink-0" />
      <span>投资有风险，入市需谨慎 | Investment carries risks</span>
    </div>
  );
}
