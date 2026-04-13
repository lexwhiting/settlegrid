/**
 * @settlegrid/mcp - Cross-protocol dispatch kernel
 *
 * `createDispatchKernel(sg)` turns a SettleGrid instance into a
 * protocol-aware request router. It takes an incoming `Request` and a
 * developer-provided handler, then internally:
 *
 *   1. Detects which supported protocol (sg-balance / x402 / MPP) the
 *      request uses via the bundled `protocolRegistry`
 *   2. If no adapter matches, returns a multi-protocol 402 challenge
 *      (minimal inline version; P1.K3 will replace with a richer manifest)
 *   3. Extracts a normalized `PaymentContext` via the adapter
 *   4. For facilitator protocols (x402, MPP), POSTs to
 *      `${apiUrl}/api/${protocol}/verify` over HTTPS
 *   5. Runs the developer's handler — the handler is expected to produce
 *      any billing-relevant metadata (tokens consumed, bytes transferred,
 *      outcome result) as its return value
 *   6. For sg-balance, meters via the existing middleware pipeline;
 *      for facilitator protocols, POSTs to `${apiUrl}/api/${protocol}/settle`
 *      with the handler's return value in the body so the server can
 *      compute the final cost
 *   7. Formats the final Response via `adapter.formatResponse(settlementResult, request)`
 *
 * Public API:
 *
 *   ```ts
 *   import { settlegrid, createDispatchKernel } from '@settlegrid/mcp'
 *
 *   const sg = settlegrid.init({
 *     toolSlug: 'my-tool',
 *     pricing: { defaultCostCents: 5 },
 *     toolSecret: process.env.SETTLEGRID_TOOL_SECRET, // for x402/MPP
 *   })
 *
 *   const kernel = createDispatchKernel(sg)
 *
 *   // Node HTTP server
 *   const response = await kernel.handle(request, async (ctx) => {
 *     // ctx is a normalized PaymentContext
 *     return await doMyActualWork(ctx.operation.method, ctx.operation.params)
 *   })
 *   ```
 *
 * The kernel is also available as a subpath import:
 *
 *   ```ts
 *   import { createDispatchKernel } from '@settlegrid/mcp/kernel'
 *   ```
 *
 * Both import paths resolve to the same runtime value and share the same
 * module state (single tsup bundle — the subpath in `package.json exports`
 * is an alias, not a separate entry point).
 *
 * @packageDocumentation
 */

import { buildMultiProtocol402 } from './402-builder'
import { protocolRegistry } from './adapters/index'
import type {
  PaymentContext,
  ProtocolAdapter,
  ProtocolName,
  SettlementResult,
} from './adapters/types'
import type { NormalizedConfig } from './config'
import {
  InsufficientCreditsError,
  InvalidKeyError,
  NetworkError,
  SettleGridError,
  SettleGridUnavailableError,
  TimeoutError,
} from './errors'
import type { createMiddleware } from './middleware'
// SettleGridInstance lives in index.ts (the public entry) rather than
// types.ts. Importing it as a type-only import avoids the runtime
// circular dependency that a value import would create (index.ts
// re-exports createDispatchKernel from this file).
import type { SettleGridInstance } from './index'
import type {
  DispatchHandler,
  DispatchKernel,
  GeneralizedPricingConfig,
  PricingConfig,
} from './types'

// The public types `DispatchKernel` and `DispatchHandler` are declared in
// `./types.ts` (per the P1.K2 spec's "may touch: types.ts (add DispatchKernel)"
// direction) and re-exported from the package entry via `./index.ts`. They
// are imported above so the `createDispatchKernel` signature and
// `handleSgBalance` / `handleFacilitatorProtocol` can reference them.

// ─── Internal: kernel <-> SDK instance contract ────────────────────────────

