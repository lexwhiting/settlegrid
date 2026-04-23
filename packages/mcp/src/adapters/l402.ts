/**
 * L402 Protocol Adapter — Bitcoin Lightning (LSAT / Macaroons)
 *
 * L402 uses HTTP 402 + Bitcoin Lightning invoices + Macaroons:
 *   - Agent hits endpoint, gets 402 with Lightning invoice + macaroon
 *   - Agent pays invoice via Lightning Network
 *   - Agent presents macaroon as auth token for subsequent calls
 *   - No API keys, no signup — fully pseudonymous per-request payments
 *
 * P2.K2 migrates the validation + 402 generation logic out of
 * apps/web/src/lib/l402-proxy.ts. The module-level `validateL402Payment`
 * and `generateL402_402Response` functions are env-agnostic (they accept
 * all required config via `options`) so the adapter package stays
 * self-contained; the `apps/web/src/lib/l402-proxy.ts` file is now a
 * thin re-export that binds `./env` and `./logger`.
 *
 * @see https://docs.lightning.engineering/the-lightning-network/l402
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { randomUUID } from 'crypto'
import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type { SettleGridInternalEvent } from '../rails/types'
import {
  createLndClient,
  LND_NOT_WIRED_MESSAGE,
} from './lightning/lnd'
import type { VoltageClient, VoltageInvoice } from './lightning/voltage'
import { createVoltageClient } from './lightning/voltage'
import type {
  AdapterLogger,
  PaymentContext,
  ProtocolAdapter,
  SettlementResult,
} from './types'
import { NOOP_LOGGER } from './types'

// ─── L402 Constants ─────────────────────────────────────────────────────────

const L402_PROTOCOL_VERSION = '1.0'

/** L402-specific HTTP headers */
const L402_HEADERS = {
  /** Standard L402 WWW-Authenticate response header */
  WWW_AUTHENTICATE: 'WWW-Authenticate',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

/** Default macaroon expiry in seconds (1 hour) */
const DEFAULT_MACAROON_EXPIRY_SECONDS = 3600

/**
 * P3.K2 — maximum request body size inspected by `detect()` when
 * probing for L402 signatures. Same 64 KiB cap as the P3.K1 MPP
 * adapter; identical rationale (body-DoS amplification guard).
 */
const L402_DETECT_MAX_BODY_BYTES = 64 * 1024

/**
 * Millisatoshi per BTC = 100,000,000 sats × 1000 msat/sat. Used by
 * the settle() fiat-conversion path. Extracted as a constant so the
 * msat → fiat math is reviewable in one place.
 */
const MSAT_PER_BTC = 100_000_000_000

/**
 * TTL for the in-memory BTC/USD rate cache, in milliseconds.
 * 60 seconds is a reasonable balance: short enough that a rapid
 * price move is reflected within a minute, long enough that a burst
 * of invocations doesn't hammer the upstream rate API. Exported
 * primarily so tests can override via the fetcher constructor.
 */
const RATE_CACHE_TTL_MS = 60_000

/**
 * Default BTC/USD rate source. CoinGecko's public API requires no
 * key and serves JSON in the shape `{ bitcoin: { usd: 100000 } }`.
 * Per hostile-audit rule (b), the adapter MUST NOT hardcode the
 * rate — this URL is a *fetcher source*, not a constant rate. When
 * the source is unreachable the CoinGeckoRateFetcher below throws
 * and `settle()` surfaces the failure to the caller rather than
 * silently substituting a stale cached value.
 */
const DEFAULT_BTC_USD_RATE_SOURCE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'

/** Timeout in ms for rate-source HTTP calls. */
const RATE_FETCH_TIMEOUT_MS = 5_000

/** Cap on bytes read from the rate source (tiny JSON; 1 KiB is plenty). */
const RATE_FETCH_MAX_BODY_BYTES = 1024

/**
 * Dev fallback signing key — production callers MUST supply a real one via
 * options.signingKey (wired from LND_MACAROON_HEX or L402_SIGNING_KEY in the
 * lib shim). P2.K2 hostile-review H1: when `enabled=true` and no signingKey
 * is supplied, `validateL402Payment` and `generateL402_402Response` log a
 * warning on every call. The fallback stays (to preserve legacy behavior
 * for dev environments that never set the env var) but is no longer
 * silent — any production deploy running on the fallback will show up
 * in the error logs immediately, surfacing the cross-instance macaroon
 * forgery risk before it matters.
 */
const L402_DEV_SIGNING_KEY = 'settlegrid-l402-dev-key'

// ─── Public types ──────────────────────────────────────────────────────────

export interface L402PaymentResult {
  valid: boolean
  macaroonId?: string
  preimageHash?: string
  toolSlug?: string
  amountSats?: number
  error?: { code: L402ErrorCode; message: string }
}

export type L402ErrorCode =
  | 'L402_NOT_CONFIGURED'
  | 'L402_MACAROON_MISSING'
  | 'L402_MACAROON_INVALID'
  | 'L402_MACAROON_EXPIRED'
  | 'L402_PREIMAGE_MISSING'
  | 'L402_PREIMAGE_INVALID'
  | 'L402_CAVEAT_VIOLATION'
  | 'L402_INVOICE_GENERATION_FAILED'
  | 'L402_LND_ERROR'

export interface L402ToolConfig {
  slug: string
  costCents: number
  displayName: string
}

/**
 * Options for {@link validateL402Payment}. The adapter package is env-agnostic
 * so every value the validation logic needs (feature flag, signing key, LND
 * connection, logger) is passed in explicitly. The app-side wrapper in
 * apps/web/src/lib/l402-proxy.ts wires these from env.ts + logger.ts.
 */
export interface L402ValidateOptions {
  /** Whether L402 is enabled (env.L402_ENABLED || LND_REST_URL). */
  enabled: boolean
  /** Tool cost + slug + display name. */
  toolConfig: L402ToolConfig
  /**
   * HMAC signing key for the macaroon chain. Falls back to a dev key if
   * absent — production MUST pass a real key from LND_MACAROON_HEX or
   * L402_SIGNING_KEY. Reusing the dev key across instances means any
   * instance can forge macaroons for any other.
   */
  signingKey?: string
  /** Optional logger — defaults to no-op. */
  logger?: AdapterLogger
}

/** Options for {@link generateL402_402Response}. */
export interface L402_402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  /** Fully-qualified app URL used for the payment_endpoint + directory_url. */
  appUrl: string
  /** Signing key — same fallback semantics as L402ValidateOptions.signingKey. */
  signingKey?: string
  /** Optional LND REST URL — when absent, a mock invoice is generated. */
  lndRestUrl?: string
  /** Optional LND macaroon hex — sent as Grpc-Metadata-macaroon header. */
  lndMacaroonHex?: string
  /**
   * Optional override of the BTC/USD rate (in whole USD per BTC). Mirrors
   * the L402_BTC_USD_RATE env var the lib used — defaults to $100,000.
   */
  btcUsdRate?: number
  /** Optional logger — defaults to no-op. */
  logger?: AdapterLogger
}

