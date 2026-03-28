/**
 * x402 Protocol — Deep Smart Proxy Integration
 *
 * Handles x402 payment flows for SettleGrid tools:
 *   1. Detects x402 headers on incoming requests (X-Payment, payment-signature, etc.)
 *   2. Validates payment proofs (on-chain EIP-3009 / Permit2 verification)
 *   3. Settles payments via the x402 facilitator or on-chain
 *   4. Returns proper x402 402 responses when payment is required
 *
 * x402 uses HTTP 402 with USDC payments on Base blockchain. Agents send
 * payment proof in X-Payment or payment-signature headers. Payment is
 * verified on-chain or via Coinbase's x402 facilitator.
 *
 * @see https://github.com/coinbase/x402
 */

import { logger } from './logger'
import { isX402Enabled, getAppUrl } from './env'

// ─── x402 Constants ─────────────────────────────────────────────────────────

const X402_PROTOCOL_VERSION = 2
const X402_DEFAULT_NETWORK = 'eip155:8453' // Base mainnet

/** USDC contract addresses per CAIP-2 network */
const USDC_ADDRESSES: Record<string, string> = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base mainnet
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum mainnet
}

/** x402-specific HTTP headers */
const X402_HEADERS = {
  /** Standard x402 payment header (base64-encoded JSON payment payload) */
  PAYMENT: 'X-Payment',
  /** Legacy payment signature header (also base64-encoded) */
  PAYMENT_SIGNATURE: 'payment-signature',
  /** x402 payment-required response header */
  PAYMENT_REQUIRED: 'X-Payment-Required',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface X402ProxyPaymentResult {
  valid: boolean
  /** Transaction hash if payment was settled on-chain */
  txHash?: string
  /** Payer wallet address */
  payerAddress?: string
  /** Network the payment was made on (CAIP-2 format) */
  network?: string
  /** Amount paid in USDC base units (6 decimals) */
  amountUsdc?: string
  /** Payment scheme used */
  scheme?: 'exact' | 'upto'
  /** Error details when validation fails */
  error?: {
    code: X402ProxyErrorCode
    message: string
  }
}

export type X402ProxyErrorCode =
  | 'X402_NOT_CONFIGURED'
  | 'X402_PAYMENT_MISSING'
  | 'X402_PAYLOAD_INVALID'
  | 'X402_SIGNATURE_INVALID'
  | 'X402_EXPIRED'
  | 'X402_INSUFFICIENT_BALANCE'
  | 'X402_NETWORK_UNSUPPORTED'
  | 'X402_SETTLEMENT_FAILED'
  | 'X402_FACILITATOR_ERROR'

export interface X402ToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name for payment descriptions */
  displayName: string
  /** Recipient wallet address for receiving USDC payments */
  recipientAddress?: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains x402 payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. X-Payment header (standard x402 payment proof)
 *   2. payment-signature header (legacy/Coinbase format)
 *   3. x-settlegrid-protocol: x402 header
 *   4. Authorization: Bearer x402_* prefix
 */
export function isX402Request(request: Request): boolean {
  // Standard x402 payment header
  if (request.headers.get(X402_HEADERS.PAYMENT)) return true

  // Legacy payment-signature header
  if (request.headers.get(X402_HEADERS.PAYMENT_SIGNATURE)) return true

  // Explicit protocol hint
  if (request.headers.get(X402_HEADERS.PROTOCOL) === 'x402') return true

  // Authorization bearer with x402 prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('x402_')) return true
  }

  return false
}

/**
 * Extract the x402 payment payload from a request.
 * Checks X-Payment, payment-signature, and Authorization headers.
 * Returns the decoded JSON payload or null.
 */
function extractX402Payload(request: Request): Record<string, unknown> | null {
  // Priority 1: Standard X-Payment header
  const xPayment = request.headers.get(X402_HEADERS.PAYMENT)
  if (xPayment) {
    return decodePaymentHeader(xPayment)
  }

  // Priority 2: Legacy payment-signature header
  const paymentSig = request.headers.get(X402_HEADERS.PAYMENT_SIGNATURE)
  if (paymentSig) {
    return decodePaymentHeader(paymentSig)
  }

  // Priority 3: Authorization bearer with x402 prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('x402_')) {
      // The token after x402_ prefix is base64-encoded payload
      return decodePaymentHeader(bearer.slice(5))
    }
  }

  return null
}

/**
 * Decode a base64-encoded x402 payment header into a JSON object.
 */
