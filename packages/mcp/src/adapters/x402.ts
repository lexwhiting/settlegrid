/**
 * x402 Protocol Adapter
 *
 * Extracts payment context from x402 protocol requests (Coinbase).
 * Detects requests via:
 *   1. PAYMENT-SIGNATURE header (base64-encoded payment payload)
 *   2. x-settlegrid-protocol: x402 header
 */

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
import { randomUUID } from 'crypto'

/**
 * Default x402 network identifier — `eip155:8453` is Base mainnet,
 * the most common USDC x402 deployment target. P1.K4 will make this
 * configurable per-tool.
 */
const DEFAULT_X402_NETWORK = 'eip155:8453'

/** Base-mainnet USDC contract address, used by the P1.K3 stub. */
const BASE_USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

/**
 * Zero-address placeholder for the x402 `payTo` field. P1.K4 will
 * read the tool's real payout address from config.
 */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/**
 * USDC has 6 decimal places of precision, so one USD cent is 10_000
 * base units. Used to convert `costCents` (integer cents) into the
 * `amount` string (base units of USDC).
 */
const USDC_BASE_UNITS_PER_CENT = 10_000n

/**
 * Maximum time an x402 payment authorization is valid for. Matches the
 * 300-second default used by the existing `apps/web/src/lib/x402-proxy.ts`
 * `generateX402_402Response` implementation.
 */
const X402_MAX_TIMEOUT_SECONDS = 300

export class X402Adapter implements ProtocolAdapter {
  readonly name = 'x402' as const
  readonly displayName = 'x402 Protocol (Coinbase)'