// ─── Macaroon types + helpers ──────────────────────────────────────────────

interface MacaroonCaveat {
  key: string
  value: string
}

interface Macaroon {
  id: string
  location: string
  signature: string
  caveats: MacaroonCaveat[]
}

function hmacSign(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex')
}

/**
 * Timing-safe hex string comparison. Both args are hex-encoded HMAC-SHA256
 * digests (always 64 hex chars), but we guard on length mismatch to avoid
 * timingSafeEqual throwing on unequal buffer sizes — a malformed macaroon
 * with a shorter signature returns false cleanly instead of a thrown
 * RangeError (which would propagate past the verifyMacaroon caller).
 *
 * Hostile-review M2: the original `===` comparison in `verifyMacaroon`
 * was a standard timing oracle for HMAC-backed auth tokens. Macaroons
 * are 16-byte (128-bit) random IDs, so a real attack is infeasible,
 * but matching the crypto best-practice here is free and removes the
 * static-analysis flag.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/**
 * Mint a macaroon. The `paymentHash` parameter is a P3.K2 addition:
 * when supplied, it's embedded as a caveat so the server can later
 * verify a client-supplied preimage by hashing the preimage and
 * comparing against the bound `payment_hash` — the spec-required
 * actual-hash check (hostile audit rule a), instead of a length-only
 * check. Legacy call sites that omit `paymentHash` continue to mint
 * preimage-agnostic macaroons; `validateL402Payment` preserves the
 * length-only fallback for those (documented at the validator).
 */
function mintMacaroon(
  toolSlug: string,
  costCents: number,
  amountSats: number,
  location: string,
  signingKey: string,
  paymentHash?: string,
): Macaroon {
  const id = randomBytes(16).toString('hex')
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + DEFAULT_MACAROON_EXPIRY_SECONDS

  const caveats: MacaroonCaveat[] = [
    { key: 'service', value: `settlegrid:${toolSlug}` },
    { key: 'amount_sats', value: String(amountSats) },
    { key: 'amount_cents', value: String(costCents) },
    { key: 'expires_at', value: String(expiresAt) },
    { key: 'created_at', value: String(now) },
  ]
  if (typeof paymentHash === 'string' && paymentHash.length > 0) {
    caveats.push({ key: 'payment_hash', value: paymentHash.toLowerCase() })
  }

  let signature = hmacSign(signingKey, id)
  for (const caveat of caveats) {
    signature = hmacSign(signature, `${caveat.key}=${caveat.value}`)
  }

  return { id, location, signature, caveats }
}

function serializeMacaroon(macaroon: Macaroon): string {
  const payload = JSON.stringify({
    id: macaroon.id,
    location: macaroon.location,
    caveats: macaroon.caveats,
    signature: macaroon.signature,
  })
  return Buffer.from(payload).toString('base64')
}

function deserializeMacaroon(encoded: string): Macaroon | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded) as Record<string, unknown>

    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.signature !== 'string' ||
      !Array.isArray(parsed.caveats)
    ) {
      return null
    }

    return {
      id: parsed.id,
      location: typeof parsed.location === 'string' ? parsed.location : '',
      signature: parsed.signature,
      caveats: (parsed.caveats as Array<Record<string, string>>).map((c) => ({
        key: String(c.key ?? ''),
        value: String(c.value ?? ''),
      })),
    }
  } catch {
    return null
  }
}

function verifyMacaroon(
  macaroon: Macaroon,
  toolSlug: string,
  signingKey: string,
): { valid: boolean; error?: string } {
  let expectedSig = hmacSign(signingKey, macaroon.id)
  for (const caveat of macaroon.caveats) {
    expectedSig = hmacSign(expectedSig, `${caveat.key}=${caveat.value}`)
  }

  // Hostile-review M2: timing-safe comparison of HMAC digests.
  if (!timingSafeHexEqual(expectedSig, macaroon.signature)) {
    return { valid: false, error: 'Macaroon signature is invalid.' }
  }

  const now = Math.floor(Date.now() / 1000)

  for (const caveat of macaroon.caveats) {
    if (caveat.key === 'expires_at') {
      const expiresAt = parseInt(caveat.value, 10)
      if (Number.isFinite(expiresAt) && now > expiresAt) {
        return { valid: false, error: `Macaroon expired ${now - expiresAt}s ago.` }
      }
    }

    if (caveat.key === 'service') {
      const expectedService = `settlegrid:${toolSlug}`
      if (caveat.value !== expectedService) {
        return {
          valid: false,
          error: `Macaroon was issued for service "${caveat.value}", not "${expectedService}".`,
        }
      }
    }
  }

  return { valid: true }
}

