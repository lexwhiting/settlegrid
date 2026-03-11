/**
 * @settlegrid/mcp - Type definitions
 * SDK types for the SettleGrid MCP monetization platform
 */

/** Pricing model for a tool method */
export interface MethodPricing {
  /** Cost in cents per invocation */
  costCents: number
  /** Optional display name */
  displayName?: string
}

/** Tool pricing configuration */
export interface PricingConfig {
  /** Default cost in cents if method not specified */
  defaultCostCents: number
  /** Per-method pricing overrides */
  methods?: Record<string, MethodPricing>
}

/** SettleGrid SDK configuration */
export interface SettleGridConfig {
  /** SettleGrid API base URL */
  apiUrl?: string
  /** Tool slug identifier */
  toolSlug: string
  /** Enable debug logging */
  debug?: boolean
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs?: number
}

/** Result of key validation */
export interface KeyValidationResult {
  valid: boolean
  consumerId: string
  toolId: string
  keyId: string
  balanceCents: number
}

/** Result of metering an invocation */
export interface MeterResult {
  success: boolean
  remainingBalanceCents: number
  costCents: number
  invocationId: string
}

/** Error codes returned by SettleGrid */
export type SettleGridErrorCode =
  | 'INVALID_KEY'
  | 'INSUFFICIENT_CREDITS'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_DISABLED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'

/** Middleware context passed through the invocation pipeline */
export interface InvocationContext {
  consumerId: string
  toolId: string
  keyId: string
  method: string
  costCents: number
  startTime: number
}

/** Options for the wrap() function */
export interface WrapOptions {
  /** Override the method name (defaults to the function name or 'default') */
  method?: string
  /** Override pricing for this specific wrapped function */
  costCents?: number
}

/** Internal API response types */
export interface ValidateKeyResponse {
  valid: boolean
  consumerId: string
  toolId: string
  keyId: string
  balanceCents: number
  error?: string
  code?: SettleGridErrorCode
}

export interface MeterResponse {
  success: boolean
  remainingBalanceCents: number
  costCents: number
  invocationId: string
  error?: string
  code?: SettleGridErrorCode
}