/**
 * Hidden contract between `settlegrid.init()` and `createDispatchKernel()`.
 * Populated at init time as a non-enumerable property on the sg instance
 * so it does not appear in `Object.keys(sg)`, JSON serialization, or the
 * public `SettleGridInstance` TypeScript interface. The kernel reads this
 * contract via a local type assertion — see `extractKernelInternals`.
 *
 * Not exported — purely an implementation detail of kernel.ts. If a
 * future caller needs this shape, it should be re-derived from the
 * `createMiddleware` + `NormalizedConfig` signatures rather than
 * imported from here.
 */
interface KernelInternals {
  middleware: ReturnType<typeof createMiddleware>
  config: NormalizedConfig
  pricing: PricingConfig | GeneralizedPricingConfig
}

/** Symbol-adjacent property name for the hidden internals slot. */
const KERNEL_INTERNALS_KEY = '__kernel__' as const

type InstanceWithInternals = SettleGridInstance & {
  [KERNEL_INTERNALS_KEY]?: KernelInternals
}

function extractKernelInternals(sg: SettleGridInstance): KernelInternals {
  if (sg === null || typeof sg !== 'object') {
    throw new Error(
      'createDispatchKernel: expected a SettleGrid instance object, got ' +
        typeof sg +
        '. Pass the return value of `settlegrid.init({...})`.',
    )
  }
  const internals = (sg as InstanceWithInternals)[KERNEL_INTERNALS_KEY]
  if (!internals) {
    throw new Error(
      'createDispatchKernel: the provided object does not expose kernel ' +
        'internals. This usually means it was not produced by ' +
        '`settlegrid.init({...})`. Pass `settlegrid.init(options)` directly — ' +
        'do not hand-roll an SDK instance.',
    )
  }
  return internals
}

// ─── Public entry point ────────────────────────────────────────────────────

/**
 * Build a cross-protocol dispatch kernel backed by an existing SettleGrid
 * instance. See the file-level docs for the full pipeline description.
 *
 * @param sg - SettleGrid instance produced by `settlegrid.init({...})`.
 * @returns A {@link DispatchKernel} with a single `handle` method.
 * @throws {Error} If `sg` was not produced by `settlegrid.init()`.
 *
 * @example
 * ```typescript
 * const sg = settlegrid.init({ toolSlug: 'my-tool', pricing: { defaultCostCents: 5 } })
 * const kernel = createDispatchKernel(sg)
 * const response = await kernel.handle(request, async (ctx) => ({ ok: true }))
 * ```
 */
/**
 * Protocols the Phase 1 kernel advertises in its 402 manifest and
 * knows how to dispatch internally. Phase 2 protocols (ap2, visa-tap,
 * ucp, acp, mastercard-vi, circle-nano) are NOT included here: the
 * kernel has no implementation for them yet, so advertising them in a
 * 402 manifest would be misleading. Consumers who want to also accept
 * those protocols should call `buildMultiProtocol402` directly.
 */
const PHASE_1_KERNEL_PROTOCOLS: ProtocolName[] = ['mcp', 'x402', 'mpp']

