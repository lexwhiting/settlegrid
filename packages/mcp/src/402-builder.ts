/**
 * @settlegrid/mcp - Multi-protocol 402 manifest builder (P1.K3)
 *
 * `buildMultiProtocol402(options)` produces an HTTP 402 Payment Required
 * response whose body advertises every accepted payment rail at once.
 * The consumer inspects the `accepts` array, picks a rail it can pay,
 * attaches the appropriate headers, and retries the request.
 *
 * The response shape is a superset of x402 v2's PaymentRequired body —
 * it keeps the `x402Version`, `error`, and `resource` fields so x402-
 * native clients can parse it unmodified, while extending `accepts`
 * with entries for non-x402 rails (sg-balance, mpp, etc.).
 *
 * ## Response shape
 *
 * ```json
 * {
 *   "x402Version": 2,
 *   "error": "payment_required",
 *   "resource": {
 *     "url": "https://tool.example/api/search",
 *     "description": "Full-text search over product catalog",
 *     "mimeType": "application/json"
 *   },
 *   "accepts": [
 *     {
 *       "scheme": "sg-balance",
 *       "provider": "settlegrid",
 *       "costCents": 5,
 *       "topUpUrl": "https://settlegrid.ai/top-up"
 *     },
 *     {
 *       "scheme": "exact",
 *       "network": "eip155:8453",
 *       "asset": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
 *       "amount": "50000",
 *       "payTo": "0x0000000000000000000000000000000000000000"
 *     },
 *     {
 *       "scheme": "mpp",
 *       "provider": "stripe",
 *       "amountCents": 5,
 *       "currency": "USD"
 *     }
 *   ]
 * }
 * ```
 *
 * ## Headers
 *
 *   - `Content-Type: application/json`
 *   - `WWW-Authenticate: Payment realm="settlegrid", scheme="sg-balance, exact, mpp"`
 *     (comma-separated list of every scheme in the `accepts` array; the
 *     RFC 7235 challenge header signals to HTTP clients that the request
 *     needs a Payment credential)
 *   - `X-SettleGrid-Protocol-Negotiation: v1` (marks the body as using
 *     the v1 negotiation shape so clients can handle format changes
 *     gracefully in the future)
 *
 * ## Per-adapter stubs
 *
 * P1.K3 stubs the per-protocol accept-entry shapes inside this file as
 * a switch statement keyed on `ProtocolName`. Each stub is intentionally
 * minimal — it produces a spec-shaped entry for the relevant protocol
 * but does not yet wire up the full business logic (e.g., the USDC
 * contract address is hardcoded, the x402 payTo is a zero address, the
 * mpp currency is fixed at 'USD'). P1.K4 will move these stubs onto
 * each adapter as a `toAcceptEntry(options)` method on `ProtocolAdapter`,
 * and the builder will dispatch through `protocolRegistry.get(name)?.toAcceptEntry(...)`
 * instead of the local switch. Deliberately keeping both phases apart
 * so P1.K4 is a pure refactor, not a feature change.
 *
 * @packageDocumentation
 */

import { protocolRegistry } from './adapters/index'
import type { ProtocolName } from './adapters/types'
import { resolveOperationCost } from './config'
import type { GeneralizedPricingConfig, PricingConfig } from './types'

// ─── Public types ─────────────────────────────────────────────────────────

/** Resource being requested. Mirrors the x402 v2 `resource` field. */
export interface PaymentResource {
  /** Full request URL being protected. */
  url: string
  /** Human-readable description shown in 402 UI (optional). */
  description?: string
  /** IANA MIME type the resource will return on success (optional). */
  mimeType?: string
}

/**
 * Options passed to {@link buildMultiProtocol402}. The kernel assembles
 * this from its normalized config, the incoming request, and (when an
 * adapter matched but the protocol is not supported) the extracted
 * payment context.
 */
export interface PaymentRequiredOptions {
  /** Resource being requested. Populated from the incoming `Request`. */
  resource: PaymentResource
  /**
   * Non-empty list of protocols the tool is willing to accept. Every
   * entry produces one `accepts[]` entry in the response body. The
   * caller is expected to filter this to the subset the tool actually
   * supports before calling the builder — the builder does not consult
   * any external configuration to decide whether a protocol is enabled.
   */
  acceptedProtocols: ProtocolName[]
  /**
   * Pricing configuration the tool uses to compute cost. Either the
   * legacy `PricingConfig` (per-invocation) or the generalized
   * `GeneralizedPricingConfig` (one of the six pricing models).
   */
  pricing: PricingConfig | GeneralizedPricingConfig
  /**
   * Method name for pricing resolution. When omitted, the builder
   * resolves cost for the `'default'` method. This field exists so
   * that a 402 response can advertise the price for the SPECIFIC
   * method the consumer was trying to call, not just the tool's
   * default rate.
   */
  method?: string
}

/**
 * One entry in the `accepts` array. Loosely typed at this phase because
 * each protocol's shape is different and P1.K4 will tighten the shapes
 * when it moves the stubs to adapter-owned methods. A base `scheme`
 * field is always present (and is always a string); all other fields
 * are protocol-specific and are optional at the type level.
 */
export interface AcceptEntry {
  /** Payment scheme identifier (e.g., 'sg-balance', 'exact', 'mpp'). */
  scheme: string
  /** Additional protocol-specific fields (provider, amount, network, etc.). */
  [key: string]: unknown
}

