/**
 * @settlegrid/client — public barrel.
 *
 * Exports:
 *   - `createSettleGridClient(config)` — primary entry point
 *   - Error classes (for branching on `err instanceof ...`)
 *   - Public types (RailName, WalletRef, CallOptions, AcceptEntry, etc.)
 *   - `railForScheme(scheme)` — helper for callers that inspect a
 *     manifest directly
 *
 * Internal modules (http, protocols, client's __internal__) are NOT
 * re-exported — callers depend on the public surface only.
 */

export { createSettleGridClient } from './client'

export {
  BudgetExceededError,
  ClientConfigurationError,
  MalformedManifestError,
  NoSupportedProtocolError,
  UnexpectedStatusError,
} from './errors'

export { railForScheme } from './types'

export type {
  AcceptEntry,
  CallOptions,
  PaymentRequiredBody,
  RailName,
  ResourceDescriptor,
  SettleGridClient,
  SettleGridClientConfig,
  WalletRef,
} from './types'