  /**
   * Detect if this request is an x402 payment.
   * x402 requests have:
   *   - A PAYMENT-SIGNATURE header (base64-encoded payment proof)
   *   - OR x-settlegrid-protocol: x402
   */
  canHandle(request: Request): boolean {
    const hasPaymentSig = request.headers.get('payment-signature') !== null
    const hasProtocolHeader = request.headers.get('x-settlegrid-protocol') === 'x402'
    return hasPaymentSig || hasProtocolHeader
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const paymentSigHeader = request.headers.get('payment-signature')

    if (!paymentSigHeader) {
      throw new Error('Missing PAYMENT-SIGNATURE header for x402 request')
    }

    // Decode the base64 payment payload
    let payload: {
      scheme?: string
      network?: string
      payload?: {
        authorization?: { from?: string }
        witness?: { recipient?: string }
      }
    }

    try {
      const decoded = Buffer.from(paymentSigHeader, 'base64').toString('utf-8')
      payload = JSON.parse(decoded)
    } catch {
      throw new Error('Invalid base64 in PAYMENT-SIGNATURE header')
    }

    const scheme = payload.scheme ?? 'exact'
    const network = payload.network ?? 'eip155:8453'

    // Extract payer from the payload based on scheme
    let payerAddress = ''
    if (scheme === 'exact' && payload.payload?.authorization?.from) {
      payerAddress = payload.payload.authorization.from
    } else if (scheme === 'upto' && payload.payload?.witness?.recipient) {
      payerAddress = payload.payload.witness.recipient
    }

    // Determine payment type based on scheme
    const paymentType = scheme === 'upto' ? 'permit2' as const : 'eip3009' as const

    return {
      protocol: 'x402',
      identity: {
        type: 'did:key',
        value: payerAddress || `x402:${network}`,
      },
      operation: {
        service: 'x402-facilitator',
        method: scheme === 'exact' ? 'transferWithAuthorization' : 'permitWitnessTransferFrom',
      },
      payment: {
        type: paymentType,
        proof: paymentSigHeader,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
    }

    if (result.txHash) {
      headers['X-SettleGrid-Tx-Hash'] = result.txHash
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        txHash: result.txHash ?? null,
        operationId: result.operationId,
        receipt: result.receipt ?? null,
        metadata: {
          protocol: result.metadata.protocol,
          latencyMs: result.metadata.latencyMs,
          settlementType: result.metadata.settlementType,
        },
      }),
      { status: 200, headers }
    )
  }

  formatError(error: Error, request: Request): Response {
    const isPaymentError =
      error.message.includes('PAYMENT') ||
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('expired') ||
      error.message.includes('invalid')

    const status = isPaymentError ? 402 : 500
    const code = isPaymentError ? 'PAYMENT_REQUIRED' : 'SERVER_ERROR'

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'x402' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  /**
   * Build the `accepts[]` entry for the x402 exact scheme. P1.K3
   * stub — hardcoded network / USDC address / zero payTo. P1.K4 will
   * read these from tool-owned config (network, asset, payTo address).
   * Field order deliberately matches the spec example and the existing
   * canonical `generateX402_402Response` in
   * `apps/web/src/lib/x402-proxy.ts`:
   * `{ scheme, network, amount, asset, payTo, maxTimeoutSeconds }`.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    // Defensive clamp before BigInt() conversion (hostile-review M2/M3):
    //   - BigInt(NaN) / BigInt(Infinity) / BigInt(1.5) all throw RangeError
    //   - BigInt(-5) succeeds but produces a negative `amount` string,
    //     which is nonsense for a 402 manifest (the client cannot be
    //     asked to pay a negative sum)
    //   - Tiered pricing with fractional `units` can surface a non-integer
    //     rawCost; upstream `validatePricingConfig` guarantees the
    //     per-tier costCents are integers but the total is a sum of
    //     products that can be fractional
    // Math.floor handles the fractional case, the finite+>=0 guard
    // handles the NaN/Infinity/negative cases, and 0 is the safe
    // default for malformed input.
    const safeCost =
      Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    const amountBaseUnits = BigInt(safeCost) * USDC_BASE_UNITS_PER_CENT
    return {
      scheme: 'exact',
      network: DEFAULT_X402_NETWORK,
      amount: amountBaseUnits.toString(),
      asset: BASE_USDC_ADDRESS,
      payTo: ZERO_ADDRESS,
      maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
    }
  }

  /** P2.K2 — spec-aligned verify() method. See mpp.ts for the full rationale. */
  async verify(request: Request, options: X402ValidateOptions): Promise<X402ProxyPaymentResult> {
    return validateX402Payment(request, options)
  }

  /** P2.K2 — generate a full x402 402 Payment Required response. */
  build402Response(options: X402_402Options): Response {
    return generateX402_402Response(options)
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const X402_PROTOCOL_VERSION = 2

/** USDC contract addresses per CAIP-2 network. */
const USDC_ADDRESSES: Record<string, string> = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
}

const X402_HEADER_NAMES = {
  PAYMENT: 'X-Payment',
  PAYMENT_SIGNATURE: 'payment-signature',
  PAYMENT_REQUIRED: 'X-Payment-Required',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface X402ProxyPaymentResult {
  valid: boolean
  txHash?: string
  payerAddress?: string
  network?: string
  amountUsdc?: string
  scheme?: 'exact' | 'upto'
  error?: { code: X402ProxyErrorCode; message: string }
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
  slug: string
  costCents: number
  displayName: string
  recipientAddress?: string
}

export interface X402ValidateOptions {
  enabled: boolean
  toolConfig: X402ToolConfig
  /** URL of the x402 facilitator service (optional — local verification otherwise). */
  facilitatorUrl?: string
  logger?: AdapterLogger
}

export interface X402_402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  recipientAddress?: string
  appUrl: string
  /** Optional fallback payment address when recipientAddress is unset. */
  fallbackPaymentAddress?: string
}

export function isX402Request(request: Request): boolean {
  if (request.headers.get(X402_HEADER_NAMES.PAYMENT)) return true
  if (request.headers.get(X402_HEADER_NAMES.PAYMENT_SIGNATURE)) return true
  if (request.headers.get(X402_HEADER_NAMES.PROTOCOL) === 'x402') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('x402_')) return true
  }

  return false
}

function decodePaymentHeader(encoded: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(encoded) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function extractX402Payload(request: Request): Record<string, unknown> | null {
  const xPayment = request.headers.get(X402_HEADER_NAMES.PAYMENT)
  if (xPayment) return decodePaymentHeader(xPayment)

  const paymentSig = request.headers.get(X402_HEADER_NAMES.PAYMENT_SIGNATURE)
  if (paymentSig) return decodePaymentHeader(paymentSig)

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('x402_')) return decodePaymentHeader(bearer.slice(5))
  }

  return null
}

