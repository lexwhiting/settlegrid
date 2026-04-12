/**
 * @settlegrid/mcp - The Settlement Layer for the AI Economy
 *
 * SDK for monetizing MCP tool servers with per-invocation billing.
 * Turn any MCP tool into a paid API in 5 minutes.
 *
 * @example
 * ```typescript
 * import { settlegrid } from '@settlegrid/mcp'
 *
 * const sg = settlegrid.init({
 *   toolSlug: 'my-tool',
 *   pricing: { defaultCostCents: 1, methods: { 'expensive-op': { costCents: 5 } } },
 * })
 *
 * // Wrap individual tool handlers
 * const myHandler = sg.wrap(async (args) => {
 *   return { result: 'Hello!' }
 * }, { method: 'my-method' })
 * ```
 *
 * @packageDocumentation
 */

import { normalizeConfig, validatePricingConfig } from './config'
import { createMiddleware, extractApiKey } from './middleware'
import type {
  GeneralizedPricingConfig,
  PricingConfig,
  SettleGridConfig,
  WrapOptions,
} from './types'

// ─── Version ─────────────────────────────────────────────────────────────────

/**
 * SDK version string. Matches the version in package.json.
 * Use this to verify the installed SDK version programmatically.
 *
 * @example
 * ```typescript
 * import { SDK_VERSION } from '@settlegrid/mcp'
 * console.log(`SettleGrid SDK v${SDK_VERSION}`)
 * ```
 */
export const SDK_VERSION = '0.1.1' as const

// ─── Error re-exports ────────────────────────────────────────────────────────

export {
  InvalidKeyError,
  InsufficientCreditsError,
  SettleGridError,
  ToolNotFoundError,
  ToolDisabledError,
  RateLimitedError,
  SettleGridUnavailableError,
  NetworkError,
  TimeoutError,
} from './errors'

// ─── Type re-exports ─────────────────────────────────────────────────────────

export type {
  SettleGridConfig,
  PricingConfig,
  MethodPricing,
  WrapOptions,
  KeyValidationResult,
  MeterResult,
  SettleGridErrorCode,
  InvocationContext,
  GeneralizedPricingConfig,
  PricingModel,
  ValidateKeyResponse,
  MeterResponse,
} from './types'

export type { NormalizedConfig } from './config'

// ─── Initialization types ────────────────────────────────────────────────────

/**
 * Options for initializing a SettleGrid instance.
 * Extends {@link SettleGridConfig} with required pricing configuration.
 *
 * @example
 * ```typescript
 * const options: InitOptions = {
 *   toolSlug: 'my-tool',
 *   pricing: {
 *     defaultCostCents: 1,
 *     methods: {
 *       search: { costCents: 2 },
 *       analyze: { costCents: 10, displayName: 'Deep Analysis' },
 *     },
 *   },
 *   debug: true,
 *   timeoutMs: 10000,
 * }
 * ```
 */
export interface InitOptions extends SettleGridConfig {
  /**
   * Pricing configuration for the tool (required).
   *
   * Accepts either the legacy {@link PricingConfig} (per-invocation) or
   * the generalized {@link GeneralizedPricingConfig} with one of the
   * six pricing models (per-invocation, per-token, per-byte, per-second,
   * tiered, outcome). When a non-invocation model is used, callers
   * should pass `units` through {@link WrapOptions.units} on `sg.wrap()`
   * to bill the correct multiple of `defaultCostCents`.
   */
  pricing: PricingConfig | GeneralizedPricingConfig
}

/**
 * An initialized SettleGrid SDK instance returned by {@link settlegrid.init}.
 *
 * Provides methods to wrap handlers with billing, validate API keys,
 * meter invocations, and manage the validation cache.
 *
 * @example
 * ```typescript
 * const sg: SettleGridInstance = settlegrid.init({
 *   toolSlug: 'my-tool',
 *   pricing: { defaultCostCents: 1 },
 * })
 *
 * // Wrap a handler
 * const billed = sg.wrap(myHandler, { method: 'search' })
 *
 * // Validate a key manually
 * const { valid, balanceCents } = await sg.validateKey('sg_live_abc')
 * ```
 */