export function createDispatchKernel(sg: SettleGridInstance): DispatchKernel {
  const internals = extractKernelInternals(sg)
  const { middleware, config, pricing } = internals

  /**
   * Build the kernel's default 402 manifest. Hoisted out of `handle()`
   * so both call sites (no-adapter-matched and Phase-2-protocol-matched)
   * share the same options shape. `method` is optional because the
   * no-adapter-matched case has no extracted context to pull it from.
   */
  const build402 = (request: Request, method?: string): Response =>
    buildMultiProtocol402({
      resource: { url: request.url },
      acceptedProtocols: PHASE_1_KERNEL_PROTOCOLS,
      pricing,
      ...(method !== undefined ? { method } : {}),
    })

  return {
    async handle(request: Request, runHandler: DispatchHandler): Promise<Response> {
      // Defense-in-depth outer try/catch. The DispatchKernel contract
      // promises that `handle()` never throws — all errors must be
      // converted into Response objects before returning. The inner
      // try/catch below handles the common case (errors from the
      // extract / facilitator / meter / handler pipeline) by routing
      // them through `adapter.formatError`. But three call sites sit
      // OUTSIDE the inner try/catch:
      //
      //   1. `protocolRegistry.detect(request)` — a buggy adapter's
      //      `canHandle()` could throw synchronously here
      //   2. `buildMultiProtocol402(options)` — unlikely but possible
      //   3. `adapter.formatError(err, request)` — the error formatter
      //      itself could throw (e.g., if an adapter's formatError
      //      accesses a property on the error that is not present)
      //
      // Any of those would produce an unhandled rejection out of
      // handle(), violating the "never throws" contract. The outer
      // catch below turns them into a generic 500 response instead.
      try {
        // 1. Protocol detection
        const adapter = protocolRegistry.detect(request)
        if (!adapter) {
          // No adapter matched the request — return the P1.K3
          // multi-protocol 402 manifest. The consumer picks a rail
          // from `accepts` and retries with the appropriate headers.
          return build402(request)
        }

        try {
          // 2. Extract normalized payment context
          const ctx = await adapter.extractPaymentContext(request)

          // 3. Protocol-specific pipeline
          if (ctx.protocol === 'mcp') {
            return await handleSgBalance(ctx, adapter, request, runHandler, middleware)
          }
          if (ctx.protocol === 'x402' || ctx.protocol === 'mpp') {
            return await handleFacilitatorProtocol(
              ctx,
              adapter,
              request,
              runHandler,
              config,
            )
          }
          // Protocol is recognized by the registry but not wired into
          // the Phase 1 kernel (ap2, visa-tap, ucp, acp, mastercard-vi,
          // circle-nano). Fall through to the 402 manifest (with the
          // method from ctx so the advertised price is method-specific)
          // rather than silently accepting a payment the kernel cannot
          // actually settle.
          return build402(request, ctx.operation.method)
        } catch (err) {
          return adapter.formatError(normalizeError(err), request)
        }
      } catch (fatalErr) {
        return buildKernelFault500(fatalErr, config)
      }
    },
  }
}

/**
 * Last-resort fallback Response produced by the outer catch in
 * `handle()` when something that was supposed to always succeed
 * throws (e.g. an adapter's `canHandle()` or `formatError()` has a
 * bug). Guarantees that `kernel.handle()` never produces an
 * unhandled promise rejection, even if the underlying protocol
 * adapters are buggy.
 *
 * The body is a minimal JSON payload so consumers can still parse
 * a machine-readable error; the Content-Type is application/json.
 * The status is 500 because the kernel itself has failed — no
 * amount of retrying on the consumer side can recover, the tool
 * author needs to look at the error logs.
 */