function extractAmountSats(macaroon: Macaroon): number {
  const caveat = macaroon.caveats.find((c) => c.key === 'amount_sats')
  if (!caveat) return 0
  const parsed = parseInt(caveat.value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Convert cents to satoshis using the supplied BTC/USD rate.
 * Falls back to $100,000/BTC if no rate is supplied or rate is invalid.
 */
function centsToSats(cents: number, btcUsdRate: number | undefined): number {
  const rate = btcUsdRate && Number.isFinite(btcUsdRate) && btcUsdRate > 0 ? btcUsdRate : 100_000
  const satsPerBtc = 100_000_000
  const sats = Math.ceil((cents / 100) * (satsPerBtc / rate))
  return Math.max(sats, 1)
}

// ─── Lightning invoice generation ──────────────────────────────────────────

async function generateLightningInvoice(
  amountSats: number,
  memo: string,
  lndRestUrl: string | undefined,
  lndMacaroonHex: string | undefined,
  logger: AdapterLogger,
): Promise<{ paymentRequest: string; rHash: string } | null> {
  if (!lndRestUrl) {
    const mockHash = randomBytes(32).toString('hex')
    const mockInvoice = `lnbc${amountSats}n1p0settlegrid${randomBytes(20).toString('hex')}`

    logger.info('l402.mock_invoice_generated', {
      amountSats,
      memo,
      note: 'LND_REST_URL not configured; using mock invoice.',
    })

    return { paymentRequest: mockInvoice, rHash: mockHash }
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (lndMacaroonHex) headers['Grpc-Metadata-macaroon'] = lndMacaroonHex

    const response = await fetch(`${lndRestUrl}/v1/invoices`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        value: String(amountSats),
        memo,
        expiry: String(DEFAULT_MACAROON_EXPIRY_SECONDS),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('l402.lnd_invoice_error', {
        status: response.status,
        body: errorBody.slice(0, 200),
      })
      return null
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      paymentRequest: typeof data.payment_request === 'string' ? data.payment_request : '',
      rHash: typeof data.r_hash === 'string' ? data.r_hash : '',
    }
  } catch (err) {
    logger.error('l402.lnd_connection_error', { lndRestUrl }, err)
    return null
  }
}

// ─── P3.K2 — BTC/USD rate fetcher ─────────────────────────────────────────
//
// Hostile audit (b) requires `settle()` to convert msat → fiat via a
// LIVE rate source, not a hardcoded constant. The fetcher interface
// is injectable so tests can supply deterministic rates (no network),
// and the default implementation pulls from CoinGecko's public API
// with a 60s in-memory cache + a hard body-size cap on the response.

export interface BtcUsdRateFetcher {
  /**
   * Resolve the current BTC/USD spot rate in whole USD per BTC
   * (e.g., `100000` when 1 BTC = $100,000). May return a cached
   * value when a recent fetch is still within TTL.
   */
  fetchBtcUsdRate(): Promise<number>
}

export interface CoinGeckoRateFetcherOptions {
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch
  /** Override the source URL (e.g., point at a mock in tests). */
  sourceUrl?: string
  /** Override the cache TTL (ms). Defaults to `RATE_CACHE_TTL_MS`. */
  cacheTtlMs?: number
  /** Override the per-request timeout (ms). Defaults to `RATE_FETCH_TIMEOUT_MS`. */
  timeoutMs?: number
  /** Injectable clock for deterministic cache-expiry tests. */
  now?: () => number
}

/**
 * Default BTC/USD rate fetcher backed by CoinGecko's public
 * `simple/price` endpoint. No API key required; rate-limited at ~30
 * requests/minute per IP — well above the cache-aware throughput
 * this adapter will generate.
 *
 * The class is explicitly exported so production callers can
 * construct ONE instance and share it across multiple L402
 * adapter invocations — the cache is per-instance, and multiple
 * instances would defeat the cache.
 */
export class CoinGeckoRateFetcher implements BtcUsdRateFetcher {
  private cache: { rate: number; expiresAt: number } | null = null
  private readonly fetchImpl: typeof fetch
  private readonly sourceUrl: string
  private readonly cacheTtlMs: number
  private readonly timeoutMs: number
  private readonly now: () => number

  constructor(options: CoinGeckoRateFetcherOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.sourceUrl = options.sourceUrl ?? DEFAULT_BTC_USD_RATE_SOURCE_URL
    this.cacheTtlMs = options.cacheTtlMs ?? RATE_CACHE_TTL_MS
    this.timeoutMs = options.timeoutMs ?? RATE_FETCH_TIMEOUT_MS
    this.now = options.now ?? Date.now
  }

  async fetchBtcUsdRate(): Promise<number> {
    const now = this.now()
    if (this.cache !== null && this.cache.expiresAt > now) {
      return this.cache.rate
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(this.sourceUrl, {
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`Rate source ${this.sourceUrl} returned HTTP ${response.status}.`)
      }
      // Enforce a tiny body cap — rate responses are ~60 bytes. A
      // large response is almost certainly a misconfigured proxy or
      // an injection attempt.
      const contentLengthHeader = response.headers.get('content-length')
      if (contentLengthHeader !== null) {
        const parsed = Number.parseInt(contentLengthHeader, 10)
        if (Number.isFinite(parsed) && parsed > RATE_FETCH_MAX_BODY_BYTES) {
          throw new Error(
            `Rate source body (${parsed} bytes) exceeds ${RATE_FETCH_MAX_BODY_BYTES}-byte cap.`,
          )
        }
      }
      const text = await response.text()
      if (text.length > RATE_FETCH_MAX_BODY_BYTES) {
        throw new Error(
          `Rate source body (${text.length} chars) exceeds ${RATE_FETCH_MAX_BODY_BYTES}-byte cap after materialization.`,
        )
      }
      const parsed = JSON.parse(text) as unknown
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Rate source returned a non-object JSON body.')
      }
      const root = parsed as Record<string, unknown>
      const bitcoinEntry = root.bitcoin
      if (
        bitcoinEntry === null ||
        typeof bitcoinEntry !== 'object' ||
        Array.isArray(bitcoinEntry)
      ) {
        throw new Error('Rate source missing `bitcoin` object.')
      }
      const rate = (bitcoinEntry as Record<string, unknown>).usd
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(
          `Rate source returned invalid USD rate: ${JSON.stringify(rate)}.`,
        )
      }
      this.cache = { rate, expiresAt: now + this.cacheTtlMs }
      return rate
    } finally {
      clearTimeout(timer)
    }
  }
}

// ─── P3.K2 — Backend dispatch ──────────────────────────────────────────────

/**
 * Resolve the `L402_BACKEND` env value into the backend literal.
 * `undefined` defaults to `'voltage'` per the spec's "Voltage hosted
 * node by default; LND-direct as fallback." Any other value throws
 * — a misspelled env var should surface immediately, not silently
 * fall back to the default and mask the misconfiguration.
 */
export function resolveLightningBackend(envValue?: string | null): 'voltage' | 'lnd' {
  if (envValue === undefined || envValue === null || envValue === '') {
    return 'voltage'
  }
  const normalized = envValue.toLowerCase()
  if (normalized === 'voltage') return 'voltage'
  if (normalized === 'lnd') return 'lnd'
  throw new Error(
    `L402_BACKEND must be 'voltage' or 'lnd'; got ${JSON.stringify(envValue)}.`,
  )
}

/**
 * Construct a Lightning client for the configured backend. The
 * `lnd` branch delegates to `createLndClient()` which throws the
 * spec-named message — that surfaces to the caller with
 * {@link LND_NOT_WIRED_MESSAGE} so the operator sees exactly which
 * backend they need to implement before flipping the env var.
 */
export interface LightningClientOptions {
  backend?: 'voltage' | 'lnd' | string
  nodeUrl: string
  macaroon: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export function createLightningClient(options: LightningClientOptions): VoltageClient {
  const backend = resolveLightningBackend(options.backend)
  if (backend === 'lnd') {
    return createLndClient()
  }
  return createVoltageClient({
    nodeUrl: options.nodeUrl,
    macaroon: options.macaroon,
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  })
}

// ─── Credential extraction ─────────────────────────────────────────────────

function extractL402Credentials(
  request: Request,
): { macaroonEncoded: string; preimage: string } | null {
  const auth = request.headers.get('authorization')
  if (!auth) return null

  const trimmed = auth.trim()
  let tokenPart: string

  if (trimmed.startsWith('L402 ')) {
    tokenPart = trimmed.slice(5).trim()
  } else if (trimmed.startsWith('LSAT ')) {
    tokenPart = trimmed.slice(5).trim()
  } else {
    return null
  }

  const colonIndex = tokenPart.lastIndexOf(':')
  if (colonIndex === -1) return null

  const macaroonEncoded = tokenPart.slice(0, colonIndex)
  const preimage = tokenPart.slice(colonIndex + 1)
  if (!macaroonEncoded || !preimage) return null

  return { macaroonEncoded, preimage }
}

// ─── Adapter class ─────────────────────────────────────────────────────────

export class L402Adapter implements ProtocolAdapter {
  readonly name = 'l402' as const
  readonly displayName = 'L402 (Bitcoin Lightning)'

