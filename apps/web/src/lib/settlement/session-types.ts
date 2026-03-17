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
}

export interface FinalizeResult {
  batchId: string | null
  totalSettledCents: number
}
