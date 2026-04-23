/**
 * @settlegrid/client — buyer-side client for SettleGrid-billed tools.
 *
 * `createSettleGridClient(config)` returns an object with three named
 * methods matching the P3.K3 prompt card verbatim:
 *
 *   - `call(toolUrl, request, options?)` — send, intercept 402,
 *     pick cheapest, pay, retry, return the final Response.
 *   - `wallet(rail)` — read-only accessor for the configured wallet.
 *   - `discoverProtocols(toolUrl)` — OPTIONS probe for the 402 manifest.
 *
 * Three hostile-lens invariants are enforced up front:
 *
 *   (a) Cheapest selection is by ACTUAL minimum cost, not first match.
 *       When a wallet can pay multiple rails, the client compares
 *       `extractCostCents` values and picks the numeric minimum.
 *   (b) Budget check is done BEFORE calling `payer.buildPayment`. A
 *       budget-exceeded condition throws with zero side effects: no
 *       wallet field is read (beyond the prior `canPay` check that
 *       only inspects shape), no payment is constructed, no retry
 *       fetch is issued.
 *   (c) Zero Node-only imports. The module graph is verified in the
 *       test suite (`browser-compat.test.ts`) by grepping imports;
 *       any `node:` or bare `crypto`/`buffer`/`fs` import fails
 *       the build.
 */

import {
  BudgetExceededError,
  ClientConfigurationError,
  MalformedManifestError,
  NoSupportedProtocolError,
} from './errors'
import { streamTextCapped, parsePaymentRequiredBody } from './http'
import { getPayer, type ProtocolPayer } from './protocols'
import type {
  AcceptEntry,
  CallOptions,
  PaymentRequiredBody,
  RailName,
  SettleGridClient,
  SettleGridClientConfig,
  WalletRef,
} from './types'

/** Default cap for 402 manifest body size. */
const DEFAULT_MANIFEST_MAX_BYTES = 64 * 1024

/**
 * Result of {@link selectCheapestRail} — the winning rail bundle plus
 * the full sorted list (kept for future observability hooks).
 */
interface RailSelection {
  payer: ProtocolPayer
  wallet: WalletRef
  entry: AcceptEntry
  costCents: number
}

export function createSettleGridClient(
  config: SettleGridClientConfig = {},
): SettleGridClient {
  // ─── Config validation ─────────────────────────────────────────────
  const fetchImpl = resolveFetch(config.fetch)
  const wallets = config.wallets ?? {}
  const defaultMaxCostCents = validateOptionalBudget(
    config.defaultMaxCostCents,
    'defaultMaxCostCents',
  )
  const manifestMaxBytes = validateManifestCap(
    config.manifestMaxBytes ?? DEFAULT_MANIFEST_MAX_BYTES,
  )

  // Internal helpers closed over config.
  const walletFor = (rail: RailName): WalletRef | undefined => wallets[rail]

  async function call(
    toolUrl: string,
    request: RequestInit,
    options: CallOptions = {},
  ): Promise<Response> {
    validateToolUrl(toolUrl)
    const maxCostCents = validateOptionalBudget(
      options.maxCostCents ?? defaultMaxCostCents,
      'maxCostCents',
    )
    const preferredRails = options.preferredRails
    if (
      preferredRails !== undefined &&
      (!Array.isArray(preferredRails) || preferredRails.length === 0)
    ) {
      throw new ClientConfigurationError({
        field: 'preferredRails',
        reason: 'must be a non-empty array or omitted entirely',
      })
    }

    const initialHeaders = mergeHeaders(request.headers, options.headers)
    const initialInit: RequestInit = {
      ...request,
      headers: initialHeaders,
      signal: options.signal ?? request.signal,
    }

    const firstResponse = await fetchImpl(toolUrl, initialInit)
    if (firstResponse.status !== 402) {
      return firstResponse
    }

    // 402 path — parse manifest, pick rail, check budget, pay, retry.
    const manifest = await readManifest(firstResponse, toolUrl, manifestMaxBytes)
    const selection = selectCheapestRail(
      manifest.accepts,
      walletFor,
      preferredRails,
    )
    if (selection === null) {
      throw new NoSupportedProtocolError({
        advertisedSchemes: manifest.accepts.map((e) => String(e.scheme)),
        toolUrl,
      })
    }

    // ── Hostile-lens invariant (b): budget check BEFORE buildPayment. ──
    if (
      maxCostCents !== undefined &&
      selection.costCents > maxCostCents
    ) {
      throw new BudgetExceededError({
        costCents: selection.costCents,
        maxCostCents,
        rail: selection.payer.rail,
        toolUrl,
      })
    }

    // Construct payment AFTER budget check. The payer's `buildPayment`
    // is async in the interface; today all four payers resolve
    // synchronously, but keeping the await lets a future rail do a
    // round-trip (e.g., mint a fresh Lightning invoice) without
    // breaking the call site.
    const attachment = await selection.payer.buildPayment({
      entry: selection.entry,
      wallet: selection.wallet,
      toolUrl,
    })

    const retryHeaders = mergeHeaders(initialHeaders, attachment.headers)
    const retryInit: RequestInit = {
      ...initialInit,
      headers: retryHeaders,
    }
    const retryResponse = await fetchImpl(toolUrl, retryInit)
    return retryResponse
  }

  async function discoverProtocols(toolUrl: string): Promise<AcceptEntry[]> {
    validateToolUrl(toolUrl)
    let response: Response
    try {
      response = await fetchImpl(toolUrl, { method: 'OPTIONS' })
    } catch {
      // Network / CORS / abort — treat as "no info available".
      return []
    }
    // Accept 200 (server chose to serve the manifest at OPTIONS) or
    // 402 (server enforced payment-required semantics on the OPTIONS
    // probe). Anything else (204, 405, 404) means the server does not
    // expose discovery at OPTIONS — caller should fall back to `call`.
    if (response.status !== 200 && response.status !== 402) {
      try {
        await response.body?.cancel()
      } catch {
        // Best-effort.
      }
      return []
    }
    let manifest: PaymentRequiredBody
    try {
      manifest = await readManifest(response, toolUrl, manifestMaxBytes)
    } catch {
      return []
    }
    return manifest.accepts
  }

  return {
    call,
    wallet: walletFor,
    discoverProtocols,
  }
}