  /**
   * P3.K2 — adapter-local idempotency cache used by `settle()` when
   * the caller does not inject its own store. Maps `invocationId` →
   * cached `L402SettleResult` so repeat calls with the same ID
   * short-circuit without re-emitting the settlement event.
   *
   * Same growth + race caveats as the P3.K1 MPPAdapter settle cache:
   * production callers MUST inject an external `idempotencyStore`
   * backed by durable storage; the in-adapter Map is explicitly
   * scoped to tests + short-lived dev invocations. Two parallel
   * settles that both pass the cache check before either's
   * `recordInvocation` completes can produce a stale
   * `'already-settled'` return if the first settle's ledger write
   * fails — callers that need strict consistency MUST serialize
   * per-invocationId upstream.
   */
  private readonly settleCache = new Map<string, L402SettleResult>()

  /**
   * Detect if this request is an L402 payment.
   * L402 requests have:
   *   - Authorization: L402 <macaroon>:<preimage>  (standard)
   *   - Authorization: LSAT <macaroon>:<preimage>  (legacy LSAT format)
   *   - OR x-settlegrid-protocol: l402
   */
  canHandle(request: Request): boolean {
    const auth = request.headers.get('authorization')
    if (auth) {
      const trimmed = auth.trim()
      if (trimmed.startsWith('L402 ') || trimmed.startsWith('LSAT ')) return true
    }
    if (request.headers.get(L402_HEADERS.PROTOCOL) === 'l402') return true
    return false
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const creds = extractL402Credentials(request)
    if (!creds) {
      throw new Error('No L402 credentials in Authorization header')
    }

    const macaroon = deserializeMacaroon(creds.macaroonEncoded)
    const macaroonId = macaroon?.id ?? 'unknown'
    const service =
      macaroon?.caveats.find((c) => c.key === 'service')?.value ?? 'l402-service'
    const amountSats = macaroon ? extractAmountSats(macaroon) : 0

    return {
      protocol: 'l402',
      identity: {
        type: 'jwt',
        value: macaroonId,
        metadata: { preimagePrefix: creds.preimage.slice(0, 8) + '...' },
      },
      operation: {
        service,
        method: 'payment',
      },
      payment: {
        type: 'crypto',
        proof: creds.preimage,
        ...(amountSats > 0
          ? { amount: { value: BigInt(amountSats), currency: 'sats' } }
          : {}),
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'l402',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        receipt: result.receipt ?? null,
        metadata: {
          protocol: result.metadata.protocol,
          latencyMs: result.metadata.latencyMs,
          settlementType: result.metadata.settlementType,
        },
      }),
      { status: 200, headers },
    )
  }

  formatError(error: Error, request: Request): Response {
    const msg = error.message.toLowerCase()
    const isAuthError =
      msg.includes('macaroon') ||
      msg.includes('preimage') ||
      msg.includes('expired') ||
      msg.includes('invalid') ||
      msg.includes('unauthorized')

    const status = isAuthError ? 401 : 500
    const code = isAuthError ? 'L402_MACAROON_INVALID' : 'L402_LND_ERROR'

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'l402' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    )
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(request: Request, options: L402ValidateOptions): Promise<L402PaymentResult> {
    return validateL402Payment(request, options)
  }

  /** P2.K2 — generate a full L402 402 Payment Required response (async: mints Lightning invoice). */
  async build402Response(options: L402_402Options): Promise<Response> {
    return generateL402_402Response(options)
  }

  // ─── P3.K2 — Spec-aligned "standard adapter interface" methods ────────────
  //
  // Matches the pattern established by P3.K1 on the MPP adapter:
  // four spec-named methods (`detect`, `buildChallenge`,
  // `verifyPayment`, `settle`) layered on top of the existing
  // ProtocolAdapter surface. Legacy exports (`L402Adapter.verify`,
  // `validateL402Payment`, `generateL402_402Response`) are
  // deliberately preserved unchanged so the `apps/web/src/lib/l402-proxy.ts`
  // shim and the P2.K2 test file (`__tests__/adapter-l402.test.ts`)
  // keep working.

  /**
   * P3.K2 — detection with CONFIDENCE SCORE in [0, 1]. Examines
   * headers AND request body (per spec: "detect looks for L402
   * challenge headers — WWW-Authenticate: L402 or the macaroon-
   * and-preimage envelope").
   *
   * HEADER signatures:
   *   1.00 — `Authorization: L402 <macaroon>:<preimage>`
   *   1.00 — `Authorization: LSAT <macaroon>:<preimage>` (legacy)
   *   0.90 — `WWW-Authenticate: L402 ...` (client echoing server challenge)
   *   0.70 — `x-settlegrid-protocol: l402` opt-in hint
   *
   * BODY signatures (body capped at L402_DETECT_MAX_BODY_BYTES per
   * hostile-audit body-DoS rule):
   *   0.50 — JSON body with `protocol: 'l402'` or `scheme: 'l402'`
   *   0.40 — JSON body carrying both `macaroon` and `preimage`
   *          fields (the macaroon-and-preimage envelope form)
   *
   * Returns { confidence, reasons }. `canHandle()` remains sync +
   * headers-only (see its JSDoc for the registry-contract rationale
   * and the body-only routing invariant).
   */
  async detect(request: Request): Promise<L402DetectionResult> {
    const reasons: string[] = []
    let confidence = 0

    const auth = request.headers.get('authorization')
    if (auth) {
      const trimmed = auth.trim()
      if (trimmed.startsWith('L402 ')) {
        reasons.push('authorization: L402 *')
        confidence = Math.max(confidence, 1.0)
      } else if (trimmed.startsWith('LSAT ')) {
        reasons.push('authorization: LSAT *')
        confidence = Math.max(confidence, 1.0)
      }
    }

    const wwwAuth = request.headers.get('www-authenticate')
    if (wwwAuth && /\bL402\b/i.test(wwwAuth)) {
      reasons.push('www-authenticate: L402 *')
      confidence = Math.max(confidence, 0.9)
    }

    if (request.headers.get(L402_HEADERS.PROTOCOL) === 'l402') {
      reasons.push('x-settlegrid-protocol: l402')
      confidence = Math.max(confidence, 0.7)
    }

    const bodyShape = await this.sniffBodyShape(request)
    if (bodyShape === 'l402-envelope') {
      reasons.push('body: L402 envelope shape')
      confidence = Math.max(confidence, 0.5)
    } else if (bodyShape === 'macaroon-and-preimage') {
      reasons.push('body: macaroon+preimage envelope')
      confidence = Math.max(confidence, 0.4)
    }

    return { confidence, reasons }
  }

