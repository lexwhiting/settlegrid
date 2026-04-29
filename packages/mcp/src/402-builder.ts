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
 * P1.K3 added per-protocol stub implementations. P1.K4 promoted them to
 * a required `buildChallenge(options)` method on the `ProtocolAdapter`
 * interface — every adapter now implements it — and the builder here
 * dispatches through `protocolRegistry.get(name).buildChallenge(...)`
 * instead of a local switch. Future passes will replace the minimal
 * stub bodies with real, tool-configured implementations (payout
 * addresses, network selection, currency support, etc.).
 *
 * @packageDocumentation
 */

import { protocolRegistry } from './adapters/index'
import type { ProtocolName } from './adapters/types'
import { resolveOperationCost, validatePricingConfig } from './config'
import type { GeneralizedPricingConfig, PricingConfig } from './types'

// ─── Public types ─────────────────────────────────────────────────────────

/** Resource being requested. Mirrors the x402 v2 `resource` field. */
export interface ResourceDescriptor {
  /** Full request URL being protected. */
  url: string
  /** Human-readable description shown in 402 UI (optional). */
  description?: string
  /** IANA MIME type the resource will return on success (optional). */
  mimeType?: string
}

/**
 * Options passed to each adapter's `buildChallenge()` method (P1.K4).
 * This is the narrow subset of {@link PaymentRequiredOptions} that an
 * individual adapter actually needs — it does NOT carry the caller's
 * full `acceptedProtocols` list, because an adapter only builds an
 * entry for its own protocol and never inspects the other rails.
 *
 * Defined as a separate interface so adapter implementations have a
 * clean public type to import, and so that `buildMultiProtocol402` can
 * forward a PaymentRequiredOptions to each adapter via structural
 * compatibility (PaymentRequiredOptions extends BuildChallengeOptions).
 */
export interface BuildChallengeOptions {
  /** Resource being requested. Populated from the incoming `Request`. */
  resource: ResourceDescriptor
  /**
   * Pricing configuration the tool uses to compute cost. Either the
   * legacy `PricingConfig` (per-invocation) or the generalized
   * `GeneralizedPricingConfig` (one of the six pricing models).
   */
  pricing: PricingConfig | GeneralizedPricingConfig
  /**
   * Method name for pricing resolution. When omitted, the adapter
   * resolves cost for the `'default'` method. This field exists so
   * that a 402 response can advertise the price for the SPECIFIC
   * method the consumer was trying to call, not just the tool's
   * default rate.
   */
  method?: string
}

/**
 * Options passed to {@link buildMultiProtocol402}. The kernel assembles
 * this from its normalized config, the incoming request, and (when an
 * adapter matched but the protocol is not supported) the extracted
 * payment context.
 *
 * Extends {@link BuildChallengeOptions} with the extra
 * `acceptedProtocols` list that the BUILDER uses to decide which
 * adapter entries to include — adapters themselves never see this
 * field because their `buildChallenge` signature narrows to
 * `BuildChallengeOptions`.
 */
export interface PaymentRequiredOptions extends BuildChallengeOptions {
  /**
   * Non-empty list of protocols the tool is willing to accept. Every
   * entry produces one `accepts[]` entry in the response body. The
   * caller is expected to filter this to the subset the tool actually
   * supports before calling the builder — the builder does not consult
   * any external configuration to decide whether a protocol is enabled.
   */
  acceptedProtocols: ProtocolName[]
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
  resource: ResourceDescriptor
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
  // ─── Input validation (hostile-review H1/H2/M1/H5) ───────────────────
  //
  // Every field the builder relies on is checked upfront with a
  // specific, actionable error message so a misconfigured caller sees
  // exactly which field is wrong rather than a cryptic TypeError or
  // RangeError deep inside the downstream helpers. The order is
  // cheapest-first (object/field checks before Zod) so invalid input
  // fails fast without running the expensive pricing validator.

