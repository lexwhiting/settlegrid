/**
 * Public types for @settlegrid/client.
 *
 * The 402-manifest types mirror the shape produced by
 * `buildMultiProtocol402` in packages/mcp/src/402-builder.ts. They are
 * intentionally duplicated here rather than imported so this package
 * has ZERO runtime dependency on @settlegrid/mcp — which would
 * transitively pull Node-only modules (`crypto`, `node:buffer`) into
 * browser bundles. Any shape drift will be caught by the
 * interop-contract tests in this package's test suite.
 */

// ─── 402 manifest shape (mirrors @settlegrid/mcp) ────────────────────

/** One entry in the 402 manifest's `accepts` array. */
export interface AcceptEntry {
  /** Payment scheme identifier (e.g., 'exact', 'mpp', 'l402', 'ap2'). */
  scheme: string
  /** Additional protocol-specific fields (provider, amount, network, etc.). */
  [key: string]: unknown
}

/** Resource descriptor from the 402 manifest. */
export interface ResourceDescriptor {
  url: string
  description?: string
  mimeType?: string
}

/** Full 402 Payment Required body. */
export interface PaymentRequiredBody {
  x402Version: 2
  error: 'payment_required'
  resource: ResourceDescriptor
  accepts: AcceptEntry[]
}

// ─── Rail naming ─────────────────────────────────────────────────────

/**
 * Canonical rail identifier used in both wallet configuration and the
 * `call()` flow's debug output. Maps to the `scheme` field of a
 * 402-manifest entry via {@link RAIL_FOR_SCHEME} — the mapping is not
 * always identity (the x402 rail advertises as `scheme: 'exact'` per
 * x402 v2's naming convention).
 */
export type RailName = 'exact' | 'mpp' | 'l402' | 'ap2'

/**
 * Map a manifest `scheme` to its canonical RailName. Returns `null`
 * for schemes that this client does not know how to pay — including
 * future rails (`sg-balance`, `ucp`, etc.) that are not yet
 * implemented as payers here.
 */
export function railForScheme(scheme: string): RailName | null {
  switch (scheme) {
    case 'exact':
      return 'exact'
    case 'mpp':
      return 'mpp'
    case 'l402':
      return 'l402'
    case 'ap2':
      return 'ap2'
    default:
      return null
  }
}

// ─── Wallet ──────────────────────────────────────────────────────────

/**
 * Credential bundle the client attaches to outbound payments for a
 * given rail. Shape is rail-specific; the client treats it as an
 * opaque dictionary and forwards rail-relevant fields to the protocol
 * payer.
 *
 * `readOnly: true` marks a wallet whose owner forbids constructing
 * new payments client-side — e.g. a browser that holds a display-only
 * reference to a server-custodied credential. The payer consults this
 * flag during {@link ProtocolPayer.canPay} and returns `false` so the
 * rail is skipped during cheapest-selection.
 */
export interface WalletRef {
  readOnly?: boolean
  [key: string]: unknown
}

// ─── Client surface ──────────────────────────────────────────────────

/**
 * Options accepted by `createSettleGridClient(config)`. Every field is
 * optional; callers who never pay into browser-custodied wallets and
 * accept the default fetch can call `createSettleGridClient()` with
 * zero arguments for read-only discovery.
 */
export interface SettleGridClientConfig {
  /**
   * Override for the fetch implementation. Default: `globalThis.fetch`.
   * Unit tests pass a mock; Node-without-native-fetch callers pass an
   * `undici` or `node-fetch` shim.
   */
  fetch?: typeof fetch

  /**
   * Per-rail wallet registry. A rail without a wallet entry is
   * automatically skipped during cheapest-selection — its payer
   * cannot mint a payment without credentials.
   */
  wallets?: Partial<Record<RailName, WalletRef>>

  /**
   * Default budget cap applied to every `call()` when the caller does
   * not pass `options.maxCostCents`. When omitted, there is NO default
   * cap and budget enforcement happens only when the caller opts in
   * per-call.
   */
  defaultMaxCostCents?: number

  /**
   * Maximum bytes the client will read from a 402 manifest body before
   * aborting as malformed. Defaults to 64 KiB — same cap as the
   * seller-side `streamTextCapped` (see packages/mcp/src/adapters/
   * lightning/voltage.ts). A runaway upstream or malicious response
   * body cannot force unbounded memory allocation in the client.
   */
  manifestMaxBytes?: number
}

/** Per-call options for {@link SettleGridClient.call}. */
export interface CallOptions {
  /**
   * Budget cap for this invocation. Overrides the client's
   * {@link SettleGridClientConfig.defaultMaxCostCents}. When the cheapest
   * supported rail exceeds this cap, {@link BudgetExceededError} is
   * thrown BEFORE any payment is constructed or HTTP retry is issued.
   */
  maxCostCents?: number

  /**
   * Explicit rail preference order. When set, the client selects the
   * cheapest rail among the intersection of (supported ∩ configured ∩
   * preferredRails); if that intersection is empty, falls through to
   * the normal (supported ∩ configured) set. Ignored when empty.
   */
  preferredRails?: readonly RailName[]

  /** AbortSignal propagated to both the initial and retry fetch. */
  signal?: AbortSignal

  /**
   * Extra headers merged into both the initial request and the retry.
   * Payment headers constructed by the payer OVERRIDE any colliding
   * caller-supplied header on the retry — a payer that needs the
   * header to be exact would otherwise be defeated by a caller setting
   * an incompatible value.
   */
  headers?: Record<string, string>
}

/**
 * Handle returned by `createSettleGridClient(config)`. Three named
 * methods matching the P3.K3 spec card verbatim:
 *
 *   - `call(toolUrl, request, options?)`
 *   - `wallet(rail)`
 *   - `discoverProtocols(toolUrl)`
 *
 * The interface is intentionally small. Any additional surface (polling
 * for async payments, batch calls, etc.) belongs in a follow-up card.
 */
export interface SettleGridClient {
  /**
   * Send a request. If the server replies 402, parse the manifest,
   * select the cheapest supported rail that has a configured wallet,
   * verify the budget, construct the payment, and retry the request
   * with the payment headers attached. Return the retry's Response.
   *
   * When the server replies 2xx on the first request (a free tool, or
   * a cached response), no 402 handling runs and the original Response
   * is returned unchanged.
   */
  call(
    toolUrl: string,
    request?: RequestInit,
    options?: CallOptions,
  ): Promise<Response>

  /**
   * Retrieve the wallet reference for a given rail. Returns `undefined`
   * when no wallet is configured for that rail.
   */
  wallet(rail: RailName): WalletRef | undefined

  /**
   * Discover the protocols advertised by a tool without paying. Sends
   * an OPTIONS request; if the server returns a 402-shaped body there,
   * the `accepts` array is returned. When the server rejects OPTIONS
   * (405, 404, or non-JSON body), returns an empty array — callers
   * who need guaranteed discovery should issue a real `call()` and
   * inspect the Response when the first call 402s.
   */
  discoverProtocols(toolUrl: string): Promise<AcceptEntry[]>
}
