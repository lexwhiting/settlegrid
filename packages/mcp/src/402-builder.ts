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

import { resolveOperationCost } from './config'
import type { ProtocolName } from './adapters/types'
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
    stubToAcceptEntry(protocol, options),
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

// ─── Per-protocol stubs (P1.K3 — P1.K4 moves them to adapter methods) ────

/**
 * Default Base-mainnet USDC contract address, used by the P1.K3 x402
 * stub. P1.K4 will replace this with a config-driven lookup so tools
 * can opt into different networks or assets.
 */
const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

/**
 * Zero-address placeholder for the x402 `payTo` field, used by the
 * P1.K3 stub. P1.K4 will read the tool's real payout address from
 * config (probably from a new `facilitator.payTo` field on the
 * GeneralizedPricingConfig or from a per-rail config section).
 */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * Default x402 network identifier — eip155:8453 is Base mainnet, the
 * most common USDC x402 deployment target. P1.K4 will make this
 * configurable.
 */
const DEFAULT_X402_NETWORK = 'eip155:8453'

/**
 * USDC has 6 decimal places of precision, so one USD cent is
 * 10_000 base units. Used by the x402 stub to convert `costCents`
 * (integer cents) into the `amount` string (base units of USDC).
 */
const USDC_BASE_UNITS_PER_CENT = 10_000n

/**
 * SettleGrid's default top-up page — shown to the consumer when the
 * 402 offers a sg-balance rail and they need to add credits.
 */
const SETTLEGRID_TOPUP_URL = 'https://settlegrid.ai/top-up'

/**
 * Internal dispatcher that produces one `AcceptEntry` per protocol.
 * P1.K3 implements this as a switch statement; P1.K4 will refactor it
 * into `protocolRegistry.get(name)?.toAcceptEntry(options)` once each
 * adapter owns its own entry shape. The switch's existence today is
 * deliberate — P1.K4 becomes a pure refactor because every case below
 * has a well-defined target adapter method.
 */
function stubToAcceptEntry(
  protocol: ProtocolName,
  options: PaymentRequiredOptions,
): AcceptEntry {
  const method = options.method ?? 'default'
  const costCents = resolveOperationCost(options.pricing, method)

  switch (protocol) {
    case 'mcp':
      // sg-balance rail: the consumer pays from a pre-funded SettleGrid
      // credit balance. No facilitator round-trip needed at 402 time.
      return {
        scheme: 'sg-balance',
        provider: 'settlegrid',
        costCents,
        topUpUrl: SETTLEGRID_TOPUP_URL,
      }

    case 'x402': {
      // x402 exact scheme: the consumer must sign an EIP-3009
      // transferWithAuthorization for the exact amount in USDC on Base.
      // Amount is expressed in USDC base units (6 decimals), i.e.
      // 1 cent → 10_000 base units → the string "10000".
      const amountBaseUnits = BigInt(costCents) * USDC_BASE_UNITS_PER_CENT
      return {
        scheme: 'exact',
        network: DEFAULT_X402_NETWORK,
        asset: BASE_USDC_ADDRESS,
        amount: amountBaseUnits.toString(),
        payTo: ZERO_ADDRESS, // P1.K4: replace with tool's real payout address
      }
    }

    case 'mpp':
      // MPP via Stripe Shared Payment Token — amountCents is the cost
      // in the smallest unit of the currency (cents for USD).
      return {
        scheme: 'mpp',
        provider: 'stripe',
        amountCents: costCents,
        currency: 'USD',
      }

    // Phase 2 protocols recognized by the registry but not yet wired
    // into the kernel's dispatch pipeline. The 402 still advertises
    // them (in case a client can handle them out-of-band) but with a
    // minimal shape — a string scheme plus the cost. P1.K4 will add
    // proper toAcceptEntry implementations for each as their adapters
    // mature.
    case 'ap2':
    case 'visa-tap':
    case 'ucp':
    case 'acp':
    case 'mastercard-vi':
    case 'circle-nano':
    default:
      return {
        scheme: protocol,
        costCents,
      }
  }
}
