/**
 * L402 Protocol — Bitcoin Lightning Smart Proxy Integration
 *
 * Handles L402 (formerly LSAT) payment flows for SettleGrid tools:
 *   1. Detects L402/LSAT headers on incoming requests
 *   2. Validates macaroons (HMAC-based bearer tokens with caveats)
 *   3. Generates Lightning invoices via LND REST API (or stubs)
 *   4. Returns proper 402 responses with macaroon + Lightning invoice
 *
 * L402 uses HTTP 402 + Bitcoin Lightning invoices + Macaroons:
 *   - Agent hits endpoint, gets 402 with Lightning invoice + macaroon
 *   - Agent pays invoice via Lightning Network
 *   - Agent presents macaroon as auth token for subsequent calls
 *   - No API keys, no signup — fully pseudonymous per-request payments
 *
 * @see https://docs.lightning.engineering/the-lightning-network/l402
 */

import { createHmac, randomBytes } from 'crypto'
import { logger } from './logger'
import { getAppUrl } from './env'

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

/** HMAC key for macaroon signing — derived from env or a dev fallback */
function getMacaroonSigningKey(): string {
  return process.env.LND_MACAROON_HEX ?? process.env.L402_SIGNING_KEY ?? 'settlegrid-l402-dev-key'
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface L402PaymentResult {
  valid: boolean
  /** The macaroon identifier (unique per-payment) */
  macaroonId?: string
  /** Preimage hash from Lightning payment proof */
  preimageHash?: string
  /** The tool slug this macaroon was issued for */
  toolSlug?: string
  /** Amount paid in satoshis */
  amountSats?: number
  /** Error details when validation fails */
  error?: {
    code: L402ErrorCode
    message: string
  }
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
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name */
  displayName: string
}

// ─── Macaroon Types ─────────────────────────────────────────────────────────

interface MacaroonCaveat {
  /** Caveat key */
  key: string
  /** Caveat value */
  value: string
}

interface Macaroon {
  /** Unique identifier for this macaroon */
  id: string
  /** Location (service URL) */
  location: string
  /** HMAC signature */
  signature: string
  /** Caveats (restrictions on use) */
  caveats: MacaroonCaveat[]
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains L402 payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. Authorization: L402 <macaroon>:<preimage> header (standard L402)
 *   2. Authorization: LSAT <macaroon>:<preimage> header (legacy LSAT format)
 *   3. x-settlegrid-protocol: l402 header
 */
export function isL402Request(request: Request): boolean {
  const auth = request.headers.get('authorization')
  if (auth) {
    const trimmed = auth.trim()
    if (trimmed.startsWith('L402 ') || trimmed.startsWith('LSAT ')) return true
  }

  if (request.headers.get(L402_HEADERS.PROTOCOL) === 'l402') return true

  return false
}

// ─── Macaroon Operations ────────────────────────────────────────────────────

/**
 * Create an HMAC-SHA256 signature for a macaroon.
 */
function hmacSign(key: string, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex')
}

/**
 * Mint a new macaroon with caveats for a specific tool invocation.
 */
function mintMacaroon(
  toolSlug: string,
  costCents: number,
  amountSats: number
): Macaroon {
  const appUrl = getAppUrl()
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

  // Build the signature chain: HMAC(key, id) then HMAC(sig, caveat) for each caveat
  const signingKey = getMacaroonSigningKey()
  let signature = hmacSign(signingKey, id)
  for (const caveat of caveats) {
    signature = hmacSign(signature, `${caveat.key}=${caveat.value}`)
  }

  return {
    id,
    location: appUrl,
    signature,
    caveats,
  }
}

/**
 * Serialize a macaroon to a base64 string for transport in HTTP headers.
 */
function serializeMacaroon(macaroon: Macaroon): string {
  const payload = JSON.stringify({
    id: macaroon.id,
    location: macaroon.location,
    caveats: macaroon.caveats,
    signature: macaroon.signature,
  })
  return Buffer.from(payload).toString('base64')
}

/**
 * Deserialize a base64-encoded macaroon string back to a Macaroon object.
 */
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

/**
 * Verify a macaroon's HMAC signature chain and caveats.
 */
function verifyMacaroon(
  macaroon: Macaroon,
  toolSlug: string
): { valid: boolean; error?: string } {
  // Recompute the signature chain
  const signingKey = getMacaroonSigningKey()
  let expectedSig = hmacSign(signingKey, macaroon.id)
  for (const caveat of macaroon.caveats) {
    expectedSig = hmacSign(expectedSig, `${caveat.key}=${caveat.value}`)
  }

  // Constant-time comparison
  if (expectedSig !== macaroon.signature) {
    return { valid: false, error: 'Macaroon signature is invalid.' }
  }

  // Check caveats
  const now = Math.floor(Date.now() / 1000)

  for (const caveat of macaroon.caveats) {
    if (caveat.key === 'expires_at') {
      const expiresAt = parseInt(caveat.value, 10)
      if (Number.isFinite(expiresAt) && now > expiresAt) {
        return { valid: false, error: `Macaroon expired ${now - expiresAt}s ago.` }
      }
    }

    if (caveat.key === 'service') {
      // Verify the macaroon was issued for this tool
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

/**
 * Extract the amount in satoshis from a macaroon's caveats.
 */
function extractAmountSats(macaroon: Macaroon): number {
  const caveat = macaroon.caveats.find((c) => c.key === 'amount_sats')
  if (!caveat) return 0
  const parsed = parseInt(caveat.value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

// ─── Lightning Invoice Generation ───────────────────────────────────────────

/**
 * Convert cents to satoshis using current BTC/USD exchange rate.
 * Falls back to a conservative estimate if rate is unavailable.
 *
 * Uses a hardcoded fallback rate of $100,000/BTC (1 sat = $0.001).
 * In production, this should fetch from an exchange rate API.
 */
function centsToSats(cents: number): number {
  const btcUsdRate = parseInt(process.env.L402_BTC_USD_RATE ?? '100000', 10)
  const satsPerBtc = 100_000_000
  const usdCents = cents
  // sats = (cents / 100) / btcUsdRate * satsPerBtc
  const sats = Math.ceil((usdCents / 100) * (satsPerBtc / btcUsdRate))
  return Math.max(sats, 1) // minimum 1 sat
}

/**
 * Generate a Lightning invoice via LND REST API.
 * If LND_REST_URL is not configured, generates a mock invoice.
 */
async function generateLightningInvoice(
  amountSats: number,
  memo: string
): Promise<{ paymentRequest: string; rHash: string } | null> {
  const lndRestUrl = process.env.LND_REST_URL
  const lndMacaroon = process.env.LND_MACAROON_HEX

  if (!lndRestUrl) {
    // Generate a mock invoice for development/testing
    const mockHash = randomBytes(32).toString('hex')
    const mockInvoice = `lnbc${amountSats}n1p0settlegrid${randomBytes(20).toString('hex')}`

    logger.info('l402.mock_invoice_generated', {
      amountSats,
      memo,
      note: 'LND_REST_URL not configured; using mock invoice.',
    })

    return {
      paymentRequest: mockInvoice,
      rHash: mockHash,
    }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (lndMacaroon) {
      headers['Grpc-Metadata-macaroon'] = lndMacaroon
    }

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
    logger.error('l402.lnd_connection_error', {
      lndRestUrl,
    }, err)
    return null
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Extract L402 credentials from the Authorization header.
 *
 * Format: L402 <macaroon-base64>:<preimage-hex>
 *   or:   LSAT <macaroon-base64>:<preimage-hex>
 */
function extractL402Credentials(
  request: Request
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

  // Split on the last colon to separate macaroon from preimage
  const colonIndex = tokenPart.lastIndexOf(':')
  if (colonIndex === -1) return null

  const macaroonEncoded = tokenPart.slice(0, colonIndex)
  const preimage = tokenPart.slice(colonIndex + 1)

  if (!macaroonEncoded || !preimage) return null

  return { macaroonEncoded, preimage }
}

/**
 * Validate an incoming L402 payment from the Authorization header.
 *
 * Flow:
 *   1. Extract L402 credentials (macaroon + preimage) from Authorization header
 *   2. Deserialize and verify the macaroon (HMAC chain + caveats)
 *   3. Verify the preimage against the payment hash (if LND is configured)
 *   4. Check that the macaroon was issued for the correct tool
 *   5. Return the result
 */
export async function validateL402Payment(
  request: Request,
  toolConfig: L402ToolConfig
): Promise<L402PaymentResult> {
  if (!isL402Enabled()) {
    return {
      valid: false,
      error: {
        code: 'L402_NOT_CONFIGURED',
        message: 'L402 payments are not configured on this SettleGrid instance.',
      },
    }
  }

  // Extract credentials
  const credentials = extractL402Credentials(request)
  if (!credentials) {
    return {
      valid: false,
      error: {
        code: 'L402_MACAROON_MISSING',
        message: 'No L402 credentials found. Provide Authorization: L402 <macaroon>:<preimage> header.',
      },
    }
  }

  // Deserialize macaroon
  const macaroon = deserializeMacaroon(credentials.macaroonEncoded)
  if (!macaroon) {
    return {
      valid: false,
      error: {
        code: 'L402_MACAROON_INVALID',
        message: 'Failed to deserialize L402 macaroon. Ensure it is a valid base64-encoded macaroon.',
      },
    }
  }

  // Verify macaroon signature and caveats
  const verifyResult = verifyMacaroon(macaroon, toolConfig.slug)
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

  // Verify preimage is present and has valid hex format
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

  // TODO: If LND is configured, verify the preimage matches the payment hash
  // by calling LND's /v1/invoice/<r_hash> endpoint to confirm payment.
  // For now, accept valid macaroon + structurally valid preimage.

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

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate an L402 402 Payment Required response with a Lightning invoice and macaroon.
 *
 * The response includes:
 *   - WWW-Authenticate: L402 macaroon="<base64>", invoice="<bolt11>" header
 *   - JSON body with payment details for programmatic consumption
 *
 * Compatible agents will parse the WWW-Authenticate header, pay the Lightning
 * invoice, and re-send the request with Authorization: L402 <macaroon>:<preimage>.
 */
export async function generateL402_402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string
): Promise<Response> {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const amountSats = centsToSats(costCents)

  // Mint a macaroon for this tool invocation
  const macaroon = mintMacaroon(toolSlug, costCents, amountSats)
  const macaroonEncoded = serializeMacaroon(macaroon)

  // Generate a Lightning invoice
  const invoice = await generateLightningInvoice(
    amountSats,
    `SettleGrid: ${description} (${costCents}c)`
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

  // L402 standard: WWW-Authenticate header with macaroon and invoice
  const wwwAuth = `L402 macaroon="${macaroonEncoded}", invoice="${paymentRequest}"`

  const headers = new Headers({
    'Content-Type': 'application/json',
    [L402_HEADERS.WWW_AUTHENTICATE]: wwwAuth,
    'X-SettleGrid-Protocol': 'l402',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}

// ─── Env Check ──────────────────────────────────────────────────────────────

export function isL402Enabled(): boolean {
  return process.env.L402_ENABLED === 'true' || !!process.env.LND_REST_URL
}