// ─── Internal helpers ────────────────────────────────────────────────

function resolveFetch(override?: typeof fetch): typeof fetch {
  if (override !== undefined) {
    if (typeof override !== 'function') {
      throw new ClientConfigurationError({
        field: 'fetch',
        reason: 'must be a function or omitted entirely',
      })
    }
    return override
  }
  // `globalThis.fetch` exists in Node 18+ and all modern browsers.
  // Binding it to `globalThis` is required in some engines where
  // `fetch` is a bound method on `globalThis` — calling it as a
  // free function would throw an Illegal invocation error.
  const native = (globalThis as { fetch?: typeof fetch }).fetch
  if (typeof native !== 'function') {
    throw new ClientConfigurationError({
      field: 'fetch',
      reason:
        'no fetch implementation is available on globalThis. Pass `config.fetch` ' +
        'explicitly (e.g., from `undici` or `node-fetch` in older Node runtimes).',
    })
  }
  return native.bind(globalThis)
}

function validateToolUrl(toolUrl: unknown): asserts toolUrl is string {
  if (typeof toolUrl !== 'string' || toolUrl.length === 0) {
    throw new ClientConfigurationError({
      field: 'toolUrl',
      reason: 'must be a non-empty string',
    })
  }
  // Parse as URL early so a malformed URL fails with a clear error
  // rather than a fetch "Invalid URL" buried several frames deep.
  try {
    // eslint-disable-next-line no-new
    new URL(toolUrl)
  } catch {
    throw new ClientConfigurationError({
      field: 'toolUrl',
      reason: `invalid URL: ${toolUrl}`,
    })
  }
}

function validateOptionalBudget(
  value: number | undefined,
  field: string,
): number | undefined {
  if (value === undefined) return undefined
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new ClientConfigurationError({
      field,
      reason: 'must be a non-negative integer (cents) or omitted entirely',
    })
  }
  return value
}

function validateManifestCap(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1024
  ) {
    throw new ClientConfigurationError({
      field: 'manifestMaxBytes',
      reason:
        'must be a positive integer ≥ 1024 bytes (a realistic manifest is 200-2000 bytes)',
    })
  }
  return value
}

/**
 * Read a 402 manifest body with a hard byte cap and a shape check.
 * Wraps any failure in {@link MalformedManifestError} with the
 * tool URL for debugging.
 */