export interface SettleGridInstance {
  /**
   * Wrap a handler function with SettleGrid billing.
   * The returned function extracts the API key from context, validates it,
   * checks credits, executes your handler, and meters the invocation.
   *
   * @typeParam TArgs - The argument type your handler expects
   * @typeParam TResult - The return type of your handler
   * @param handler - Your tool handler function
   * @param options - Optional wrap configuration (method name, cost override)
   * @returns A wrapped function that enforces billing before executing
   *
   * @example
   * ```typescript
   * const search = sg.wrap(
   *   async (args: { query: string }) => {
   *     const results = await performSearch(args.query)
   *     return { results }
   *   },
   *   { method: 'search' }
   * )
   *
   * // Call the wrapped handler (API key extracted from context)
   * const result = await search(
   *   { query: 'hello' },
   *   { headers: { 'x-api-key': 'sg_live_abc' } }
   * )
   * ```
   */
  wrap<TArgs, TResult>(
    handler: (args: TArgs) => Promise<TResult> | TResult,
    options?: WrapOptions
  ): (
    args: TArgs,
    context?: {
      headers?: Record<string, string | string[] | undefined>
      metadata?: Record<string, unknown>
    }
  ) => Promise<TResult>

  /**
   * Validate an API key and return the consumer's identity and balance.
   *
   * @param apiKey - The consumer's API key (e.g. 'sg_live_abc123')
   * @returns Validation result with consumer ID and current balance
   * @throws {InvalidKeyError} If the API key is empty or whitespace-only
   *
   * @example
   * ```typescript
   * const result = await sg.validateKey('sg_live_abc123')
   * if (result.valid) {
   *   console.log(`Consumer ${result.consumerId} has ${result.balanceCents} cents`)
   * }
   * ```
   */
  validateKey(apiKey: string): Promise<{
    valid: boolean
    consumerId: string
    balanceCents: number
  }>

  /**
   * Manually meter an invocation (validate key, check credits, deduct balance).
   * Use this for advanced scenarios where `wrap()` doesn't fit your architecture.
   *
   * @param apiKey - The consumer's API key
   * @param method - The method name to bill for (must match your pricing config)
   * @returns Metering result with cost charged and remaining balance
   * @throws {InvalidKeyError} If the API key is invalid or empty
   *
   * @example
   * ```typescript
   * const result = await sg.meter('sg_live_abc123', 'search')
   * console.log(`Charged ${result.costCents}c, remaining: ${result.remainingBalanceCents}c`)
   * ```
   */
  meter(
    apiKey: string,
    method: string
  ): Promise<{
    success: boolean
    remainingBalanceCents: number
    costCents: number
  }>

  /**
   * Clear the in-memory key validation cache.
   * Call this when you know keys have been rotated or balances have changed.
   *
   * @example
   * ```typescript
   * sg.clearCache()
   * ```
   */
  clearCache(): void
}

// ─── Main SDK namespace ──────────────────────────────────────────────────────

/**
 * SettleGrid SDK namespace. The main entry point for the SDK.
 *
 * @example
 * ```typescript
 * import { settlegrid } from '@settlegrid/mcp'
 *
 * // Initialize
 * const sg = settlegrid.init({
 *   toolSlug: 'my-tool',
 *   pricing: { defaultCostCents: 1 },
 * })
 *
 * // Check SDK version
 * console.log(settlegrid.version) // '0.1.0'
 *
 * // Extract API key from headers/metadata
 * const key = settlegrid.extractApiKey(headers, metadata)
 * ```
 */
