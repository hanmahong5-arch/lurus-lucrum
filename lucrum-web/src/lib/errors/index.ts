/**
 * Unified error handling — public API surface.
 *
 * @module lib/errors
 */

export {
  type ErrorSeverity,
  type RecoveryAction,
  type AppError,
  type ApiErrorPayload,
  toAppError,
  parseApiError,
} from "./error-types";

export { ErrorCatalog } from "./error-catalog";
