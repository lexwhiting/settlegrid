/**
 * Types for multi-hop workflow sessions and settlement batches.
 */

export type SettlementMode = 'immediate' | 'deferred' | 'atomic'

export type SessionStatus =
  | 'active'
  | 'finalizing'
  | 'settled'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled'

export interface SessionHop {
  hopId: string
  serviceId: string
  toolId: string
  method: string
  costCents: number
  timestamp: string // ISO 8601
  status: 'pending' | 'success' | 'failed'
  latencyMs: number | null
  metadata: Record<string, unknown> | null
}

export interface SessionDisbursement {
  developerId: string
  toolId: string
  amountCents: number
  platformFeeCents: number
  stripeTransferId: string | null
  status: 'pending' | 'completed' | 'failed'
}

export type BatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rolled_back'

export interface RecordHopInput {
  serviceId: string
  toolId: string
  method: string
  costCents: number
  latencyMs?: number
  metadata?: Record<string, unknown>
  // ─── P3.K4 unified-ledger extension ────────────────────────────
  // When `rail` + `protocol` + `accountId` are all provided,
  // recordHop also writes a settlement row to ledger_entries via
  // recordSettlementEntryAsync. Missing any of these → the unified
  // write is skipped silently and only the legacy hops-JSONB +
  // spentCents update runs. Existing callers that don't populate
  // these fields continue to work unchanged.
  /** CAIP-style rail identifier ('stripe-connect', 'internal', ...). */
  rail?: string
  /** Protocol scheme used for the settlement ('mpp', 'l402', ...). */
  protocol?: string
  /** UUID of the account the settlement credits (provider's account). */
  accountId?: string
  /** Platform take in basis points. Defaults to 0 when omitted. */
  takeBps?: number
  /** ISO-4217 currency code. Defaults to 'USD' when omitted. */
  currency?: string
  /** Rail-native external reference (Stripe pi_..., L402 hash, etc.). */
  externalRef?: string
}

export interface FinalizeResult {
  batchId: string | null
  totalSettledCents: number
}
