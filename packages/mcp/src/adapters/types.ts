/**
 * Protocol-adapter type subset for @settlegrid/mcp.
 *
 * Extracted from `apps/web/src/lib/settlement/types.ts` as part of P1.K1
 * (kernel extraction). Contains only the types referenced by the nine
 * protocol adapters — ledger/session/pricing types remain in the web app
 * and are NOT duplicated here to avoid drift.
 *
 * The seven types in this file are a transitively closed set:
 *
 *   ProtocolName       — enum of the 9 supported protocols
 *   IdentityType       — enum of the identity mechanisms adapters emit
 *   PaymentType        — enum of the payment instrument types
 *   PaymentContext     — normalized request-side payload (uses all three above)
 *   SettlementStatus   — enum of settlement outcome states
 *   SettlementResult   — normalized response-side payload
 *   ProtocolAdapter    — the interface every adapter implements
 *
 * @packageDocumentation
 */

// ─── Protocol enum ──────────────────────────────────────────────────────────

export type ProtocolName =
  | 'mcp'
  | 'x402'
  | 'ap2'
  | 'visa-tap'
  | 'mpp'
  | 'ucp'
  | 'acp'
  | 'mastercard-vi'
  | 'circle-nano'

// ─── Identity type (how the caller authenticates) ──────────────────────────

export type IdentityType =
  | 'api-key'
  | 'did:key'
  | 'jwt'
  | 'x509'
  | 'tap-token'
  | 'mpp-session'
  | 'ucp-session'
  | 'spt'
  | 'sd-jwt'
  | 'eip3009'

// ─── Payment instrument type ───────────────────────────────────────────────

export type PaymentType =
  | 'credit-balance' // Pre-funded SettleGrid credits (existing model)
  | 'eip3009' // x402 exact scheme (EIP-3009 transferWithAuthorization)
  | 'permit2' // x402 upto scheme (Permit2 permitWitnessTransferFrom)
  | 'card-token' // AP2/Visa TAP tokenized card
  | 'vdc' // AP2 Verifiable Digital Credential
  | 'spt' // Shared Payment Token (Stripe — MPP/ACP)
  | 'crypto' // Tempo blockchain (MPP)
  | 'payment-handler' // UCP merchant-selected handler (Google Pay, Shop Pay, Stripe, etc.)
  | 'agentic-token' // Mastercard Agentic Tokens (SD-JWT delegation chain)
  | 'nanopayment' // Circle Nanopayments (off-chain aggregation, on-chain batch)

// ─── Normalized request-side payload ───────────────────────────────────────

export interface PaymentContext {
  protocol: ProtocolName
  identity: {
    type: IdentityType
    value: string // API key, DID, JWT, cert fingerprint, TAP token
    metadata?: Record<string, unknown>
  }
  operation: {
    service: string // tool slug or service identifier
    method: string // method name within the service
    params?: unknown // operation parameters (for logging/analytics, not billing)
  }
  payment: {
    type: PaymentType
    amount?: {
      value: bigint // amount in smallest unit (cents for USD, wei for ETH)
      currency: string // 'USD' | 'USDC' | etc.
    }
    proof?: string // EIP-712 signature, JWT, etc.
    maxAmount?: {
      value: bigint
      currency: string
    }
  }
  session?: {
    id: string
    parentId?: string
  }
  requestId: string // idempotency key
}

// ─── Settlement outcome ────────────────────────────────────────────────────

export type SettlementStatus =
  | 'settled' // Operation completed and funds moved
  | 'pending' // Operation recorded, settlement deferred (netting)
  | 'rejected' // Insufficient funds, budget exceeded, or fraud
  | 'failed' // System error during settlement

export interface SettlementResult {
  status: SettlementStatus
  operationId: string // UUID of the recorded operation
  costCents: number // actual cost charged
  remainingBalanceCents?: number // for credit-balance payments
  txHash?: string // for on-chain settlements
  receipt?: string // signed receipt (x402 offer-and-receipt)
  error?: {
    code: string // machine-readable error code
    message: string // human-readable error message
    retryable: boolean
  }
  metadata: {
    protocol: ProtocolName
    latencyMs: number
    settlementType: 'real-time' | 'batched'
  }
}

// ─── Adapter interface ─────────────────────────────────────────────────────

export interface ProtocolAdapter {
  /** Protocol identifier */
  readonly name: ProtocolName

  /** Human-readable display name */
  readonly displayName: string

  /** Detect if this adapter should handle the request */
  canHandle(request: Request): boolean

  /** Extract payment context from protocol-specific request */
  extractPaymentContext(request: Request): Promise<PaymentContext>

  /** Format settlement result into protocol-specific response */
  formatResponse(result: SettlementResult, request: Request): Response

  /** Format error into protocol-specific error response */
  formatError(error: Error, request: Request): Response
}
