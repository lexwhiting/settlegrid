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

import { createHmac, randomBytes } from 'crypto'
import { randomUUID } from 'crypto'
import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
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

/** Dev fallback signing key — production callers supply a real one via options. */
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

function mintMacaroon(
  toolSlug: string,
  costCents: number,
  amountSats: number,
  location: string,
  signingKey: string,
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

  if (expectedSig !== macaroon.signature) {
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

  /**
   * Build the `accepts[]` challenge entry for the L402 (Lightning) rail.
   * Mirrors the canonical response body: protocol + amount_cents +
   * currency 'btc-lightning' + accepted_payments ['lightning-invoice'].
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'l402',
      provider: 'lightning',
      costCents,
      currency: 'btc-lightning',
      acceptedPayments: ['lightning-invoice'],
    }
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

  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`
  const amountSats = centsToSats(costCents, options.btcUsdRate)

  const macaroon = mintMacaroon(toolSlug, costCents, amountSats, appUrl, signingKey)
  const macaroonEncoded = serializeMacaroon(macaroon)

  const invoice = await generateLightningInvoice(
    amountSats,
    `SettleGrid: ${description} (${costCents}c)`,
    options.lndRestUrl,
    options.lndMacaroonHex,
    logger,
  )

  const paymentRequest = invoice?.paymentRequest ?? ''
  const rHash = invoice?.rHash ?? ''

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
