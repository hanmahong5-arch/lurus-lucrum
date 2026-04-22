/**
 * Factor registry — global map of FactorId → FactorDefinition.
 *
 * Factors register themselves on module import via `registerFactor`.
 * Callers look up by id or iterate by category.
 *
 * @module lib/factors/registry
 */

import type {
  FactorCategory,
  FactorDefinition,
  FactorId,
} from './types';

const registry = new Map<FactorId, FactorDefinition>();

export function registerFactor(def: FactorDefinition): void {
  if (registry.has(def.id)) {
    // Second registration is almost always a hot-reload duplicate;
    // replacing is safer than throwing.
    registry.set(def.id, def);
    return;
  }
  registry.set(def.id, def);
}

export function getFactor(id: FactorId): FactorDefinition | undefined {
  return registry.get(id);
}

export function listFactors(): ReadonlyArray<FactorDefinition> {
  return Array.from(registry.values());
}

export function listFactorsByCategory(
  category: FactorCategory
): ReadonlyArray<FactorDefinition> {
  return listFactors().filter((f) => f.category === category);
}

export function listFactorIds(): ReadonlyArray<FactorId> {
  return Array.from(registry.keys());
}

/** Test-only: drop every registration. Does not affect module-load side effects. */
export function _clearRegistry(): void {
  registry.clear();
}
