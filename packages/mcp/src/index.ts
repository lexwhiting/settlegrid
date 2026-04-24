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
import {
  beginInvocation as _beginInvocation,
  settleInvocation as _settleInvocation,
  voidInvocation as _voidInvocation,
  heartbeat as _heartbeat,
} from './lifecycle'
import type { BeginInvocationOptions, SettleInvocationOptions } from './lifecycle'
import type {
  GeneralizedPricingConfig,
  Invocation,
  MeterContext,
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
export const SDK_VERSION = '0.2.0' as const

// ─── Error re-exports ────────────────────────────────────────────────────────

export {
  InvalidKeyError,
  InsufficientCreditsError,
  BudgetExceededError,
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
  // P2.K4 — typed MeterContext + Invocation lifecycle
  MeterContext,
  Invocation,
} from './types'

export type { NormalizedConfig } from './config'

// ─── Template manifest schema (P2.6) ─────────────────────────────────────────

export {
  templateManifestSchema,
  validateTemplateManifest,
  safeValidateTemplateManifest,
} from './template-schema'
export type { TemplateManifest } from './template-schema'

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
    // P2.K4 spec-diff: the type literally says "Update sg.wrap to
    // accept MeterContext as second arg type". Two readings:
    //
    //   (A) sg.wrap's second arg itself accepts MeterContext.
    //   (B) The call chain's second arg — i.e., the wrapped
    //       function's `context` — accepts MeterContext.
    //
    // The "typecheck-only, runtime unchanged" qualifier in the spec
    // forbids replacing WrapOptions (method / costCents / units are
    // load-bearing at wrap-time and the runtime reads them). So we
    // satisfy both readings with an intersection: at wrap-time, the
    // caller may pass any subset of WrapOptions AND any subset of
    // MeterContext.
    //
    // WARNING (hostile-review M1): MeterContext fields passed HERE
    // (at wrap-time) are TYPE-ONLY in P2.K4. The middleware only
    // destructures `method` / `costCents` / `units` from these
    // options — `apiKey` / `sessionId` / `maxCostCents` / `headers` /
    // `metadata` / `mcpMeta` set at wrap-time are SILENTLY IGNORED
    // until P3.K1 wires them as defaults for the per-call context.
    // If you need request-time context today, pass it on the
    // returned wrapper's second arg (see `context?: MeterContext`
    // below) — that arg IS read by the middleware.
    options?: WrapOptions & MeterContext
  ): (
    args: TArgs,
    // Reading (B): the wrapper's per-invocation second arg is
    // MeterContext. The middleware reads `headers` and `metadata`
    // from this object today. Other MeterContext fields (`apiKey`,
    // `sessionId`, `maxCostCents`, `mcpMeta`) are typed for forward
    // compat but also currently silently ignored — P3.K1 will wire
    // them through the lifecycle stubs.
    context?: MeterContext
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

  /**
   * P2.K4 — open an invocation against the supplied {@link MeterContext}.
   * Returns an {@link Invocation} record that can be advanced through
   * {@link SettleGridInstance.heartbeat} and finalized with
   * {@link SettleGridInstance.settleInvocation} or
   * {@link SettleGridInstance.voidInvocation}.
   *
   * **P2.K4 behavior**: throws `NOT_IMPLEMENTED — see P3.K1`. The shape
   * is frozen so consumers can write code against it; P3.K1 replaces
   * the throw with the real reservation + state-machine logic.
   */
  beginInvocation(
    meterContext: MeterContext,
    options?: BeginInvocationOptions,
  ): Invocation

  /**
   * P2.K4 — terminal success for an invocation: charge the consumer
   * and mark it settled.
   *
   * **P2.K4 behavior**: throws `NOT_IMPLEMENTED — see P3.K1`.
   */
  settleInvocation(
    invocation: Invocation,
    options?: SettleInvocationOptions,
  ): void

  /**
   * P2.K4 — terminal cancel for an invocation: release the
   * reservation, no charge, record the void reason.
   *
   * **P2.K4 behavior**: throws `NOT_IMPLEMENTED — see P3.K1`.
   */
  voidInvocation(invocation: Invocation, reason?: string): void

  /**
   * P2.K4 — periodic keep-alive for long-running invocations. P3.K1
   * will advance `heartbeatAt` on the invocation record.
   *
   * **P2.K4 behavior**: throws `NOT_IMPLEMENTED — see P3.K1`.
   */
  heartbeat(invocation: Invocation): void
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
        'settlegrid.init() requires a pricing object. Examples:\n' +
        '  // Legacy per-invocation:\n' +
        '  pricing: { defaultCostCents: 1, methods: { search: { costCents: 5 } } }\n' +
        '  // Generalized per-token:\n' +
        '  pricing: { model: "per-token", defaultCostCents: 1 }\n' +
        '  // See @settlegrid/mcp types for all six pricing models ' +
        '(per-invocation, per-token, per-byte, per-second, tiered, outcome).\n' +
        `Received: ${JSON.stringify(options.pricing)}`
      )
    }

    const config = normalizeConfig(options)
    const pricing = validatePricingConfig(options.pricing)
    const middleware = createMiddleware(config, pricing)

    const instance: SettleGridInstance = {
      wrap<TArgs, TResult>(
        handler: (args: TArgs) => Promise<TResult> | TResult,
        // Match the interface's `WrapOptions & MeterContext` widening
        // (see the JSDoc on SettleGridInstance.wrap). Runtime reads
        // only WrapOptions fields (method / costCents / units); the
        // MeterContext fields (apiKey / sessionId / etc.) are carried
        // at the type level for P3.K1.
        wrapOptions?: WrapOptions & MeterContext
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

          // Pass MCP metadata through to middleware.execute so it can
          // read context-bound fields (currently:
          // 'settlegrid-max-cost-cents') and validate them against a
          // single source of truth. Matches the P1.SDK4 spec literal:
          // "check whether context.metadata['settlegrid-max-cost-cents']
          // is set" — the check happens inside execute, which also
          // owns the validation and mapping to BudgetExceededError.
          return middleware.execute(
            apiKey,
            method,
            () => handler(args),
            units,
            context?.metadata,
          )
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

      // ── P2.K4 — Lifecycle API stubs ──────────────────────────────
      // Each method delegates to the corresponding module-level stub
      // in `./lifecycle`. All 4 throw `NOT_IMPLEMENTED — see P3.K1`
      // today. P3.K1 will replace the throws with real
      // reservation/charge/void/heartbeat logic; the interface is
      // pinned now so consumers can write code against it.
      beginInvocation(meterContext, options) {
        return _beginInvocation(meterContext, options)
      },

      settleInvocation(invocation, options) {
        return _settleInvocation(invocation, options)
      },

      voidInvocation(invocation, reason) {
        return _voidInvocation(invocation, reason)
      },

      heartbeat(invocation) {
        return _heartbeat(invocation)
      },
    }

    // Attach the hidden kernel internals as a non-enumerable property so
    // `createDispatchKernel(sg)` can reach middleware / config / pricing
    // without putting them on the public SettleGridInstance interface.
    // Non-enumerable means Object.keys(sg), JSON.stringify(sg), and
    // `{ ...sg }` all ignore it — consumers never see it by accident.
    // See `extractKernelInternals` in kernel.ts for the reader side.
    Object.defineProperty(instance, '__kernel__', {
      value: { middleware, config, pricing },
      enumerable: false,
      writable: false,
      configurable: false,
    })

    return instance
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

// ─── Protocol adapters (P1.K1) ────────────────────────────────────────────────
//
// The nine protocol adapters (MCP, x402, AP2, Visa TAP, Stripe MPP,
// Circle Nanopayments, Mastercard Verifiable Intent, ACP, UCP) were
// bundled into the SDK under P1.K1 — they were previously dead code at
// apps/web/src/lib/settlement/adapters/ and have zero external
// dependencies, making them a clean kernel to extract.
//
// Internal adapter type identifiers (the class names MPPAdapter,
// CircleNanoAdapter, MastercardVIAdapter, etc. and the `name` fields
// 'mpp', 'circle-nano', 'mastercard-vi') are kept for backwards
// compatibility — renaming them would be an ABI break for any consumer
// that imports by class name. The user-facing `displayName` fields and
// JSDoc headers are aligned with the P1.MKT1 honest framing.
//
// Consumers that need custom protocol support can build on the
// `ProtocolAdapter` interface and register instances via `new ProtocolRegistry()`
// (the singleton `protocolRegistry` is auto-populated with the nine built-ins).

export { protocolRegistry, ProtocolRegistry, DETECTION_PRIORITY } from './adapters'
export type {
  ProtocolAdapter,
  ProtocolName,
  IdentityType,
  PaymentType,
  PaymentContext,
  SettlementStatus,
  SettlementResult,
  AdapterLogger,
} from './adapters/types'
export { NOOP_LOGGER } from './adapters/types'

// ─── P2.K2 — Adapter classes + per-protocol validate/402 helpers ────────────
//
// P2.K2 promotes the 13 `apps/web/src/lib/*-proxy.ts` detection + validation
// + 402 generation helpers into the bundled adapter package so the unified
// adapter path is self-contained. The app-side lib files now re-export from
// here with env/logger bindings. Every adapter file exports:
//   - `class <X>Adapter` — canHandle, extractPaymentContext, formatResponse,
//     formatError, buildChallenge (the existing ProtocolAdapter interface)
//   - `is<X>Request(request)` — pure header detection helper
//   - `validate<X>Payment(request, options)` — validation (env-agnostic)
//   - `generate<X>402Response(options)` — 402 generation (env-agnostic)
//   - Result / ErrorCode / ToolConfig / ValidateOptions / 402Options types

export {
  MPPAdapter,
  isMppRequest,
  validateMppPayment,
  generateMpp402Response,
} from './adapters/mpp'
export type {
  MppPaymentResult,
  MppErrorCode,
  MppToolConfig,
  MppValidateOptions,
  Mpp402Options,
} from './adapters/mpp'

export {
  X402Adapter,
  isX402Request,
  validateX402Payment,
  generateX402_402Response,
} from './adapters/x402'
export type {
  X402ProxyPaymentResult,
  X402ProxyErrorCode,
  X402ToolConfig,
  X402ValidateOptions,
  X402_402Options,
} from './adapters/x402'

export {
  AP2Adapter,
  isAp2Request,
  validateAp2Payment,
  generateAp2_402Response,
} from './adapters/ap2'
export type {
  Ap2PaymentResult,
  Ap2ErrorCode,
  Ap2ToolConfig,
  Ap2ValidateOptions,
  Ap2_402Options,
} from './adapters/ap2'

export {
  TAPAdapter,
  isVisaTapRequest,
  validateVisaTapPayment,
  generateVisaTap402Response,
} from './adapters/tap'
export type {
  VisaTapPaymentResult,
  VisaTapErrorCode,
  VisaTapToolConfig,
  VisaTapValidateOptions,
  VisaTap402Options,
} from './adapters/tap'

export {
  ACPAdapter,
  isAcpRequest,
  validateAcpPayment,
  generateAcp402Response,
} from './adapters/acp'
export type {
  AcpPaymentResult,
  AcpErrorCode,
  AcpToolConfig,
  AcpValidateOptions,
  Acp402Options,
} from './adapters/acp'

export {
  UCPAdapter,
  isUcpRequest,
  validateUcpPayment,
  generateUcp402Response,
} from './adapters/ucp'
export type {
  UcpPaymentResult,
  UcpErrorCode,
  UcpToolConfig,
  UcpValidateOptions,
  Ucp402Options,
} from './adapters/ucp'

export {
  MastercardVIAdapter,
  isMastercardRequest,
  validateMastercardPayment,
  generateMastercard402Response,
} from './adapters/mastercard-vi'
export type {
  MastercardPaymentResult,
  MastercardErrorCode,
  MastercardToolConfig,
  MastercardValidateOptions,
  Mastercard402Options,
} from './adapters/mastercard-vi'

export {
  CircleNanoAdapter,
  isCircleNanoRequest,
  validateCircleNanoPayment,
  generateCircleNano402Response,
} from './adapters/circle-nano'
export type {
  CircleNanoPaymentResult,
  CircleNanoErrorCode,
  CircleNanoToolConfig,
  CircleNanoValidateOptions,
  CircleNano402Options,
} from './adapters/circle-nano'

export { MCPAdapter } from './adapters/mcp'

// ─── P2.K2 — five new emerging-protocol adapters ────────────────────────────

export {
  L402Adapter,
  validateL402Payment,
  generateL402_402Response,
} from './adapters/l402'
export type {
  L402PaymentResult,
  L402ErrorCode,
  L402ToolConfig,
  L402ValidateOptions,
  L402_402Options,
} from './adapters/l402'

export {
  AlipayAdapter,
  validateAlipayPayment,
  generateAlipay402Response,
} from './adapters/alipay'
export type {
  AlipayPaymentResult,
  AlipayErrorCode,
  AlipayToolConfig,
  AlipayValidateOptions,
  Alipay402Options,
} from './adapters/alipay'

export {
  KyaPayAdapter,
  validateKyaPayPayment,
  generateKyaPay402Response,
} from './adapters/kyapay'
export type {
  KyaPayPaymentResult,
  KyaPayErrorCode,
  KyaPayToolConfig,
  KyaPayValidateOptions,
  KyaPay402Options,
} from './adapters/kyapay'

export {
  EmvcoAdapter,
  EMVCO_NETWORKS,
  validateEmvcoPayment,
  generateEmvco402Response,
} from './adapters/emvco'
export type {
  EmvcoPaymentResult,
  EmvcoErrorCode,
  EmvcoToolConfig,
  EmvcoNetwork,
  EmvcoValidateOptions,
  Emvco402Options,
} from './adapters/emvco'

export {
  DrainAdapter,
  validateDrainPayment,
  generateDrain402Response,
} from './adapters/drain'
export type {
  DrainPaymentResult,
  DrainErrorCode,
  DrainToolConfig,
  DrainValidateOptions,
  Drain402Options,
} from './adapters/drain'

// ─── Cross-protocol dispatch kernel (P1.K2) ──────────────────────────────
//
// `createDispatchKernel(sg)` turns a SettleGrid instance into a
// protocol-aware Request → Response router. It internally handles
// protocol detection (sg-balance / x402 / MPP), facilitator round-trips,
// and response formatting. See `packages/mcp/src/kernel.ts` for the full
// design, including the handler signature, facilitator wire format,
// and the non-enumerable `__kernel__` contract that this module's
// `settlegrid.init()` populates on the returned instance.
//
// The kernel is also exposed at the `@settlegrid/mcp/kernel` subpath via
// the `exports` map in package.json — both paths resolve to the same
// dist bundle so there is no double-registration of the auto-registered
// protocol adapters.

export { createDispatchKernel } from './kernel'
export type { DispatchKernel, DispatchHandler } from './types'

// ─── Multi-protocol 402 manifest builder (P1.K3) ─────────────────────────
//
// `buildMultiProtocol402(options)` produces an HTTP 402 response with a
// body that advertises every accepted payment rail (sg-balance, x402,
// mpp, and Phase 2 protocols) so the client can pick one and retry.
// The kernel calls this internally when `protocolRegistry.detect()` finds
// no matching adapter, but it is also exposed as a public API so tool
// authors who bypass the kernel (e.g., custom middleware pipelines) can
// use the same builder directly.

export { buildMultiProtocol402 } from './402-builder'
export type {
  PaymentRequiredOptions,
  PaymentRequiredBody,
  ResourceDescriptor,
  BuildChallengeOptions,
  AcceptEntry,
} from './402-builder'

// ─── Lifecycle API (P2.K4 stubs; P3.K1 implementation) ──────────────────
//
// Re-exports the 4 lifecycle stub functions + their option types. The
// matching methods on `SettleGridInstance` delegate to these; both
// surfaces are provided so callers can use the free-function form
// (e.g. when lifting lifecycle into an external orchestration layer)
// or the instance-method form (for consumers that already hold a
// `sg = settlegrid.init(...)` handle).

export {
  beginInvocation,
  settleInvocation,
  voidInvocation,
  heartbeat,
  LIFECYCLE_NOT_IMPLEMENTED_MSG,
  LIFECYCLE_NOT_IMPLEMENTED_CODE,
} from './lifecycle'
export type {
  BeginInvocationOptions,
  SettleInvocationOptions,
} from './lifecycle'

/* -------------------------------------------------------------------------- */
/*  P2.RAIL1 — Rail adapter scaffolding (Stripe Connect today; Paddle / LS /  */
/*  Wise / Razorpay / Flutterwave as reserved future slots).                  */
/* -------------------------------------------------------------------------- */
export {
  createStripeRailAdapter,
  STRIPE_CONNECT_CAPABILITIES,
  STRIPE_CONNECT_COMPLIANCE,
  STRIPE_CONNECT_PRICING,
  STRIPE_CONNECT_DISPLAY_NAME,
  buildRailRegistry,
  requireRail,
  listRails,
  RESERVED_RAIL_IDS,
} from './rails'
export type {
  RailId,
  RailAdapter,
  RailCapabilities,
  LegalStructure,
  ComplianceResponsibility,
  DeveloperProfile as RailDeveloperProfile,
  OnboardingStatus,
  OnboardingStatusCode,
  TopupParams,
  SettleGridInternalEvent,
  SettleGridInternalEventKind,
  StripeRailAdapterOptions,
  StripeRailAdapter,
  StripeClient,
  BuildRegistryOptions,
  RailRegistry,
} from './rails'

// ─── P3.K4 — Per-rail pricing + unified ledger + tool-secret auth ───

export {
  resolveRailFee,
  buildPricingResponseHeaders,
} from './rails/pricing'
export type {
  RailPricingRateCard,
  RailPricingVolumeTier,
  RailPricingCurrencySurcharge,
} from './rails/types'
export type {
  RailFeeContext,
  ResolvedRailFee,
  PlatformTake,
} from './rails/pricing'

export {
  recordLedgerEntry,
  fingerprintLedgerEntry,
  LEDGER_ENTRY_METADATA_MAX_BYTES,
} from './ledger'
export type {
  LedgerEntry,
  LedgerEntryStatus,
  RecordLedgerEntryInput,
  LedgerWriter,
} from './ledger'

export {
  generateToolSecret,
  isValidToolSecretShape,
  signPayload,
  verifyPayloadSignature,
  rotateToolSecret,
  verifyWithRotation,
  TOOL_SECRET_BYTES,
  TOOL_SECRET_HEX_LENGTH,
  SIGNATURE_VERSION,
  DEFAULT_TIMESTAMP_TOLERANCE_SEC,
  ROTATION_GRACE_SEC,
} from './auth/tool-secret'
export type {
  ToolSecretState,
  SignedPayload,
  SignOptions,
  VerifyOptions,
} from './auth/tool-secret'

export {
  verifyWebhook,
  SETTLEGRID_SIGNATURE_HEADER,
  DEFAULT_WEBHOOK_MAX_BYTES,
} from './verifyWebhook'
export type {
  VerifyWebhookOptions,
  VerifyWebhookResult,
} from './verifyWebhook'

// ─── P3.K6 — Pre-execution authorization gate ────────────────────────

export {
  authorizeInvocation,
  buildAuthDeniedResponse,
  DEFAULT_FRAUD_DENY_THRESHOLD,
  DEFAULT_PLUGIN_TIMEOUT_MS,
} from './authorize'
export type {
  AuthorizationResult,
  AuthorizationSignal,
  AuthorizationPlugin,
  AuthorizationContext,
  AuthorizationConfig,
  AuthorizationLogger,
  RateLimitCheck,
  RateLimitOutcome,
  BudgetCheck,
  BudgetOutcome,
  FraudCheck,
  FraudOutcome,
  OfacCheck,
  OfacOutcome,
  AupCheck,
  AupOutcome,
} from './authorize'
