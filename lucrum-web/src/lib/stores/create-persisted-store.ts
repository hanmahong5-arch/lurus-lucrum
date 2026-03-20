/**
 * Persisted Store Factory
 *
 * Wraps Zustand stores with:
 * 1. `persist` middleware with localStorage
 * 2. User-scoped key: `lucrum:${userId}:${storeName}`
 * 3. Version migration support
 * 4. Optional `partialize` to exclude transient state (loading flags, errors)
 * 5. `onRehydrateStorage` callback for initialization
 * 6. `immer` middleware for immutable updates
 *
 * All persisted stores share a consistent pattern for user isolation
 * and hydration tracking.
 *
 * @module lib/stores/create-persisted-store
 */

import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating a persisted store.
 *
 * @template T - The full state type (state + actions)
 * @template P - The partialized state type (what gets persisted)
 */
export interface PersistedStoreOptions<T, P = Partial<T>> {
  /** Schema version for migration support. Increment when state shape changes. */
  version?: number;
  /**
   * Select which parts of state to persist. Transient fields (loading, errors)
   * should be excluded. If omitted, the entire state is persisted.
   */
  partialize?: (state: T) => P;
  /**
   * Migrate persisted state from an older version to the current schema.
   * Called when the stored version differs from the current version.
   */
  migrate?: (persistedState: unknown, version: number) => T;
  /**
   * Callback fired after hydration completes. Use to restore non-serializable
   * types (Date, Map, Set) or trigger side effects.
   */
  onRehydrateStorage?: (state: T | undefined) => void;
}

/**
 * Hydration state injected into every persisted store.
 * Components can check `_hasHydrated` before rendering to avoid
 * flash of empty/default state.
 */
export interface HydrationState {
  /** Whether the store has finished hydrating from localStorage */
  _hasHydrated: boolean;
  /** Internal setter - called automatically by the persist middleware */
  _setHasHydrated: (hydrated: boolean) => void;
}

// =============================================================================
// SSR-Safe Storage
// =============================================================================

/**
 * Returns localStorage when available, or a no-op fallback for SSR.
 */
function getSafeStorage() {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return localStorage;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a Zustand store with persist + immer middleware and hydration tracking.
 *
 * The localStorage key follows the pattern `lucrum:${storeName}`.
 * For user-scoped isolation, store the userId in the state and use
 * `partialize` to include it, or use the `getUserScopedKey` utility
 * from `@/lib/auth/with-user` in a custom storage adapter.
 *
 * @param name - Unique store identifier used as the localStorage key prefix
 * @param initializer - Zustand state creator (receives set, get, store)
 * @param options - Persistence configuration (version, partialize, migrate)
 * @returns A Zustand hook with persist + immer + hydration tracking
 *
 * @example
 * ```typescript
 * interface MyState {
 *   count: number;
 *   isLoading: boolean;
 *   increment: () => void;
 * }
 *
 * const useMyStore = createPersistedStore<MyState>(
 *   'my-store',
 *   (set) => ({
 *     count: 0,
 *     isLoading: false,
 *     increment: () => set((s) => { s.count += 1; }),
 *   }),
 *   {
 *     version: 1,
 *     partialize: (state) => ({ count: state.count }),
 *   }
 * );
 * ```
 */
export function createPersistedStore<T extends object>(
  name: string,
  initializer: StateCreator<T & HydrationState, [['zustand/immer', never], ['zustand/persist', unknown]]>,
  options?: PersistedStoreOptions<T & HydrationState>
) {
  const storageKey = `lucrum:${name}`;

  return create<T & HydrationState>()(
    persist(
      immer((...args) => {
        const [set] = args;
        const base = initializer(...args);
        return {
          ...base,
          _hasHydrated: false,
          _setHasHydrated: (hydrated: boolean) => {
            set((state) => {
              (state as T & HydrationState)._hasHydrated = hydrated;
            });
          },
        };
      }),
      {
        name: storageKey,
        version: options?.version,
        storage: createJSONStorage(() => getSafeStorage()),
        partialize: options?.partialize
          ? (state) => {
              const partialized = options.partialize!(state);
              return partialized as typeof state;
            }
          : undefined,
        migrate: options?.migrate
          ? (persistedState, version) => options.migrate!(persistedState, version)
          : undefined,
        onRehydrateStorage: () => (state) => {
          // Run custom rehydration callback first
          options?.onRehydrateStorage?.(state);

          // Mark hydration as complete
          if (state) {
            state._setHasHydrated(true);
          }
        },
      }
    )
  );
}
