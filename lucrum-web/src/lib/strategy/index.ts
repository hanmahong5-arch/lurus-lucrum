/**
 * Strategy Module
 * 策略模块
 *
 * Exports all strategy-related utilities including parameter parsing,
 * code generation, and validation.
 *
 * @module lib/strategy
 */

export {
  // Parser functions
  parseStrategyParameters,
  updateStrategyCode,
  validateParameter,
  validateAllParameters,
  groupParametersByCategory,
  getCategoryDisplayName,

  // Types
  type ParameterType,
  type StrategyParameter,
  type ParameterCategory,
  type ParameterRange,
  type IndicatorConfig,
  type IndicatorType,
  type ParsedStrategyResult,
} from "./parameter-parser";

// =============================================================================
// VERSION MANAGEMENT
// =============================================================================

export {
  createVersion,
  generateVersionDescription,
  computeVersionDiff,

  // Types
  type StrategyVersion,
  type ParamChange,
  type ParamChangeType,
  type VersionDiff,
} from "./version-manager";