  if (options === null || typeof options !== 'object') {
    throw new TypeError(
      'buildMultiProtocol402: `options` must be a non-null object. ' +
        `Received ${options === null ? 'null' : typeof options}.`,
    )
  }
  if (
    options.resource === null ||
    typeof options.resource !== 'object' ||
    Array.isArray(options.resource)
  ) {
    throw new TypeError(
      'buildMultiProtocol402: `options.resource` must be a non-null object with at least a `url` field.',
    )
  }
  if (
    typeof options.resource.url !== 'string' ||
    options.resource.url.length === 0
  ) {
    throw new TypeError(
      'buildMultiProtocol402: `options.resource.url` must be a non-empty string.',
    )
  }
  if (options.pricing === null || typeof options.pricing !== 'object') {
    throw new TypeError(
      'buildMultiProtocol402: `options.pricing` must be a non-null object ' +
        '(PricingConfig or GeneralizedPricingConfig).',
    )
  }
  // Run the pricing through the Zod schema so adapter stubs can trust
  // that resolveOperationCost will not throw on the downstream call.
  // The schema rejects negative/non-integer costCents, unknown models,
  // and other structural problems — errors that would otherwise surface
  // as confusing RangeErrors (from BigInt) or NaN-in-JSON.
  try {
    validatePricingConfig(options.pricing)
  } catch (err) {
    throw new TypeError(
      `buildMultiProtocol402: \`options.pricing\` failed schema validation: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
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
    dispatchBuildChallenge(protocol, options),
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

  // WWW-Authenticate challenge header (RFC 7235 style). Each scheme is
  // validated against SAFE_SCHEME_PATTERN before interpolation — see
  // `schemeForAuthHeader` for the rationale. Multiple schemes are
  // comma-separated within a single `scheme="..."` attribute; the
  // authoritative machine-readable list still lives in the body's
  // `accepts` array, so this header is a hint for generic HTTP
  // clients that do not know about x402.
  const wwwAuthScheme = accepts
    .map((entry) => schemeForAuthHeader(entry))
    .join(', ')
  const wwwAuthHeader = `Payment realm="settlegrid", scheme="${wwwAuthScheme}"`

  // Serialize the body with a try/catch so an adapter that returned a
  // non-JSON-serializable value (bigint, function, symbol, circular
  // reference) produces a clear error message pointing at the problem,
  // instead of a generic "Converting circular structure to JSON" or
  // "Do not know how to serialize a BigInt".
  let serializedBody: string
  try {
    serializedBody = JSON.stringify(body)
  } catch (err) {
    throw new Error(
      'buildMultiProtocol402: failed to serialize response body: ' +
        (err instanceof Error ? err.message : String(err)) +
        '. This usually means an adapter\'s `buildChallenge` returned a ' +
        'non-JSON-serializable value (bigint, function, symbol, or ' +
        'circular reference). Check each accept entry for invalid fields.',
    )
  }

  return new Response(serializedBody, {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': wwwAuthHeader,
      'X-SettleGrid-Protocol-Negotiation': 'v1',
    },
  })
}

// ─── Helpers (hostile-review H3/H4/M4 fixes) ─────────────────────────────

/**
 * Token character set for the WWW-Authenticate header's `scheme`
 * attribute. Intentionally more restrictive than RFC 7235 `tchar` —
 * we only allow alphanumerics, hyphen, underscore, and dot so that
 * the scheme value cannot contain the double-quote, backslash,
 * comma, or CRLF characters that would otherwise let an adapter-
 * controlled value inject additional attributes into the header.
 */
const SAFE_SCHEME_PATTERN = /^[A-Za-z0-9._-]+$/

/**
 * Validate an accept entry's `scheme` before interpolating it into
 * the WWW-Authenticate header. Rejects anything that could be used
 * for header injection — double quotes, commas, CRLF, and whitespace
 * — by requiring a strict alphanumeric + `._-` character set.
 * Throws a clear error if the scheme is invalid so the caller sees
 * exactly which adapter produced the bad value.
 */
function schemeForAuthHeader(entry: AcceptEntry): string {
  const scheme = entry.scheme
  if (typeof scheme !== 'string' || !SAFE_SCHEME_PATTERN.test(scheme)) {
    throw new Error(
      `buildMultiProtocol402: invalid scheme ${JSON.stringify(scheme)} for ` +
        'the WWW-Authenticate header. Scheme must match [A-Za-z0-9._-]+ ' +
        'to prevent header injection.',
    )
  }
  return scheme
}

// ─── Per-protocol dispatch via adapter.buildChallenge ───────────────────

/**
 * Dispatch to the adapter's `buildChallenge(options)` method, looked
 * up via the auto-registered `protocolRegistry` singleton.
 *
 * P1.K4 promotes `buildChallenge` to a required method on the
 * `ProtocolAdapter` interface — every adapter in the bundled registry
 * implements it. The dispatcher passes the full `PaymentRequiredOptions`
 * through to the adapter; structural subtyping lets it be accepted
 * as the narrower `BuildChallengeOptions` parameter without needing
 * to construct a new object.
 *
 * Defensive against adapter bugs (hostile-review H4/M4): the call is
 * wrapped in try/catch and the return value is shape-validated before
 * being passed through to the `accepts[]` array. Any of:
 *
 *   - adapter missing from the registry (unknown protocol name)
 *   - adapter registered without a `buildChallenge` method (external
 *     adapter that bypassed the interface via a type cast)
 *   - `buildChallenge` threw while building the entry
 *   - `buildChallenge` returned null, a primitive, an array, or an
 *     object without a string `scheme` field
 *
 * …falls through to {@link inlineFallbackEntry} so the overall
 * manifest stays valid. Today this only matters for externally-
 * registered adapters that violate the interface contract; the
 * built-in nine produce valid entries and never enter the fallback
 * path.
 */
function dispatchBuildChallenge(
  protocol: ProtocolName,
  options: PaymentRequiredOptions,
): AcceptEntry {
  const adapter = protocolRegistry.get(protocol)
  if (adapter && typeof adapter.buildChallenge === 'function') {
    let result: unknown
    try {
      result = adapter.buildChallenge(options)
    } catch {
      // Adapter's buildChallenge threw — swallow and fall back below.
      result = undefined
    }
    if (
      result !== null &&
      typeof result === 'object' &&
      !Array.isArray(result) &&
      typeof (result as AcceptEntry).scheme === 'string'
    ) {
      return result as AcceptEntry
    }
  }
  return inlineFallbackEntry(protocol, options)
}

/**
 * Produce a minimal `AcceptEntry` for a protocol whose adapter either
 * does not exist, does not implement `buildChallenge`, threw from
 * `buildChallenge`, or returned an invalid shape. Resolves the cost
 * defensively — `resolveOperationCost` itself could throw on a
 * malformed pricing config, though the caller-side validation in
 * `buildMultiProtocol402` already runs the pricing through Zod so
 * the resolve should always succeed.
 */
function inlineFallbackEntry(
  protocol: ProtocolName,
  options: PaymentRequiredOptions,
): AcceptEntry {
  const method = options.method ?? 'default'
  let costCents: number
  try {
    const rawCost = resolveOperationCost(options.pricing, method)
    costCents =
      Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
  } catch {
    costCents = 0
  }
  return {
    scheme: protocol,
    costCents,
  }
}
