/**
 * @settlegrid/mcp
 * The Settlement Layer for the AI Economy
 *
 * SDK for monetizing MCP tool servers with per-invocation billing.
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
 */

import { normalizeConfig, validatePricingConfig } from './config'
import { createMiddleware, extractApiKey } from './middleware'
import type { PricingConfig, SettleGridConfig, WrapOptions } from './types'

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
export type {
  SettleGridConfig,
  PricingConfig,
  MethodPricing,
  WrapOptions,
  KeyValidationResult,
  MeterResult,
  SettleGridErrorCode,
  InvocationContext,
} from './types'

/** Initialization options */
export interface InitOptions extends SettleGridConfig {
  /** Pricing configuration for the tool */
  pricing: PricingConfig
}

/** Initialized SettleGrid instance */
export interface SettleGridInstance {
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

  validateKey(apiKey: string): Promise<{
    valid: boolean
    consumerId: string
    balanceCents: number
  }>

  meter(
    apiKey: string,
    method: string
  ): Promise<{
    success: boolean
    remainingBalanceCents: number
    costCents: number
  }>

  clearCache(): void
}

/** SettleGrid SDK namespace */
export const settlegrid = {
  init(options: InitOptions): SettleGridInstance {
    const config = normalizeConfig(options)
    const pricing = validatePricingConfig(options.pricing)
    const middleware = createMiddleware(config, pricing)

    return {
      wrap<TArgs, TResult>(
        handler: (args: TArgs) => Promise<TResult> | TResult,
        wrapOptions?: WrapOptions
      ) {
        const method = wrapOptions?.method ?? 'default'

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
              'No API key provided. Include x-api-key header or settlegrid-api-key in metadata.'
            )
          }

          return middleware.execute(apiKey, method, () => handler(args))
        }
      },

      async validateKey(apiKey: string) {
        const result = await middleware.validateKey(apiKey)
        return {
          valid: result.valid,
          consumerId: result.consumerId,
          balanceCents: result.balanceCents,
        }
      },

      async meter(apiKey: string, method: string) {
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