  /**
   * Inspect the request body for L402-specific shapes. Same
   * resilience contract as the P3.K1 MPP adapter: never throws,
   * returns null on any parse / size / shape failure, guarded
   * against bodyUsed / oversize inputs.
   */
  private async sniffBodyShape(
    request: Request,
  ): Promise<'l402-envelope' | 'macaroon-and-preimage' | null> {
    try {
      if (request.bodyUsed) return null
      const contentLengthHeader = request.headers.get('content-length')
      if (contentLengthHeader !== null) {
        const parsed = Number.parseInt(contentLengthHeader, 10)
        if (Number.isFinite(parsed) && parsed > L402_DETECT_MAX_BODY_BYTES) {
          return null
        }
      }
      const clone = request.clone()
      const text = await clone.text()
      if (text.length === 0) return null
      if (text.length > L402_DETECT_MAX_BODY_BYTES) return null
      const parsed: unknown = JSON.parse(text)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null
      }
      const body = parsed as Record<string, unknown>
      if (body.protocol === 'l402' || body.scheme === 'l402') {
        return 'l402-envelope'
      }
      if (typeof body.macaroon === 'string' && typeof body.preimage === 'string') {
        return 'macaroon-and-preimage'
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * P3.K2 — spec-aligned `buildChallenge` overload. Two call shapes:
   *
   *   1. `buildChallenge(BuildChallengeOptions): AcceptEntry`
   *      (inherited from ProtocolAdapter; emits the narrow entry
   *      the multi-protocol 402 manifest expects)
   *
   *   2. `buildChallenge(L402ChallengeOptions): Promise<L402ChallengeEnvelope>`
   *      (spec-aligned: calls the Voltage client to mint a real
   *      invoice, derives the msat→sats amount, mints a macaroon
   *      bound to the invoice's `payment_hash`, and returns the
   *      full envelope the consumer needs to pay)
   *
   * Dispatch discriminates on the presence of `lightningClient` —
   * `BuildChallengeOptions` never carries that field, and
   * `L402ChallengeOptions` always does.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry
  buildChallenge(options: L402ChallengeOptions): Promise<L402ChallengeEnvelope>
  buildChallenge(
    options: BuildChallengeOptions | L402ChallengeOptions,
  ): AcceptEntry | Promise<L402ChallengeEnvelope> {
    if (
      options === null ||
      options === undefined ||
      typeof options !== 'object' ||
      Array.isArray(options)
    ) {
      throw new TypeError(
        `buildChallenge: \`options\` must be a non-null object; received ${
          options === null
            ? 'null'
            : Array.isArray(options)
              ? 'array'
              : typeof options
        }.`,
      )
    }
    if (
      'lightningClient' in options &&
      options.lightningClient !== null &&
      typeof options.lightningClient === 'object'
    ) {
      return this.buildL402Challenge(options as L402ChallengeOptions)
    }
    const narrowOptions = options as BuildChallengeOptions
    const method = narrowOptions.method ?? 'default'
    const rawCost = resolveOperationCost(narrowOptions.pricing, method)
    const costCents =
      Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'l402',
      provider: 'lightning',
      costCents,
      currency: 'btc-lightning',
      acceptedPayments: ['lightning-invoice'],
    }
  }

  /**
   * Mint a real L402 challenge: Voltage invoice + macaroon bound to
   * the invoice's payment_hash. Returns an envelope the caller can
   * serialize into a 402 body.
   */
  private async buildL402Challenge(
    options: L402ChallengeOptions,
  ): Promise<L402ChallengeEnvelope> {
    if (
      typeof options.toolSlug !== 'string' ||
      options.toolSlug.length === 0
    ) {
      throw new Error(
        'buildChallenge: `toolSlug` is required and must be a non-empty string.',
      )
    }
    if (
      typeof options.amountMsat !== 'number' ||
      !Number.isFinite(options.amountMsat) ||
      !Number.isInteger(options.amountMsat) ||
      options.amountMsat < 1
    ) {
      throw new RangeError(
        `buildChallenge: \`amountMsat\` must be a positive integer (msat); got ${JSON.stringify(
          options.amountMsat,
        )}.`,
      )
    }
    if (
      typeof options.signingKey !== 'string' ||
      options.signingKey.length === 0
    ) {
      throw new Error(
        'buildChallenge: `signingKey` is required; wire from LND_MACAROON_HEX or L402_SIGNING_KEY.',
      )
    }
    const memo = options.memo ?? `SettleGrid: ${options.toolSlug}`
    const invoice = await options.lightningClient.createInvoice(
      options.amountMsat,
      {
        memo,
        ...(options.expirySeconds !== undefined
          ? { expirySeconds: options.expirySeconds }
          : {}),
      },
    )
    const amountSats = Math.ceil(options.amountMsat / 1000)
    const costCents = options.costCents ?? 0
    const macaroonLocation = options.macaroonLocation ?? `settlegrid:${options.toolSlug}`

    const macaroon = mintMacaroon(
      options.toolSlug,
      costCents,
      amountSats,
      macaroonLocation,
      options.signingKey,
      invoice.paymentHash,
    )
    const macaroonEncoded = serializeMacaroon(macaroon)

    return {
      scheme: 'l402',
      provider: 'lightning',
      version: L402_PROTOCOL_VERSION,
      amount_msat: options.amountMsat,
      amount_sats: amountSats,
      currency: 'btc-lightning',
      invoice: invoice.paymentRequest,
      payment_hash: invoice.paymentHash,
      macaroon: macaroonEncoded,
      macaroon_id: macaroon.id,
      expires_in_seconds: invoice.expirySeconds,
      accepted_payments: ['lightning-invoice'],
      instructions: `To pay, complete the Lightning invoice and re-send the request with Authorization: L402 ${macaroonEncoded}:<preimage> where <preimage> is the 32-byte hex preimage revealed by the paid invoice.`,
    }
  }

  /**
   * P3.K2 — spec-aligned `verifyPayment`. Delegates the macaroon +
   * preimage-format checks to `validateL402Payment`, then applies
   * the REAL cryptographic check hostile-audit rule (a) requires:
   * SHA-256 the presented preimage, extract the `payment_hash`
   * caveat from the macaroon, and compare hash ↔ caveat with a
   * timing-safe equality.
   *
   * The `payment_hash` caveat is a P3.K2 addition to `mintMacaroon`.
   * Macaroons minted before this card lack the caveat; in that
   * case, verifyPayment falls back to the validateL402Payment
   * result (length-check only) so legacy tokens continue to
   * authenticate — and logs a warning naming the missing caveat
   * so ops can grep for affected flows.
   */
  async verifyPayment(
    request: Request,
    options: L402VerifyPaymentOptions,
  ): Promise<L402PaymentResult> {
    const baseResult = await validateL402Payment(request, options)
    if (!baseResult.valid) return baseResult

    const credentials = extractL402Credentials(request)
    if (!credentials) {
      return {
        valid: false,
        macaroonId: baseResult.macaroonId,
        error: {
          code: 'L402_PREIMAGE_MISSING',
          message:
            'verifyPayment: Authorization header did not round-trip. Pass Authorization: L402 <macaroon>:<preimage>.',
        },
      }
    }
    const macaroon = deserializeMacaroon(credentials.macaroonEncoded)
    if (!macaroon) {
      return {
        valid: false,
        macaroonId: baseResult.macaroonId,
        error: {
          code: 'L402_MACAROON_INVALID',
          message: 'verifyPayment: macaroon failed to deserialize on re-read.',
        },
      }
    }
    // P3.K2 spec-diff fix F2 — enforce the macaroon's `amount_cents`
    // caveat against the tool's current price. The amount is bound at
    // mint time; a tool that raises its price between mint and redeem
    // MUST reject stale macaroons rather than silently accepting them
    // at the old price. Covers the step-5 "amount mismatch" test case.
    const amountCentsCaveat = macaroon.caveats.find((c) => c.key === 'amount_cents')
    if (amountCentsCaveat !== undefined) {
      const boundAmount = Number.parseInt(amountCentsCaveat.value, 10)
      if (
        Number.isFinite(boundAmount) &&
        boundAmount !== options.toolConfig.costCents
      ) {
        return {
          valid: false,
          macaroonId: macaroon.id,
          error: {
            code: 'L402_CAVEAT_VIOLATION',
            message: `Macaroon amount_cents caveat (${boundAmount}) does not match tool cost (${options.toolConfig.costCents}). The tool's price changed since this macaroon was minted; retry with a fresh 402.`,
          },
        }
      }
    }

    const paymentHashCaveat = macaroon.caveats.find((c) => c.key === 'payment_hash')
    if (!paymentHashCaveat) {
      const logger = options.logger ?? NOOP_LOGGER
      logger.warn('l402.macaroon_missing_payment_hash_caveat', {
        macaroonId: macaroon.id,
        note: 'Falling back to length-check. Mint new macaroons via generateL402_402Response or buildChallenge(L402ChallengeOptions) to bind payment_hash.',
      })
      return baseResult
    }
    const expectedHash = paymentHashCaveat.value.toLowerCase()
    // Hash the preimage and compare to the invoice-bound payment_hash.
    // This is the real spec check — NOT a length-only check.
    let actualHash: string
    try {
      actualHash = createHash('sha256')
        .update(Buffer.from(credentials.preimage, 'hex'))
        .digest('hex')
    } catch {
      return {
        valid: false,
        macaroonId: macaroon.id,
        error: {
          code: 'L402_PREIMAGE_INVALID',
          message: 'verifyPayment: preimage is not valid hex.',
        },
      }
    }
    if (!timingSafeHexCompare(actualHash, expectedHash)) {
      return {
        valid: false,
        macaroonId: macaroon.id,
        error: {
          code: 'L402_PREIMAGE_INVALID',
          message: `verifyPayment: SHA-256(preimage) does not match macaroon payment_hash caveat.`,
        },
      }
    }
    return baseResult
  }

  /**
   * P3.K2 — spec-aligned `settle`. Records the invocation and emits
   * a settlement event carrying BOTH the msat amount and the
   * converted fiat cents. Per hostile-audit rule (b), the fiat
   * conversion goes through an injected `BtcUsdRateFetcher`; the
   * default {@link CoinGeckoRateFetcher} pulls a live rate and
   * caches it for 60 s. If rate resolution fails, settle throws
   * rather than silently falling back to a stale / hardcoded rate.
   *
   * Idempotent on `invocation.invocationId` — same cache + rollback
   * semantics as the P3.K1 MPP settle.
   */
  async settle(
    invocation: L402Settlement,
    deps?: L402SettleDependencies,
  ): Promise<L402SettleResult> {
    if (
      invocation === null ||
      typeof invocation !== 'object' ||
      Array.isArray(invocation)
    ) {
      throw new TypeError('settle: `invocation` must be a non-null object.')
    }
    if (
      typeof invocation.invocationId !== 'string' ||
      invocation.invocationId.length === 0
    ) {
      throw new Error(
        'settle: `invocation.invocationId` is required and must be a non-empty string.',
      )
    }
    if (
      typeof invocation.toolSlug !== 'string' ||
      invocation.toolSlug.length === 0
    ) {
      throw new Error('settle: `invocation.toolSlug` is required and must be non-empty.')
    }
    if (
      typeof invocation.amountMsat !== 'number' ||
      !Number.isFinite(invocation.amountMsat) ||
      !Number.isInteger(invocation.amountMsat) ||
      invocation.amountMsat < 0
    ) {
      throw new RangeError(
        `settle: \`invocation.amountMsat\` must be a non-negative integer; got ${JSON.stringify(
          invocation.amountMsat,
        )}.`,
      )
    }
    const store = deps?.idempotencyStore ?? this.settleCache
    const cached = store.get(invocation.invocationId)
    if (cached) {
      return { status: 'already-settled', event: cached.event }
    }

    const rateFetcher = deps?.rateFetcher ?? new CoinGeckoRateFetcher()
    const btcUsdRate = await rateFetcher.fetchBtcUsdRate()
    if (!Number.isFinite(btcUsdRate) || btcUsdRate <= 0) {
      throw new Error(
        `settle: rate fetcher returned invalid BTC/USD rate: ${JSON.stringify(btcUsdRate)}.`,
      )
    }
    const fiatCents = Math.ceil(
      (invocation.amountMsat * btcUsdRate) / (MSAT_PER_BTC / 100),
    )
    const now = deps?.now ?? Date.now
    const settledAt = now()

    const data: L402SettlementData = {
      subKind: 'invocation.settled',
      protocol: 'l402',
      invocationId: invocation.invocationId,
      toolSlug: invocation.toolSlug,
      amountMsat: invocation.amountMsat,
      fiatCents,
      fiatCurrency: 'usd',
      btcUsdRate,
      settledAt,
      ...(invocation.paymentHash !== undefined
        ? { paymentHash: invocation.paymentHash }
        : {}),
      ...(invocation.preimage !== undefined
        ? { preimageFingerprint: invocation.preimage.slice(0, 8) }
        : {}),
      ...(invocation.macaroonId !== undefined
        ? { macaroonId: invocation.macaroonId }
        : {}),
      ...(invocation.sessionId !== undefined ? { sessionId: invocation.sessionId } : {}),
    }
    const event: L402SettlementEvent = {
      kind: 'unknown',
      railId: 'stripe-connect',
      externalEventId: invocation.invocationId,
      ...(invocation.macaroonId !== undefined
        ? { externalAccountId: invocation.macaroonId }
        : {}),
      data,
    }
    const result: L402SettleResult = { status: 'settled', event }
    store.set(invocation.invocationId, result)

    if (deps?.recordInvocation) {
      try {
        await Promise.resolve(
          deps.recordInvocation({
            invocationId: invocation.invocationId,
            toolSlug: invocation.toolSlug,
            amountMsat: invocation.amountMsat,
            fiatCents,
            fiatCurrency: 'usd',
            btcUsdRate,
            settledAt,
            ...(invocation.paymentHash !== undefined
              ? { paymentHash: invocation.paymentHash }
              : {}),
            ...(invocation.macaroonId !== undefined
              ? { macaroonId: invocation.macaroonId }
              : {}),
            ...(invocation.sessionId !== undefined ? { sessionId: invocation.sessionId } : {}),
          }),
        )
      } catch (err) {
        store.delete(invocation.invocationId)
        throw err
      }
    }
    if (deps?.onSettled) {
      deps.onSettled(event)
    }
    return result
  }
}

/**
 * Timing-safe hex equality. Local private copy (the voltage client
 * exports one too) — keeping a second copy avoids adding voltage
 * to l402.ts's already-long import list AND avoids cross-file
 * coupling for what is a 5-line helper.
 */
function timingSafeHexCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

// ─── Module-level validation (P2.K2) ───────────────────────────────────────

/**
 * Validate an incoming L402 payment. Env-agnostic: all runtime configuration
 * (feature flag, signing key, logger) is passed in via `options`.
 */
export async function validateL402Payment(
  request: Request,
  options: L402ValidateOptions,
): Promise<L402PaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER
  const signingKey = options.signingKey ?? L402_DEV_SIGNING_KEY

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'L402_NOT_CONFIGURED',
        message: 'L402 payments are not configured on this SettleGrid instance.',
      },
    }
  }

  // Hostile-review H1: warn loudly if the dev signing key is being used in
  // an enabled context. The fallback preserves legacy behavior (matches
  // apps/web/src/lib/l402-proxy.ts pre-P2.K2), but silent fallback in
  // production means any two SettleGrid instances with missing config can
  // forge each other's macaroons. A log line on every validate call
  // surfaces the misconfiguration immediately without breaking dev.
  if (!options.signingKey) {
    logger.warn('l402.signing_key_missing_using_dev_fallback', {
      toolSlug: toolConfig.slug,
      note: 'L402 enabled but no signing key supplied; using shared dev key. Set LND_MACAROON_HEX or L402_SIGNING_KEY for production.',
    })
  }

  const credentials = extractL402Credentials(request)
  if (!credentials) {
    return {
      valid: false,
      error: {
        code: 'L402_MACAROON_MISSING',
        message:
          'No L402 credentials found. Provide Authorization: L402 <macaroon>:<preimage> header.',
      },
    }
  }

  const macaroon = deserializeMacaroon(credentials.macaroonEncoded)
  if (!macaroon) {
    return {
      valid: false,
      error: {
        code: 'L402_MACAROON_INVALID',
        message:
          'Failed to deserialize L402 macaroon. Ensure it is a valid base64-encoded macaroon.',
      },
    }
  }

  const verifyResult = verifyMacaroon(macaroon, toolConfig.slug, signingKey)
  if (!verifyResult.valid) {
    const isExpired = verifyResult.error?.includes('expired')
    return {
      valid: false,
      macaroonId: macaroon.id,
      error: {
        code: isExpired ? 'L402_MACAROON_EXPIRED' : 'L402_MACAROON_INVALID',
        message: verifyResult.error ?? 'Macaroon verification failed.',
      },
    }
  }

  if (!credentials.preimage || !/^[0-9a-fA-F]{64}$/.test(credentials.preimage)) {
    return {
      valid: false,
      macaroonId: macaroon.id,
      error: {
        code: 'L402_PREIMAGE_INVALID',
        message: 'Invalid preimage format. Must be a 32-byte hex string (64 characters).',
      },
    }
  }

  const amountSats = extractAmountSats(macaroon)

  logger.info('l402.payment_accepted', {
    toolSlug: toolConfig.slug,
    macaroonId: macaroon.id,
    amountSats,
    preimagePrefix: credentials.preimage.slice(0, 8) + '...',
  })

  return {
    valid: true,
    macaroonId: macaroon.id,
    preimageHash: credentials.preimage,
    toolSlug: toolConfig.slug,
    amountSats,
  }
}