async function readManifest(
  response: Response,
  toolUrl: string,
  maxBytes: number,
): Promise<PaymentRequiredBody> {
  let raw: string
  try {
    raw = await streamTextCapped(response, maxBytes)
  } catch (err) {
    throw new MalformedManifestError({
      toolUrl,
      reason: err instanceof Error ? err.message : String(err),
    })
  }
  let parsed: unknown
  try {
    parsed = parsePaymentRequiredBody(raw)
  } catch (err) {
    throw new MalformedManifestError({
      toolUrl,
      reason: err instanceof Error ? err.message : String(err),
    })
  }
  // Additional shape validation: every accepts entry must be a
  // non-null object with a string `scheme`. Entries that fail this
  // shape are DROPPED rather than rejecting the whole manifest —
  // a single malformed entry should not take down a manifest that
  // advertises three valid rails alongside one broken one.
  const body = parsed as PaymentRequiredBody
  const cleanAccepts: AcceptEntry[] = []
  for (const entry of body.accepts) {
    if (
      entry !== null &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      typeof (entry as AcceptEntry).scheme === 'string'
    ) {
      cleanAccepts.push(entry as AcceptEntry)
    }
  }
  if (cleanAccepts.length === 0) {
    throw new MalformedManifestError({
      toolUrl,
      reason: 'no entries in the 402 `accepts` array have a string `scheme` field',
    })
  }
  return { ...body, accepts: cleanAccepts }
}

/**
 * Pick the cheapest rail the client can pay. Returns `null` when no
 * rail is payable (no configured wallet with `canPay=true` on a
 * supported scheme, or every candidate had a null cost).
 *
 * When `preferredRails` is provided, it acts as a STRICT allowlist —
 * the selection is made only within the intersection of
 * (supported ∩ configured ∩ preferred), with no fallthrough to
 * rails outside the preferred set. This matches the spec's "picks
 * the cheapest SUPPORTED protocol" language while still giving the
 * caller an escape hatch for rail-specific integration tests.
 */
function selectCheapestRail(
  accepts: AcceptEntry[],
  walletFor: (rail: RailName) => WalletRef | undefined,
  preferredRails: readonly RailName[] | undefined,
): RailSelection | null {
  const candidates: RailSelection[] = []
  const preferredSet =
    preferredRails !== undefined ? new Set(preferredRails) : null
  for (const entry of accepts) {
    const payer = getPayer(entry.scheme)
    if (!payer) continue
    if (preferredSet !== null && !preferredSet.has(payer.rail)) continue
    const wallet = walletFor(payer.rail)
    if (!payer.canPay(wallet)) continue
    const cost = payer.extractCostCents(entry)
    if (cost === null) continue
    candidates.push({
      payer,
      // `canPay` returned true, so wallet is guaranteed defined.
      wallet: wallet as WalletRef,
      entry,
      costCents: cost,
    })
  }
  if (candidates.length === 0) return null
  // Sort ascending by cost; tiebreaker is original-order preservation
  // so that ties are stable w.r.t. the server's manifest order (the
  // server may rank by preference; honoring that rank on ties is a
  // reasonable default).
  candidates.sort((a, b) => a.costCents - b.costCents)
  return candidates[0]
}

/**
 * Merge multiple header sources into a single plain object. Later
 * sources override earlier ones on key collision. Accepts any of the
 * three forms the Headers API allows (Headers, array-of-tuples,
 * record) and normalizes to a plain object keyed by lowercased
 * header names.
 */
function mergeHeaders(
  ...sources: Array<HeadersInit | Record<string, string> | undefined>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const source of sources) {
    if (source === undefined) continue
    if (source instanceof Headers) {
      source.forEach((value, key) => {
        out[key.toLowerCase()] = value
      })
    } else if (Array.isArray(source)) {
      for (const pair of source) {
        if (Array.isArray(pair) && pair.length === 2) {
          out[String(pair[0]).toLowerCase()] = String(pair[1])
        }
      }
    } else if (source !== null && typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        if (value === undefined || value === null) continue
        out[key.toLowerCase()] = String(value)
      }
    }
  }
  return out
}

// Export for unit tests — NOT part of the public API (barrel in
// src/index.ts does not re-export these). Tests need to exercise the
// selection + merge helpers independently.
export const __internal__ = {
  selectCheapestRail,
  mergeHeaders,
  readManifest,
}