/**
 * Full body shape returned by {@link buildMultiProtocol402}. Matches
 * the settlement-layer-architecture.md §4 schema.
 */
export interface PaymentRequiredBody {
  /** Always `2` for x402 v2 compatibility. */
  x402Version: 2
  /** Always the literal `'payment_required'` for x402 v2 compatibility. */
  error: 'payment_required'
  /** The resource that requires payment. */
  resource: PaymentResource
  /** Non-empty list of accepted payment rails. */
  accepts: AcceptEntry[]
}

// ─── Public entry point ───────────────────────────────────────────────────

/**
 * Build a multi-protocol HTTP 402 Payment Required response.
 *
 * @param options - Resource, accepted protocols, pricing, and optional method.
 * @returns A `Response` with status 402, the WWW-Authenticate challenge
 *          header, the X-SettleGrid-Protocol-Negotiation marker, and a
 *          JSON body matching {@link PaymentRequiredBody}.
 * @throws {Error} If `acceptedProtocols` is empty or not an array.
 *
 * @example
 * ```ts
 * import { buildMultiProtocol402 } from '@settlegrid/mcp'
 *
 * const response = buildMultiProtocol402({
 *   resource: { url: 'https://tool.example/api/search', description: 'Full-text search' },
 *   acceptedProtocols: ['mcp', 'x402', 'mpp'],
 *   pricing: { defaultCostCents: 5 },
 *   method: 'search',
 * })
 * // response.status === 402
 * // response.headers.get('WWW-Authenticate') === 'Payment realm="settlegrid", scheme="sg-balance, exact, mpp"'
 * ```
 */
export function buildMultiProtocol402(options: PaymentRequiredOptions): Response {
  if (
    !Array.isArray(options.acceptedProtocols) ||
    options.acceptedProtocols.length === 0
  ) {
    throw new Error(
      'buildMultiProtocol402: `acceptedProtocols` must be a non-empty array. ' +
        'The builder cannot produce a 402 manifest with zero accepted rails — ' +
        'the consumer would have no way to retry the request.',
    )
  }

  const accepts: AcceptEntry[] = options.acceptedProtocols.map((protocol) =>
    dispatchToAcceptEntry(protocol, options),
  )

  const body: PaymentRequiredBody = {
    x402Version: 2,
    error: 'payment_required',
    resource: {
      url: options.resource.url,
      // Spread the optional fields only when defined so the serialized
      // JSON does not carry `"description": undefined` / `"mimeType": undefined`
      // which some strict clients choke on.
      ...(options.resource.description !== undefined
        ? { description: options.resource.description }
        : {}),
      ...(options.resource.mimeType !== undefined
        ? { mimeType: options.resource.mimeType }
        : {}),
    },
    accepts,
  }

  // WWW-Authenticate challenge header (RFC 7235 style). Multiple
  // schemes are comma-separated within a single `scheme="..."`
  // attribute — non-standard but workable, since the authoritative
  // machine-readable list lives in the body's `accepts` array and the
  // header is primarily a hint for generic HTTP clients that may not
  // know about x402.
  const wwwAuthScheme = accepts.map((entry) => entry.scheme).join(', ')
  const wwwAuthHeader = `Payment realm="settlegrid", scheme="${wwwAuthScheme}"`

  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': wwwAuthHeader,
      'X-SettleGrid-Protocol-Negotiation': 'v1',
    },
  })
}

// ─── Per-protocol dispatch via adapter.toAcceptEntry ────────────────────

/**
 * Dispatch to the adapter's `toAcceptEntry(options)` method, looked up
 * via the auto-registered `protocolRegistry` singleton.
 *
 * All nine P1.K3 adapters implement `toAcceptEntry` as a method on the
 * adapter class (see `packages/mcp/src/adapters/mcp.ts`, `x402.ts`,
 * `mpp.ts`, etc.). P1.K4 replaces their stub bodies with real
 * implementations that read tool-owned configuration — the dispatcher
 * here stays unchanged across both phases, so P1.K4 is a pure
 * per-adapter refactor.
 *
 * The inline fallback below only fires if a caller passes a
 * ProtocolName whose adapter is either (a) not registered or (b) was
 * registered without a `toAcceptEntry` method (external adapter that
 * hasn't been upgraded). The fallback produces the minimum shape —
 * `{ scheme, costCents }` — so the builder can still emit a valid
 * manifest instead of crashing or omitting the rail.
 */
function dispatchToAcceptEntry(
  protocol: ProtocolName,
  options: PaymentRequiredOptions,
): AcceptEntry {
  const adapter = protocolRegistry.get(protocol)
  if (adapter && typeof adapter.toAcceptEntry === 'function') {
    return adapter.toAcceptEntry(options)
  }
  // Fallback: the adapter is missing or hasn't been upgraded with
  // toAcceptEntry. Emit a minimal stub so the overall manifest stays
  // valid. P1.K3 ships stubs on all nine built-in adapters, so this
  // path only fires for externally-registered adapters that pre-date
  // the toAcceptEntry addition.
  const method = options.method ?? 'default'
  const costCents = resolveOperationCost(options.pricing, method)
  return {
    scheme: protocol,
    costCents,
  }
}
