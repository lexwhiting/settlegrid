/**
 * @settlegrid/mcp - Type definitions
 * SDK types for the SettleGrid MCP monetization platform.
 *
 * @packageDocumentation
 */

/**
 * Pricing model for a single tool method.
 *
 * @example
 * ```typescript
 * const searchPricing: MethodPricing = {
 *   costCents: 2,
 *   displayName: 'Web Search',
 * }
 * ```
 */
export interface MethodPricing {
  /** Cost in cents per invocation (must be a non-negative integer) */
  costCents: number
  /** Human-readable display name shown in billing dashboards and server cards */
  displayName?: string
}

/**
 * Tool pricing configuration mapping methods to their per-invocation costs.
 *
 * @example
 * ```typescript
 * const pricing: PricingConfig = {
 *   defaultCostCents: 1,
 *   methods: {
 *     'search': { costCents: 2 },
 *     'deep-analyze': { costCents: 10, displayName: 'Deep Analysis' },
 *   },
 * }
 * ```
 */
export interface PricingConfig {
  /** Default cost in cents for methods without explicit pricing (must be a non-negative integer) */
  defaultCostCents: number
  /** Per-method pricing overrides keyed by method name */
  methods?: Record<string, MethodPricing>
}

/**
 * SettleGrid SDK configuration options.
 *
 * @example
 * ```typescript
 * const config: SettleGridConfig = {
 *   toolSlug: 'my-tool',
 *   apiUrl: 'https://settlegrid.ai',
 *   debug: false,
 *   cacheTtlMs: 300000,
 *   timeoutMs: 5000,
 * }
 * ```
 */
export interface SettleGridConfig {
  /** SettleGrid API base URL (defaults to 'https://settlegrid.ai') */
  apiUrl?: string
  /** Tool slug identifier (1-128 characters, must match the slug registered on SettleGrid) */
  toolSlug: string
  /** Enable debug logging and synchronous metering (defaults to false) */
  debug?: boolean
  /** Cache TTL in milliseconds for key validation results (defaults to 300000 / 5 minutes, set 0 to disable) */
  cacheTtlMs?: number
  /** Request timeout in milliseconds for API calls (defaults to 5000, range: 100-30000) */
  timeoutMs?: number
}

/**
 * Result of validating a consumer API key.
 *
 * @example
 * ```typescript
 * const result = await sg.validateKey('sg_live_abc123')
 * if (result.valid) {
 *   console.log(`Consumer ${result.consumerId} has ${result.balanceCents} cents`)
 * }
 * ```
 */
export interface KeyValidationResult {
  /** Whether the key is valid and active */
  valid: boolean
  /** Unique identifier for the consumer who owns this key */
  consumerId: string
  /** Unique identifier for the tool being accessed */
  toolId: string
  /** Unique identifier for this specific API key */
  keyId: string
  /** Consumer's current balance in cents */
  balanceCents: number
}

/**
 * Result of metering (billing) an invocation.
 *
 * @example
 * ```typescript
 * const result = await sg.meter('sg_live_abc123', 'search')
 * console.log(`Charged ${result.costCents}c, remaining: ${result.remainingBalanceCents}c`)
 * ```
 */
export interface MeterResult {
  /** Whether the metering operation succeeded */
  success: boolean
  /** Consumer's remaining balance in cents after this charge */
  remainingBalanceCents: number
  /** Amount charged in cents for this invocation */
  costCents: number
  /** Unique identifier for this metered invocation */
  invocationId: string
}

/**
 * Error codes returned by the SettleGrid API.
 * Use these to programmatically handle specific error conditions.
 */
export type SettleGridErrorCode =
  | 'INVALID_KEY'
  | 'INSUFFICIENT_CREDITS'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_DISABLED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'

/**
 * Middleware context passed through the invocation pipeline.
 * Contains all information needed to meter a single tool invocation.
 */
export interface InvocationContext {
  /** Consumer identifier (from key validation) */
  consumerId: string
  /** Tool identifier (from key validation) */
  toolId: string
  /** API key identifier (from key validation) */
  keyId: string
  /** Method name being invoked */
  method: string
  /** Cost in cents for this invocation */
  costCents: number
  /** Timestamp (ms since epoch) when the invocation started */
  startTime: number
}

/**
 * Options for the {@link SettleGridInstance.wrap} function.
 *
 * @example
 * ```typescript
 * const handler = sg.wrap(myFunction, {
 *   method: 'expensive-operation',
 *   costCents: 10,
 * })
 * ```
 */
export interface WrapOptions {
  /** Override the method name (defaults to 'default'). Must match a key in your pricing config for method-specific pricing. */
  method?: string
  /** Override pricing for this specific wrapped function (in cents) */
  costCents?: number
}

/** Internal API response for key validation */
export interface ValidateKeyResponse {
  valid: boolean
  consumerId: string
  toolId: string
  keyId: string
  balanceCents: number
  error?: string
  code?: SettleGridErrorCode
}

/** Internal API response for metering */
export interface MeterResponse {
  success: boolean
  remainingBalanceCents: number
  costCents: number
  invocationId: string
  error?: string
  code?: SettleGridErrorCode
}

// ─── Generalized Pricing (protocol-agnostic extension) ──────────────────────

/** Pricing model types beyond the original per-invocation model */
export type PricingModel =
  | 'per-invocation'    // fixed cost per call (current/default model)
  | 'per-token'         // cost per token (LLM proxies)
  | 'per-byte'          // cost per byte transferred (data services)
  | 'per-second'        // cost per second of compute (long-running tasks)
  | 'tiered'            // volume-based tiers
  | 'outcome'           // pay only on successful outcome

/** Generalized pricing config — superset of PricingConfig for backward compatibility */
export interface GeneralizedPricingConfig {
  model: PricingModel
  defaultCostCents: number
  currencyCode?: string  // 'USD' default
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
