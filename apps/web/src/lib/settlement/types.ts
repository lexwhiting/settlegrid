/**
 * Core settlement types — protocol-agnostic
 * All protocols normalize to these types before reaching the settlement engine.
 */

// ─── Payment Context (normalized from any protocol) ──────────────────────────

export type ProtocolName = 'mcp' | 'x402' | 'ap2' | 'visa-tap' | 'mpp' | 'ucp' | 'acp' | 'mastercard-vi' | 'circle-nano'

export type IdentityType = 'api-key' | 'did:key' | 'jwt' | 'x509' | 'tap-token' | 'mpp-session' | 'ucp-session' | 'spt' | 'sd-jwt' | 'eip3009'

export type PaymentType =
  | 'credit-balance'    // Pre-funded SettleGrid credits (existing model)
  | 'eip3009'           // x402 exact scheme (EIP-3009 transferWithAuthorization)
  | 'permit2'           // x402 upto scheme (Permit2 permitWitnessTransferFrom)
  | 'card-token'        // AP2/Visa TAP tokenized card
  | 'vdc'               // AP2 Verifiable Digital Credential
  | 'spt'               // Shared Payment Token (Stripe — MPP/ACP)
  | 'crypto'            // Tempo blockchain (MPP)
  | 'payment-handler'   // UCP merchant-selected handler (Google Pay, Shop Pay, Stripe, etc.)
  | 'agentic-token'     // Mastercard Agentic Tokens (SD-JWT delegation chain)
  | 'nanopayment'       // Circle Nanopayments (off-chain aggregation, on-chain batch)

export interface PaymentContext {
  protocol: ProtocolName
  identity: {
    type: IdentityType
    value: string           // API key, DID, JWT, cert fingerprint, TAP token
    metadata?: Record<string, unknown>
  }
  operation: {
    service: string         // tool slug or service identifier
    method: string          // method name within the service
    params?: unknown        // operation parameters (for logging/analytics, not billing)
  }
  payment: {
    type: PaymentType
    amount?: {
      value: bigint         // amount in smallest unit (cents for USD, wei for ETH)
      currency: string      // 'USD' | 'USDC' | etc.
    }
    proof?: string          // EIP-712 signature, JWT, etc.
    maxAmount?: {
      value: bigint
      currency: string
    }
  }
  session?: {
    id: string
    parentId?: string
  }
  requestId: string         // idempotency key
}

// ─── Settlement Result ───────────────────────────────────────────────────────

export type SettlementStatus =
  | 'settled'           // Operation completed and funds moved
  | 'pending'           // Operation recorded, settlement deferred (netting)
  | 'rejected'          // Insufficient funds, budget exceeded, or fraud
  | 'failed'            // System error during settlement

export interface SettlementResult {
  status: SettlementStatus
  operationId: string       // UUID of the recorded operation
  costCents: number         // actual cost charged
  remainingBalanceCents?: number  // for credit-balance payments
  txHash?: string           // for on-chain settlements
  receipt?: string          // signed receipt (x402 offer-and-receipt)
  error?: {
    code: string            // machine-readable error code
    message: string         // human-readable error message
    retryable: boolean
  }
  metadata: {
    protocol: ProtocolName
    latencyMs: number
    settlementType: 'real-time' | 'batched'
  }
}

// ─── Protocol Adapter Interface ──────────────────────────────────────────────

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

// ─── Pricing Model (generalized) ────────────────────────────────────────────

export type PricingModel =
  | 'per-invocation'    // fixed cost per call (current model)
  | 'per-token'         // cost per token (LLM proxies)
  | 'per-byte'          // cost per byte transferred (data services)
  | 'per-second'        // cost per second of compute (long-running tasks)
  | 'tiered'            // volume-based tiers
  | 'outcome'           // pay only on successful outcome

export interface GeneralizedPricingConfig {
  model: PricingModel
  defaultCostCents: number
  currencyCode: string  // 'USD' default
  methods?: Record<string, {
    costCents: number
    unitType?: string   // override unit type per method
    displayName?: string
  }>
  tiers?: Array<{
    upTo: number        // number of units in this tier
    costCents: number   // cost per unit in this tier
  }>
  outcomeConfig?: {
    successCostCents: number
    failureCostCents: number  // usually 0
    successCondition: string  // JSONPath or simple field check
  }
}

// ─── Session & Budget Delegation ─────────────────────────────────────────────

export interface SessionCreateParams {
  customerId: string
  budgetCents: number
  expiresIn?: number        // seconds; default 3600 (1 hour)
  parentSessionId?: string  // for delegation
  protocol?: ProtocolName   // restrict to specific protocol
  orgId?: string            // organization ID for budget enforcement
  metadata?: Record<string, unknown>
}

export interface SessionDelegateParams {
  sessionId: string
  budgetCents: number       // must be <= parent's remaining budget
  agentId: string           // agent identity receiving the delegation
  expiresIn?: number        // must be <= parent's remaining TTL
  metadata?: Record<string, unknown>
}

export interface SessionState {
  id: string
  customerId: string
  parentSessionId: string | null
  budgetCents: number
  spentCents: number
  reservedCents: number     // delegated to children
  availableCents: number    // budget - spent - reserved
  status: 'active' | 'completed' | 'expired' | 'cancelled'
  expiresAt: string | null
  children: SessionState[]  // recursive child sessions
}

// ─── Agent Identity (KYA) ────────────────────────────────────────────────────

export interface AgentFactsProfile {
  /** Category 1: Core Identity */
  coreIdentity: {
    id: string              // SettleGrid agent ID or DID
    name: string
    version: string
    provider: string        // developer/provider name
    ttl: number             // seconds until profile refresh
  }
  /** Category 2: Capabilities */
  capabilities: {
    tools: string[]         // tool slugs this agent can access
    methods: string[]       // methods within tools
    pricing: GeneralizedPricingConfig
    protocols: ProtocolName[]
  }
  /** Category 3: Authentication & Permissions */
  authPermissions: {
    authTypes: IdentityType[]
    rateLimits: { requestsPerMinute: number; requestsPerDay: number }
    spendingLimits: { perSession: number; perDay: number; currency: string }
  }
  /** Category 4: Verification */
  verification: {
    level: 'none' | 'basic' | 'business' | 'individual'
    verifiedAt?: string     // ISO timestamp
    signature?: string      // Ed25519 signature over the profile
    trustScore: number      // 0-100, computed from history
  }
}

// ─── Ledger Types ────────────────────────────────────────────────────────────

export type LedgerCategory =
  | 'metering'    // Tool invocation charge
  | 'purchase'    // Credit top-up
  | 'payout'      // Provider payout
  | 'refund'      // Refund to customer
  | 'fee'         // Platform fee
  | 'netting'     // Batch settlement netting
  | 'delegation'  // Budget delegation to child session

export type AccountType = 'provider' | 'customer' | 'platform' | 'escrow'

export type EntryType = 'debit' | 'credit'