// ─── Module-level 402 generation (P2.K2) ───────────────────────────────────

/**
 * Generate an L402 402 Payment Required response with a Lightning invoice
 * + macaroon. Async because LND REST is called to mint the invoice when
 * configured.
 */
export async function generateL402_402Response(
  options: L402_402Options,
): Promise<Response> {
  const { toolSlug, costCents, toolName, appUrl } = options
  const logger = options.logger ?? NOOP_LOGGER
  const signingKey = options.signingKey ?? L402_DEV_SIGNING_KEY

  // Hostile-review H1: same warning as validate — a minted macaroon
  // signed by the dev key is forgeable across instances. We warn once
  // per 402 generation so ops can grep for misconfigured instances.
  if (!options.signingKey) {
    logger.warn('l402.signing_key_missing_using_dev_fallback', {
      toolSlug,
      note: 'Minting macaroon with shared dev signing key. Set LND_MACAROON_HEX or L402_SIGNING_KEY for production.',
    })
  }

  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`
  const amountSats = centsToSats(costCents, options.btcUsdRate)

  // P3.K2 hostile fix (a) — mint the invoice BEFORE the macaroon so
  // the macaroon can bind the invoice's payment_hash. Legacy callers
  // that hit this with no LND/Voltage backend get a mock invoice
  // with a random r_hash (unchanged behavior) — the payment_hash
  // caveat then carries that mock hash, which is sufficient for
  // length-check fallback but not cryptographically meaningful.
  const invoice = await generateLightningInvoice(
    amountSats,
    `SettleGrid: ${description} (${costCents}c)`,
    options.lndRestUrl,
    options.lndMacaroonHex,
    logger,
  )

  const paymentRequest = invoice?.paymentRequest ?? ''
  const rHash = invoice?.rHash ?? ''

  const macaroon = mintMacaroon(
    toolSlug,
    costCents,
    amountSats,
    appUrl,
    signingKey,
    rHash || undefined,
  )
  const macaroonEncoded = serializeMacaroon(macaroon)

  const body = {
    error: 'payment_required',
    protocol: 'l402',
    version: L402_PROTOCOL_VERSION,
    amount_sats: amountSats,
    amount_cents: costCents,
    currency: 'btc-lightning',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    macaroon: macaroonEncoded,
    invoice: paymentRequest,
    r_hash: rHash,
    macaroon_id: macaroon.id,
    expires_in_seconds: DEFAULT_MACAROON_EXPIRY_SECONDS,
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, complete the Lightning invoice and re-send the request with Authorization: L402 ${macaroonEncoded}:<preimage> where <preimage> is the 32-byte hex preimage from the paid invoice.`,
  }

  const wwwAuth = `L402 macaroon="${macaroonEncoded}", invoice="${paymentRequest}"`

  const headers = new Headers({
    'Content-Type': 'application/json',
    [L402_HEADERS.WWW_AUTHENTICATE]: wwwAuth,
    'X-SettleGrid-Protocol': 'l402',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}

// ─── P3.K2 — Spec-aligned method types ────────────────────────────────────

export interface L402DetectionResult {
  confidence: number
  reasons: string[]
}

/**
 * Rich-challenge input shape for {@link L402Adapter.buildChallenge}
 * overload #2. When these fields are present, buildChallenge calls
 * the Voltage client to mint a real invoice; otherwise it falls
 * through to the sync AcceptEntry path used by the 402 manifest.
 */
export interface L402ChallengeOptions {
  /** Tool slug (for the macaroon `service` caveat + memo default). */
  toolSlug: string
  /** Invoice amount, in millisatoshis. Must be a positive integer. */
  amountMsat: number
  /** HMAC signing key for the minted macaroon — required (no dev fallback). */
  signingKey: string
  /** Lightning client (Voltage or LND) to mint the invoice with. */
  lightningClient: VoltageClient
  /** Tool cost in fiat cents (for the macaroon `amount_cents` caveat + logging). */
  costCents?: number
  /** Memo shown to the payer on the Lightning invoice. */
  memo?: string
  /**
   * Macaroon `location` field — defaults to `settlegrid:{toolSlug}`.
   * Setting this to an app URL is appropriate for production flows.
   */
  macaroonLocation?: string
  /** Invoice expiry in seconds. Defaults to LND's 24h if omitted. */
  expirySeconds?: number
}

/**
 * Output of the rich-challenge path. Snake_case fields per the L402
 * wire convention — mirrors `generateL402_402Response`'s body shape
 * (`amount_sats`, `r_hash`-style fields, `accepted_payments`).
 */
export interface L402ChallengeEnvelope {
  readonly scheme: 'l402'
  readonly provider: 'lightning'
  version: string
  amount_msat: number
  amount_sats: number
  currency: 'btc-lightning'
  invoice: string
  payment_hash: string
  macaroon: string
  macaroon_id: string
  expires_in_seconds: number
  accepted_payments: readonly string[]
  instructions: string
}

/**
 * Options for {@link L402Adapter.verifyPayment}. Extends the existing
 * {@link L402ValidateOptions} — same fields as the P2.K2 validator
 * plus the implicit requirement that macaroons carry a `payment_hash`
 * caveat (otherwise verifyPayment falls back to length-only checks
 * and logs a warning).
 */
export interface L402VerifyPaymentOptions extends L402ValidateOptions {}

/**
 * Input to {@link L402Adapter.settle}. `invocationId` is the
 * idempotency key — parallel calls with the same ID collapse to
 * one settlement + one emitted event.
 */
export interface L402Settlement {
  invocationId: string
  toolSlug: string
  amountMsat: number
  paymentHash?: string
  /** Raw preimage (32-byte hex). Only the first 8 chars are included in the event as a fingerprint. */
  preimage?: string
  macaroonId?: string
  sessionId?: string
}

/**
 * Ledger record persisted by
 * {@link L402SettleDependencies.recordInvocation}. Carries both the
 * native Lightning amount (`amountMsat`) AND the converted fiat
 * amount (`fiatCents`) + the rate used at settle time, so downstream
 * accounting systems can reconstruct the conversion deterministically
 * without re-hitting the rate source.
 */
export interface L402LedgerEntry {
  invocationId: string
  toolSlug: string
  amountMsat: number
  fiatCents: number
  fiatCurrency: 'usd'
  btcUsdRate: number
  settledAt: number
  paymentHash?: string
  macaroonId?: string
  sessionId?: string
}

export interface L402SettlementData extends Record<string, unknown> {
  readonly subKind: 'invocation.settled'
  readonly protocol: 'l402'
  invocationId: string
  toolSlug: string
  amountMsat: number
  fiatCents: number
  fiatCurrency: 'usd'
  btcUsdRate: number
  settledAt: number
  paymentHash?: string
  /** First 8 chars of the preimage. Full preimage is secret; fingerprint only. */
  preimageFingerprint?: string
  macaroonId?: string
  sessionId?: string
}

/**
 * Settlement event emitted by {@link L402Adapter.settle}. Same
 * structural-SettleGridInternalEvent pattern as P3.K1's
 * MppSettlementEvent.
 *
 * D2 (pre-declared) — `railId` is pinned to `'stripe-connect'` as a
 * placeholder because the `RailId` union in `rails/types.ts` does
 * not include a Lightning-native rail literal. Adding one would
 * touch a file outside this card's allowed list. The rich
 * discriminator lives in `data.protocol` + `data.subKind`; consumers
 * should prefer those for routing decisions.
 */
export interface L402SettlementEvent extends SettleGridInternalEvent {
  kind: 'unknown'
  railId: 'stripe-connect'
  externalEventId: string
  externalAccountId?: string
  data: L402SettlementData
}

export interface L402SettleDependencies {
  idempotencyStore?: Map<string, L402SettleResult>
  /**
   * Persistent ledger writer. Errors thrown from this callback
   * roll back the idempotency cache entry so the caller can retry
   * without losing the slot.
   */
  recordInvocation?: (entry: L402LedgerEntry) => Promise<void> | void
  /**
   * Settlement event emitter. Called only on the FIRST settle for
   * a given invocationId. Errors propagate (cache is NOT rolled
   * back because the ledger write already succeeded). Emitters
   * should be resilient — log-and-drop, no throws in steady state.
   */
  onSettled?: (event: L402SettlementEvent) => void
  /** Injectable BTC/USD rate source. Defaults to CoinGeckoRateFetcher. */
  rateFetcher?: BtcUsdRateFetcher
  /** Injectable clock for deterministic tests. */
  now?: () => number
}

export interface L402SettleResult {
  status: 'settled' | 'already-settled'
  event: L402SettlementEvent
}