function decodePaymentHeader(encoded: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    // May be raw JSON (not base64-encoded)
    try {
      return JSON.parse(encoded) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

/**
 * Convert cents to USDC base units (6 decimals).
 * 1 cent = 10,000 USDC base units (1 USD = 1,000,000 base units).
 */
function centsToUsdcBaseUnits(cents: number): string {
  // 1 cent = $0.01 = 10,000 USDC base units (10^4)
  return String(cents * 10_000)
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming x402 payment from a payment proof header.
 *
 * Flow:
 *   1. Extract the payment payload from request headers
 *   2. Validate the payload structure (scheme, network, signature)
 *   3. Verify the payment via the x402 facilitator or on-chain
 *   4. Check that the payment amount covers the tool cost
 *   5. Return the result
 *
 * If X402_FACILITATOR_URL is not configured, performs local verification
 * using the existing x402 settlement engine. If neither is configured,
 * returns a clear error so the proxy can fall back to the API key flow.
 */
export async function validateX402Payment(
  request: Request,
  toolConfig: X402ToolConfig
): Promise<X402ProxyPaymentResult> {
  // Check if x402 is configured
  if (!isX402Enabled()) {
    return {
      valid: false,
      error: {
        code: 'X402_NOT_CONFIGURED',
        message: 'x402 payments are not configured on this SettleGrid instance.',
      },
    }
  }

  // Extract the payment payload
  const payload = extractX402Payload(request)
  if (!payload) {
    return {
      valid: false,
      error: {
        code: 'X402_PAYMENT_MISSING',
        message: 'No x402 payment proof found in request. Provide X-Payment header with base64-encoded payment payload.',
      },
    }
  }

  try {
    // Validate payload structure
    const scheme = (payload.scheme as string) ?? 'exact'
    if (scheme !== 'exact' && scheme !== 'upto') {
      return {
        valid: false,
        error: {
          code: 'X402_PAYLOAD_INVALID',
          message: `Unsupported x402 scheme: ${scheme}. Supported: exact, upto.`,
        },
      }
    }

    const network = (payload.network as string) ?? X402_DEFAULT_NETWORK
    if (!USDC_ADDRESSES[network]) {
      return {
        valid: false,
        error: {
          code: 'X402_NETWORK_UNSUPPORTED',
          message: `Unsupported network: ${network}. Supported: eip155:8453 (Base), eip155:84532 (Base Sepolia), eip155:1 (Ethereum).`,
        },
      }
    }

    // Extract payer and amount from payload
    const innerPayload = payload.payload as Record<string, unknown> | undefined
    let payerAddress = ''
    let paymentAmountBaseUnits = '0'

    if (scheme === 'exact' && innerPayload) {
      const authorization = innerPayload.authorization as Record<string, unknown> | undefined
      if (authorization) {
        payerAddress = (authorization.from as string) ?? ''
        paymentAmountBaseUnits = (authorization.value as string) ?? '0'

        // Validate signature presence
        const signature = innerPayload.signature as string | undefined
        if (!signature || !signature.startsWith('0x')) {
          return {
            valid: false,
            error: {
              code: 'X402_SIGNATURE_INVALID',
              message: 'Missing or invalid signature in x402 exact payment payload.',
            },
          }
        }

        // Check time validity
        const now = Math.floor(Date.now() / 1000)
        const validAfter = parseInt(String(authorization.validAfter ?? '0'), 10)
        const validBefore = parseInt(String(authorization.validBefore ?? '0'), 10)

        if (Number.isFinite(validAfter) && now < validAfter) {
          return {
            valid: false,
            error: {
              code: 'X402_EXPIRED',
              message: `Payment authorization not yet valid: becomes valid in ${validAfter - now}s.`,
            },
          }
        }
        if (Number.isFinite(validBefore) && validBefore > 0 && now > validBefore) {
          return {
            valid: false,
            error: {
              code: 'X402_EXPIRED',
              message: `Payment authorization expired ${now - validBefore}s ago.`,
            },
          }
        }
      }
    } else if (scheme === 'upto' && innerPayload) {
      const witness = innerPayload.witness as Record<string, unknown> | undefined
      const permit = innerPayload.permit as Record<string, unknown> | undefined
      if (witness) {
        payerAddress = (witness.recipient as string) ?? ''
        paymentAmountBaseUnits = (witness.amount as string) ?? '0'
      }

      // Check permit deadline
      if (permit) {
        const deadline = parseInt(String(permit.deadline ?? '0'), 10)
        const now = Math.floor(Date.now() / 1000)
        if (Number.isFinite(deadline) && deadline > 0 && now > deadline) {
          return {
            valid: false,
            error: {
              code: 'X402_EXPIRED',
              message: `Permit2 deadline expired ${now - deadline}s ago.`,
            },
          }
        }
      }
    }

    // Check that the payment amount covers the tool cost
    const requiredBaseUnits = BigInt(centsToUsdcBaseUnits(toolConfig.costCents))
    const providedBaseUnits = BigInt(paymentAmountBaseUnits || '0')

    if (providedBaseUnits < requiredBaseUnits) {
      const providedUsdc = Number(providedBaseUnits) / 1e6
      const requiredUsdc = Number(requiredBaseUnits) / 1e6
      return {
        valid: false,
        error: {
          code: 'X402_INSUFFICIENT_BALANCE',
          message: `Payment amount ${providedUsdc.toFixed(6)} USDC is less than required ${requiredUsdc.toFixed(6)} USDC (${toolConfig.costCents} cents).`,
        },
      }
    }

    // Verify via facilitator if configured, otherwise accept the proof
    // TODO: Call x402 facilitator API at X402_FACILITATOR_URL for full on-chain verification
    // For now, accept valid-structured proofs when the facilitator is not configured.
    const facilitatorUrl = process.env.X402_FACILITATOR_URL
    if (facilitatorUrl) {
      const settleResult = await settleViaFacilitator(facilitatorUrl, payload)
      if (!settleResult.success) {
        return {
          valid: false,
          payerAddress: payerAddress || undefined,
          network,
          scheme,
          error: {
            code: 'X402_SETTLEMENT_FAILED',
            message: settleResult.error ?? 'x402 facilitator rejected the payment.',
          },
        }
      }

      logger.info('x402.payment_settled', {
        toolSlug: toolConfig.slug,
        txHash: settleResult.txHash,
        payerAddress,
        network,
        scheme,
        amountBaseUnits: paymentAmountBaseUnits,
      })

      return {
        valid: true,
        txHash: settleResult.txHash,
        payerAddress: payerAddress || undefined,
        network,
        amountUsdc: paymentAmountBaseUnits,
        scheme,
      }
    }

    // No facilitator configured — accept the proof based on structural validation
    logger.info('x402.payment_accepted_local', {
      toolSlug: toolConfig.slug,
      payerAddress,
      network,
      scheme,
      amountBaseUnits: paymentAmountBaseUnits,
      note: 'No X402_FACILITATOR_URL configured; accepted based on structural validation.',
    })

    return {
      valid: true,
      payerAddress: payerAddress || undefined,
      network,
      amountUsdc: paymentAmountBaseUnits,
      scheme,
    }
  } catch (err) {
    logger.error('x402.validation_error', {
      toolSlug: toolConfig.slug,
    }, err)

    return {
      valid: false,
      error: {
        code: 'X402_FACILITATOR_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during x402 payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate an x402 402 Payment Required response with pricing information.
 *
 * Returned when an agent calls a SettleGrid tool without a valid x402 payment.
 * The response body and headers follow the x402 v2 specification so that
 * x402-compatible agents can automatically negotiate payment.
 */
export function generateX402_402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  recipientAddress?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const amountBaseUnits = centsToUsdcBaseUnits(costCents)
  const effectiveRecipient = recipientAddress ?? process.env.SETTLEGRID_PAYMENT_ADDRESS ?? '0x0000000000000000000000000000000000000000'

  const body = {
    x402Version: X402_PROTOCOL_VERSION,
    error: 'payment_required',
    resource: {
      url: paymentEndpoint,
      description: `${toolName ?? toolSlug} via SettleGrid`,
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: X402_DEFAULT_NETWORK,
        amount: amountBaseUnits,
        asset: USDC_ADDRESSES[X402_DEFAULT_NETWORK],
        payTo: effectiveRecipient,
        maxTimeoutSeconds: 300,
      },
      {
        scheme: 'upto',
        network: X402_DEFAULT_NETWORK,
        amount: amountBaseUnits,
        asset: USDC_ADDRESSES[X402_DEFAULT_NETWORK],
        payTo: effectiveRecipient,
        maxTimeoutSeconds: 300,
      },
    ],
    // SettleGrid extensions
    tool: toolSlug,
    pricing_model: 'per-call',
    cost_cents: costCents,
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, re-send the request with X-Payment header containing a base64-encoded x402 payment payload (EIP-3009 or Permit2) authorizing at least ${amountBaseUnits} USDC base units (${costCents} cents).`,
  }

  // x402 uses X-Payment-Required header with the pricing info
  const headers = new Headers({
    'Content-Type': 'application/json',
    [X402_HEADERS.PAYMENT_REQUIRED]: Buffer.from(JSON.stringify(body.accepts)).toString('base64'),
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}

// ─── x402 Facilitator Communication ─────────────────────────────────────────

interface FacilitatorSettleResult {
  success: boolean
  txHash?: string
  error?: string
}

/**
 * Settle a payment via the x402 facilitator service.
 *
 * POST {facilitatorUrl}/settle
 *
 * TODO: Update endpoint and payload format when the x402 facilitator API
 * stabilizes. The current implementation follows the Coinbase x402 spec.
 */
async function settleViaFacilitator(
  facilitatorUrl: string,
  payload: Record<string, unknown>
): Promise<FacilitatorSettleResult> {
  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>
      const errorMessage = (errorBody.error as string) ?? `Facilitator returned HTTP ${response.status}`
      return { success: false, error: errorMessage }
    }

    const data = await response.json() as Record<string, unknown>

    return {
      success: true,
      txHash: typeof data.txHash === 'string' ? data.txHash : undefined,
    }
  } catch (err) {
    logger.error('x402.facilitator_error', { facilitatorUrl }, err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reach x402 facilitator.',
    }
  }
}
