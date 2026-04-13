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
export function createDispatchKernel(sg: SettleGridInstance): DispatchKernel {
  const internals = extractKernelInternals(sg)
  const { middleware, config } = internals

  return {
    async handle(request: Request, runHandler: DispatchHandler): Promise<Response> {
      // 1. Protocol detection
      const adapter = protocolRegistry.detect(request)
      if (!adapter) {
        // No adapter matched the request — return the minimal multi-protocol
        // 402 fallback. P1.K3 will replace this with a richer manifest
        // builder (`buildMultiProtocol402` in `402-builder.ts`).
        return buildMultiProtocol402(config)
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
        // Protocol is recognized by the registry but not wired into the
        // Phase 1 kernel (ap2, visa-tap, ucp, acp, mastercard-vi,
        // circle-nano). Fall through to the 402 fallback rather than
        // silently accepting a payment the kernel cannot actually settle.
        return buildMultiProtocol402(config)
      } catch (err) {
        return adapter.formatError(normalizeError(err), request)
      }
    },
  }
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

  // 5. Build settlement result + format response via the adapter
  const settlementResult: SettlementResult = {
    status: meterResponse.success ? 'settled' : 'failed',
    operationId: meterResponse.invocationId,
    costCents,
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
  if (typeof rawAuth === 'string' && rawAuth.length > 0) {
    // Pass through verbatim when it already looks like a Bearer value;
    // otherwise wrap it. Facilitators expect `Bearer <token>` form.
    return rawAuth.toLowerCase().startsWith('bearer ') ? rawAuth : `Bearer ${rawAuth}`
  }
  throw new Error(
    'createDispatchKernel: facilitator auth unavailable. Set `toolSecret` ' +
      'in settlegrid.init({...}) or include an `x-api-key` / `Authorization` ' +
      'header on the incoming request.',
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
  const parsed = raw as FacilitatorVerifyResponse
  if (parsed.valid !== true) {
    throw new SettleGridUnavailableError(
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
  // The facilitator's settle response body IS the SettlementResult. We
  // trust the shape but verify the required fields exist — a malformed
  // response would otherwise surface as a confusing TypeError inside
  // adapter.formatResponse.
  if (
    raw === null ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    typeof (raw as { status?: unknown }).status !== 'string' ||
    typeof (raw as { operationId?: unknown }).operationId !== 'string' ||
    typeof (raw as { costCents?: unknown }).costCents !== 'number' ||
    typeof (raw as { metadata?: unknown }).metadata !== 'object'
  ) {
    throw new SettleGridUnavailableError(
      `Facilitator /${protocol}/settle returned a malformed SettlementResult`,
    )
  }
  return raw as SettlementResult
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

// ─── Multi-protocol 402 builder (inline; P1.K3 will extract) ─────────────

/**
 * Minimal multi-protocol 402 response returned when
 * `protocolRegistry.detect(request)` found no matching adapter OR when
 * the matched adapter's protocol is not wired into the Phase 1 kernel.
 *
 * P1.K3 is scheduled to extract this function into
 * `packages/mcp/src/402-builder.ts` and enrich the body with a full
 * manifest: per-protocol pricing breakdown, facilitator endpoints,
 * supported payment schemes, and any cryptographic challenges the
 * client needs to include on retry. When P1.K3 ships, kernel.ts will
 * switch from this inline implementation to
 * `import { buildMultiProtocol402 } from './402-builder'` and this
 * local body will be removed. The function name is kept identical
 * so the call site in `handle()` does not change between the two
 * phases — only the import path changes.
 *
 * Today's body is intentionally minimal: a short JSON explanation,
 * the `supportedProtocols` list, the tool slug, and the
 * `Accept-Payments` header so clients can pick one and retry.
 */
function buildMultiProtocol402(config: NormalizedConfig): Response {
  const supported = ['sg-balance', 'x402', 'mpp'] as const
  return new Response(
    JSON.stringify({
      error: 'Payment required',
      code: 'PAYMENT_REQUIRED',
      message:
        'No supported payment protocol detected on the incoming request. ' +
        'Include one of: `x-api-key` header (sg-balance / MCP), ' +
        '`payment-signature` header (x402), or `x-mpp-credential` header (MPP).',
      supportedProtocols: supported,
      toolSlug: config.toolSlug,
    }),
    {
      status: 402,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Payments': supported.join(', '),
      },
    },
  )
}

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
