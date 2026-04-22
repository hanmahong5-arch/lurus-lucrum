/**
 * Side-effect module: importing this file registers all built-in factors.
 *
 * @module lib/factors/calculators
 */

import { MOMENTUM_FACTORS } from './momentum';
import { VOLATILITY_FACTORS } from './volatility';
import { LIQUIDITY_FACTORS } from './liquidity';
import { VALUE_FACTORS } from './value';
import { QUALITY_FACTORS } from './quality';
import type { FactorDefinition } from '../types';

export const BUILTIN_FACTORS: ReadonlyArray<FactorDefinition> = [
  ...MOMENTUM_FACTORS,
  ...VOLATILITY_FACTORS,
  ...LIQUIDITY_FACTORS,
  ...VALUE_FACTORS,
  ...QUALITY_FACTORS,
];

export {
  MOMENTUM_FACTORS,
  VOLATILITY_FACTORS,
  LIQUIDITY_FACTORS,
  VALUE_FACTORS,
  QUALITY_FACTORS,
};