export const settlegrid = {
  /**
   * Current SDK version string.
   *
   * @example
   * ```typescript
   * console.log(`Using SettleGrid SDK v${settlegrid.version}`)
   * ```
   */
  version: SDK_VERSION,

  /**
   * Initialize a new SettleGrid instance for billing tool invocations.
   *
   * @param options - Configuration including tool slug and pricing
   * @returns An initialized {@link SettleGridInstance} with wrap, validateKey, meter, and clearCache methods
   * @throws {Error} If toolSlug is missing or empty
   * @throws {Error} If pricing is missing
   * @throws {z.ZodError} If configuration values are invalid (bad URL, timeout out of range, etc.)
   *
   * @example
   * ```typescript
   * const sg = settlegrid.init({
   *   toolSlug: 'my-tool',
   *   pricing: {
   *     defaultCostCents: 1,
   *     methods: { search: { costCents: 5 } },
   *   },
   * })
   * ```
   */
  init(options: InitOptions): SettleGridInstance {
    // Input validation with actionable error messages
    if (!options) {
      throw new Error(
        'settlegrid.init() requires an options object. Example:\n' +
        '  settlegrid.init({ toolSlug: "my-tool", pricing: { defaultCostCents: 1 } })'
      )
    }
    if (!options.toolSlug || typeof options.toolSlug !== 'string' || !options.toolSlug.trim()) {
      throw new Error(
        'settlegrid.init() requires a non-empty toolSlug string. ' +
        'This must match the slug you registered at https://settlegrid.ai/tools. ' +
        `Received: ${JSON.stringify(options.toolSlug)}`
      )
    }
    if (!options.pricing || typeof options.pricing !== 'object') {
      throw new Error(
        'settlegrid.init() requires a pricing object. Example:\n' +
        '  pricing: { defaultCostCents: 1, methods: { search: { costCents: 5 } } }\n' +
        `Received: ${JSON.stringify(options.pricing)}`
      )
    }

    const config = normalizeConfig(options)
    const pricing = validatePricingConfig(options.pricing)
    const middleware = createMiddleware(config, pricing)

    return {
      wrap<TArgs, TResult>(
        handler: (args: TArgs) => Promise<TResult> | TResult,
        wrapOptions?: WrapOptions
      ) {
        if (typeof handler !== 'function') {
          throw new Error(
            'sg.wrap() requires a function as the first argument. ' +
            `Received: ${typeof handler}`
          )
        }

        const method = wrapOptions?.method ?? 'default'
        const units = wrapOptions?.units

        return async (
          args: TArgs,
          context?: {
            headers?: Record<string, string | string[] | undefined>
            metadata?: Record<string, unknown>
          }
        ): Promise<TResult> => {
          const apiKey = extractApiKey(context?.headers, context?.metadata)
          if (!apiKey) {
            const { InvalidKeyError } = await import('./errors')
            throw new InvalidKeyError(
              'No API key provided. Include one of:\n' +
              '  - x-api-key header\n' +
              '  - Authorization: Bearer <key> header\n' +
              '  - settlegrid-api-key in MCP metadata'
            )
          }

          return middleware.execute(apiKey, method, () => handler(args), units)
        }
      },

      async validateKey(apiKey: string) {
        if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
          const { InvalidKeyError } = await import('./errors')
          throw new InvalidKeyError(
            'validateKey() requires a non-empty API key string. ' +
            `Received: ${JSON.stringify(apiKey)}`
          )
        }

        const result = await middleware.validateKey(apiKey)
        return {
          valid: result.valid,
          consumerId: result.consumerId,
          balanceCents: result.balanceCents,
        }
      },

      async meter(apiKey: string, method: string) {
        if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
          const { InvalidKeyError } = await import('./errors')
          throw new InvalidKeyError(
            'meter() requires a non-empty API key string. ' +
            `Received: ${JSON.stringify(apiKey)}`
          )
        }
        if (!method || typeof method !== 'string' || !method.trim()) {
          throw new Error(
            'meter() requires a non-empty method name string. ' +
            'This should match a method in your pricing config. ' +
            `Received: ${JSON.stringify(method)}`
          )
        }

        const validation = await middleware.validateKey(apiKey)
        if (!validation.valid) {
          const { InvalidKeyError } = await import('./errors')
          throw new InvalidKeyError()
        }

        const costCheck = middleware.checkCredits(validation.balanceCents, method)
        const result = await middleware.meter({
          consumerId: validation.consumerId,
          toolId: validation.toolId,
          keyId: validation.keyId,
          method,
          costCents: costCheck.costCents,
          startTime: Date.now(),
        })

        return {
          success: result.success,
          remainingBalanceCents: result.remainingBalanceCents,
          costCents: result.costCents,
        }
      },

      clearCache() {
        middleware.clearCache()
      },
    }
  },

  extractApiKey,
}

export default settlegrid

// ─── Phase 2: REST middleware, Payment capability, Server card ───────────────

export { settlegridMiddleware } from './rest'
export type { RestMiddlewareOptions } from './rest'

export {
  createPaymentCapability,
  PAYMENT_ERROR_CODES,
} from './payment-capability'
export type {
  PaymentCapability,
  PaymentMeta,
  PaymentResultMeta,
} from './payment-capability'

export {
  generateServerCardBilling,
  generateServerCard,
} from './server-card'
export type {
  ServerCardBilling,
  ServerCardPricingMethod,
  MCPServerCard,
} from './server-card'

// ─── Additional exports for advanced usage ───────────────────────────────────

export { extractApiKey } from './middleware'
export { normalizeConfig, validatePricingConfig, getMethodCost, resolveOperationCost } from './config'
export { pricingConfigSchema, generalizedPricingConfigSchema } from './config'
export { LRUCache } from './cache'