function centsToUsdcBaseUnits(cents: number): string {
  return String(cents * 10_000)
}

interface FacilitatorSettleResult {
  success: boolean
  txHash?: string
  error?: string
}

async function settleViaFacilitator(
  facilitatorUrl: string,
  payload: Record<string, unknown>,
  logger: AdapterLogger,
): Promise<FacilitatorSettleResult> {
  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorMessage = (errorBody.error as string) ?? `Facilitator returned HTTP ${response.status}`
      return { success: false, error: errorMessage }
    }

    const data = (await response.json()) as Record<string, unknown>
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

export async function validateX402Payment(
  request: Request,
  options: X402ValidateOptions,
): Promise<X402ProxyPaymentResult> {
  const { enabled, toolConfig, facilitatorUrl } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'X402_NOT_CONFIGURED',
        message: 'x402 payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const payload = extractX402Payload(request)
  if (!payload) {
    return {
      valid: false,
      error: {
        code: 'X402_PAYMENT_MISSING',
        message:
          'No x402 payment proof found in request. Provide X-Payment header with base64-encoded payment payload.',
      },
    }
  }

  try {
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

    const network = (payload.network as string) ?? DEFAULT_X402_NETWORK
    if (!USDC_ADDRESSES[network]) {
      return {
        valid: false,
        error: {
          code: 'X402_NETWORK_UNSUPPORTED',
          message: `Unsupported network: ${network}. Supported: eip155:8453 (Base), eip155:84532 (Base Sepolia), eip155:1 (Ethereum).`,
        },
      }
    }

    const innerPayload = payload.payload as Record<string, unknown> | undefined
    let payerAddress = ''
    let paymentAmountBaseUnits = '0'

    if (scheme === 'exact' && innerPayload) {
      const authorization = innerPayload.authorization as Record<string, unknown> | undefined
      if (authorization) {
        payerAddress = (authorization.from as string) ?? ''
        paymentAmountBaseUnits = (authorization.value as string) ?? '0'

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

    if (facilitatorUrl) {
      const settleResult = await settleViaFacilitator(facilitatorUrl, payload, logger)
      if (!settleResult.success) {
        return {
          valid: false,
          payerAddress: payerAddress || undefined,
          network,
          scheme: scheme as 'exact' | 'upto',
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
        scheme: scheme as 'exact' | 'upto',
      }
    }

    logger.info('x402.payment_accepted_local', {
      toolSlug: toolConfig.slug,
      payerAddress,
      network,
      scheme,
      amountBaseUnits: paymentAmountBaseUnits,
      note: 'No facilitator URL configured; accepted based on structural validation.',
    })

    return {
      valid: true,
      payerAddress: payerAddress || undefined,
      network,
      amountUsdc: paymentAmountBaseUnits,
      scheme: scheme as 'exact' | 'upto',
    }
  } catch (err) {
    logger.error('x402.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'X402_FACILITATOR_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during x402 payment validation.',
      },
    }
  }
}

export function generateX402_402Response(options: X402_402Options): Response {
  const { toolSlug, costCents, toolName, recipientAddress, appUrl, fallbackPaymentAddress } = options
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const amountBaseUnits = centsToUsdcBaseUnits(costCents)
  const effectiveRecipient = recipientAddress ?? fallbackPaymentAddress ?? ZERO_ADDRESS

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
        network: DEFAULT_X402_NETWORK,
        amount: amountBaseUnits,
        asset: USDC_ADDRESSES[DEFAULT_X402_NETWORK],
        payTo: effectiveRecipient,
        maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
      },
      {
        scheme: 'upto',
        network: DEFAULT_X402_NETWORK,
        amount: amountBaseUnits,
        asset: USDC_ADDRESSES[DEFAULT_X402_NETWORK],
        payTo: effectiveRecipient,
        maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
      },
    ],
    tool: toolSlug,
    pricing_model: 'per-call',
    cost_cents: costCents,
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, re-send the request with X-Payment header containing a base64-encoded x402 payment payload (EIP-3009 or Permit2) authorizing at least ${amountBaseUnits} USDC base units (${costCents} cents).`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    [X402_HEADER_NAMES.PAYMENT_REQUIRED]: Buffer.from(JSON.stringify(body.accepts)).toString('base64'),
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}