function buildKernelFault500(err: unknown, config: NormalizedConfig): Response {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Unknown kernel fault'
  return new Response(
    JSON.stringify({
      error: 'Kernel fault',
      code: 'KERNEL_FAULT',
      message,
      toolSlug: config.toolSlug,
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// ─── sg-balance (MCP) pipeline ─────────────────────────────────────────────

async function handleSgBalance(
  ctx: PaymentContext,
  adapter: ProtocolAdapter,
  request: Request,
  runHandler: DispatchHandler,
  middleware: ReturnType<typeof createMiddleware>,
): Promise<Response> {
  const startTime = Date.now()
  const apiKey = ctx.identity.value
  const method = ctx.operation.method

  // 1. Validate key
  const validation = await middleware.validateKey(apiKey)
  if (!validation.valid) {
    throw new InvalidKeyError()
  }

  // 2. Pre-authorize against balance
  const { sufficient, costCents } = middleware.checkCredits(
    validation.balanceCents,
    method,
  )
  if (!sufficient) {
    throw new InsufficientCreditsError(costCents, validation.balanceCents)
  }

  // 3. Run the developer's handler. The return value is intentionally
  // captured but discarded: sg-balance pricing is resolved from the
  // pricing config pre-handler, so the handler return value has no role
  // in final cost computation. If a future spec (per-token, per-byte)
  // needs the handler return value for sg-balance, the kernel will need
  // to forward it to meter() in the `units` field.
  await runHandler(ctx)

  // 4. Meter — awaited so the kernel can build SettlementResult from the
  // meter response (unlike middleware.execute which fire-and-forgets
  // meter in non-debug mode).
  const meterResponse = await middleware.meter({
    consumerId: validation.consumerId,
    toolId: validation.toolId,
    keyId: validation.keyId,
    method,
    costCents,
    startTime,
  })

  // 5. Build settlement result + format response via the adapter. Use the
  // `costCents` the server returned on `meterResponse`, NOT the locally
  // computed pre-auth value. The server is authoritative: if it applied
  // a discount, promotion, surge, or rounding adjustment, the response
  // header and body must reflect what the server actually recorded,
  // otherwise the consumer sees a cost that disagrees with their
  // transaction log. The two values are typically identical for
  // per-invocation pricing, but diverging them silently would be a
  // billing-correctness bug.
  const settlementResult: SettlementResult = {
    status: meterResponse.success ? 'settled' : 'failed',
    operationId: meterResponse.invocationId,
    costCents: meterResponse.costCents,
    remainingBalanceCents: meterResponse.remainingBalanceCents,
    metadata: {
      protocol: 'mcp',
      latencyMs: Date.now() - startTime,
      settlementType: 'real-time',
    },
  }
  return adapter.formatResponse(settlementResult, request)
}

// ─── Facilitator protocols (x402, MPP) pipeline ────────────────────────────

async function handleFacilitatorProtocol(
  ctx: PaymentContext,
  adapter: ProtocolAdapter,
  request: Request,
  runHandler: DispatchHandler,
  config: NormalizedConfig,
): Promise<Response> {
  const startTime = Date.now()
  const protocol = ctx.protocol
  const authHeader = resolveFacilitatorAuth(config, request)

  // 1. Verify payment via facilitator — throws on failure
  await facilitatorVerify(config, protocol, ctx, authHeader)

  // 2. Run the developer's handler; its return value is forwarded to
  // settle so the server can compute the final cost (e.g., token count
  // for per-token pricing, bytes transferred for per-byte pricing).
  const handlerResult = await runHandler(ctx)

  // 3. Settle via facilitator and get back a SettlementResult that the
  // adapter can format for the consumer. latencyMs is measured from
  // verify-start so the metadata reflects the whole pipeline, not just
  // the handler.
  const settlementResult = await facilitatorSettle(
    config,
    protocol,
    ctx,
    handlerResult,
    Date.now() - startTime,
    authHeader,
  )

  return adapter.formatResponse(settlementResult, request)
}

// ─── Facilitator auth resolution ───────────────────────────────────────────

/**
 * Resolve the Authorization header value for facilitator round-trips.
 *
 * Precedence:
 *   1. `config.toolSecret` — the preferred path; a tool-owned secret
 *      that authenticates the tool to the facilitator regardless of
 *      which consumer is calling.
 *   2. Consumer's `x-api-key` header — fallback for Phase 1. Less ideal
 *      because it couples the tool's facilitator auth to whichever
 *      consumer is calling, but it is the only option when the tool
 *      author has not yet provisioned a toolSecret.
 *   3. Consumer's `authorization` header — passed through verbatim
 *      when it already looks like a Bearer value.
 *
 * Throws if none of the three are available, so the caller gets a
 * clean error instead of a silent "empty Authorization header" that
 * would otherwise produce a 401 from the facilitator.
 */
function resolveFacilitatorAuth(config: NormalizedConfig, request: Request): string {
  const toolSecret = config.toolSecret
  if (typeof toolSecret === 'string' && toolSecret.length > 0) {
    return `Bearer ${toolSecret}`
  }
  const apiKey = request.headers.get('x-api-key')
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    return `Bearer ${apiKey}`
  }
  const rawAuth = request.headers.get('authorization')
  // Only accept `Authorization: Bearer <token>` as the tertiary fallback.
  // Wrapping non-Bearer schemes (e.g. `Authorization: Basic dXNlcjpwYXNz`)
  // as `Bearer Basic dXNlcjpwYXNz` would produce a nonsense header that
  // the facilitator would reject with a confusing 401, hiding the real
  // cause (wrong auth scheme) from the tool author. Falling through to
  // the throw below gives them a clear actionable error instead.
  if (
    typeof rawAuth === 'string' &&
    rawAuth.length > 0 &&
    rawAuth.toLowerCase().startsWith('bearer ')
  ) {
    return rawAuth
  }
  throw new Error(
    'createDispatchKernel: facilitator auth unavailable. Set `toolSecret` ' +
      'in settlegrid.init({...}) or include an `x-api-key` header or ' +
      '`Authorization: Bearer <token>` header on the incoming request. ' +
      '(Non-Bearer Authorization schemes such as Basic or Digest are not ' +
      'accepted as a fallback.)',
  )
}

// ─── Facilitator HTTPS round-trips ─────────────────────────────────────────

/**
 * Wire format for the facilitator verify request body. The verify
 * endpoint returns `{ valid: boolean, error?: string, code?: string }`.
 *
 * Kept as a plain object so the body is easy to log and easy to replace
 * if a future protocol needs additional fields.
 */
interface FacilitatorVerifyRequest {
  toolSlug: string
  paymentContext: PaymentContext
  method: string
}

interface FacilitatorVerifyResponse {
  valid: boolean
  error?: string
  code?: string
}

async function facilitatorVerify(
  config: NormalizedConfig,
  protocol: ProtocolName,
  ctx: PaymentContext,
  authHeader: string,
): Promise<void> {
  const body: FacilitatorVerifyRequest = {
    toolSlug: config.toolSlug,
    paymentContext: ctx,
    method: ctx.operation.method,
  }
  const raw = await facilitatorFetch(
    config,
    protocol,
    'verify',
    body,
    authHeader,
  )
  // Validate shape before reading fields — defense against the facilitator
  // returning `null`, an array, or a primitive as its JSON body. Without
  // this check, `parsed.valid` would throw a TypeError that propagates
  // out of facilitatorFetch as a NetworkError, masking the real cause
  // (malformed server response) with a misleading error class.
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SettleGridUnavailableError(
      `Facilitator /${protocol}/verify returned a non-object body`,
    )
  }
  const parsed = raw as FacilitatorVerifyResponse
  if (parsed.valid !== true) {
    // Facilitator rejected the payment — use a plain Error rather than
    // SettleGridUnavailableError so the error CLASS reflects reality
    // ("service working, payment declined") instead of "service down".
    // The adapter's formatError pattern-matches on the message string
    // to decide the user-facing status code (402 for payment errors),
    // so this class change is internal-only: the response status for
    // the consumer is unchanged.
    throw new Error(
      `Facilitator rejected ${protocol} payment: ${
        typeof parsed.error === 'string' ? parsed.error : 'unknown reason'
      }`,
    )
  }
}

/**
 * Wire format for the facilitator settle request body. The settle
 * endpoint returns a fully-populated {@link SettlementResult}.
 */
interface FacilitatorSettleRequest {
  toolSlug: string
  paymentContext: PaymentContext
  handlerResult: unknown
  latencyMs: number
  method: string
}

async function facilitatorSettle(
  config: NormalizedConfig,
  protocol: ProtocolName,
  ctx: PaymentContext,
  handlerResult: unknown,
  latencyMs: number,
  authHeader: string,
): Promise<SettlementResult> {
  const body: FacilitatorSettleRequest = {
    toolSlug: config.toolSlug,
    paymentContext: ctx,
    handlerResult,
    latencyMs,
    method: ctx.operation.method,
  }
  const raw = await facilitatorFetch(
    config,
    protocol,
    'settle',
    body,
    authHeader,
  )
  return validateSettlementResult(raw, protocol)
}

/** Whitelist of valid {@link SettlementStatus} string literals. */
const VALID_SETTLEMENT_STATUSES: ReadonlySet<string> = new Set([
  'settled',
  'pending',
  'rejected',
  'failed',
])

/**
 * Strict runtime validation of a facilitator's settle response. The
 * facilitator endpoint is supposed to return a SettlementResult, but a
 * malformed response from a misbehaving (or malicious) facilitator
 * would otherwise surface as confusing TypeErrors deep inside
 * `adapter.formatResponse`. Each field is validated with a specific
 * message so a failure is easy to diagnose, and invalid states like
 * `NaN` costCents or `null` metadata are rejected up front.
 *
 * Invariants checked:
 *   - raw is a non-null, non-array object
 *   - raw.status is one of 'settled' | 'pending' | 'rejected' | 'failed'
 *   - raw.operationId is a non-empty string
 *   - raw.costCents is a finite non-negative number
 *   - raw.metadata is a non-null, non-array object
 */
function validateSettlementResult(
  raw: unknown,
  protocol: ProtocolName,
): SettlementResult {
  const fail = (reason: string): never => {
    throw new SettleGridUnavailableError(
      `Facilitator /${protocol}/settle returned a malformed SettlementResult: ${reason}`,
    )
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('body is not a plain object')
  }
  const candidate = raw as Record<string, unknown>
  if (
    typeof candidate.status !== 'string' ||
    !VALID_SETTLEMENT_STATUSES.has(candidate.status)
  ) {
    return fail(
      `status must be one of settled|pending|rejected|failed (got ${JSON.stringify(
        candidate.status,
      )})`,
    )
  }
  if (
    typeof candidate.operationId !== 'string' ||
    candidate.operationId.length === 0
  ) {
    return fail('operationId must be a non-empty string')
  }
  if (
    typeof candidate.costCents !== 'number' ||
    !Number.isFinite(candidate.costCents) ||
    candidate.costCents < 0
  ) {
    return fail(
      `costCents must be a finite non-negative number (got ${JSON.stringify(
        candidate.costCents,
      )})`,
    )
  }
  if (
    candidate.metadata === null ||
    typeof candidate.metadata !== 'object' ||
    Array.isArray(candidate.metadata)
  ) {
    return fail('metadata must be a non-null non-array object')
  }
  return candidate as unknown as SettlementResult
}

/**
 * Generic JSON POST helper used by both facilitator endpoints. Applies
 * the configured timeout via AbortController (same pattern as apiCall in
 * middleware.ts for consistency) and normalizes HTTP / network / parse
 * failures into SettleGridError subclasses so the outer try/catch in
 * `handle()` can route them through `adapter.formatError`.
 */
async function facilitatorFetch(
  config: NormalizedConfig,
  protocol: ProtocolName,
  action: 'verify' | 'settle',
  body: FacilitatorVerifyRequest | FacilitatorSettleRequest,
  authHeader: string,
): Promise<unknown> {
  const url = `${config.apiUrl}/api/${protocol}/${action}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new SettleGridUnavailableError(
        `Facilitator /${protocol}/${action} returned HTTP ${response.status}`,
      )
    }
    const text = await response.text()
    if (text.length === 0) {
      throw new SettleGridUnavailableError(
        `Facilitator /${protocol}/${action} returned an empty body`,
      )
    }
    try {
      return JSON.parse(text) as unknown
    } catch (parseErr) {
      const detail =
        parseErr instanceof Error ? `: ${parseErr.message}` : ''
      throw new SettleGridUnavailableError(
        `Facilitator /${protocol}/${action} returned non-JSON body${detail}`,
      )
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(config.timeoutMs)
    }
    if (error instanceof SettleGridError) {
      throw error
    }
    throw new NetworkError(
      error instanceof Error ? error.message : 'Unknown network error',
    )
  } finally {
    clearTimeout(timer)
  }
}

// The multi-protocol 402 manifest builder lives at `./402-builder.ts`
// (P1.K3). The kernel imports it at the top of this file and calls it
// from `build402()` above. An earlier P1.K2 placeholder implementation
// that lived inline here was removed when P1.K3 shipped.

// ─── Error normalization ───────────────────────────────────────────────────

function normalizeError(err: unknown): Error {
  if (err instanceof Error) return err
  if (typeof err === 'string') return new Error(err)
  try {
    return new Error(JSON.stringify(err))
  } catch {
    return new Error('Unknown error thrown by handler')
  }
}
