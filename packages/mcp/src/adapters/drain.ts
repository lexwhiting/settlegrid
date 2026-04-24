/**
 * DRAIN Protocol Adapter — Off-chain USDC via EIP-712 vouchers (Polygon)
 *
 * DRAIN uses off-chain payment channels with EIP-712 signed vouchers:
 *   - One-time ~$0.02 channel opening
 *   - Subsequent payments are off-chain signed vouchers
 *   - Micropayments as low as $0.0001
 *
 * P3.K5 — EIP-712 hashing uses real Keccak-256 via `@noble/hashes/sha3`
 * (NOT FIPS SHA-3; Ethereum / DRAIN use Keccak-256, which is the
 * pre-FIPS Keccak round that Node's `createHash('sha3-256')` does
 * NOT produce). The prior scaffold used SHA-256 as a structural
 * stand-in; the P1.MKT1 audit flagged this as cryptographically
 * broken because a voucher hash computed under SHA-256 never
 * matches the on-chain Ethereum verifier's expectation. This file
 * now matches the DRAIN spec's EIP-712 digest exactly.
 *
 * Signature RECOVERY (ecrecover) remains stubbed at this phase —
 * `verifyVoucherSignature` checks shape (65-byte hex) but does not
 * derive the signer's address from the signature + voucher hash.
 * Full ecrecover integration is tracked separately (would pull
 * `@noble/curves/secp256k1`); the hash side being correct is the
 * precondition for that work.
 *
 * @see https://docs.bittensor.com/
 */

import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
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

// ─── DRAIN Constants ────────────────────────────────────────────────────────

const DRAIN_PROTOCOL_VERSION = '1.0'

/** DRAIN-specific HTTP headers */
const DRAIN_HEADERS = {
  VOUCHER: 'x-drain-voucher',
  CHANNEL: 'x-drain-channel',
  PAYER: 'x-drain-payer',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

/** Default Polygon chain ID (mainnet) */
const POLYGON_CHAIN_ID = 137

/** USDC contract address on Polygon */
const POLYGON_USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'

/** 1 cent = 10_000 USDC base units (6 decimals). */
const USDC_BASE_UNITS_PER_CENT = 10_000

/** Expected EIP-712 signature length (65 bytes = 130 hex chars). */
const EIP712_SIG_HEX_LENGTH = 130

/** Zero-address placeholder used in the 402 response when no channel configured. */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

// ─── Public types ──────────────────────────────────────────────────────────

export interface DrainPaymentResult {
  valid: boolean
  channelId?: string
  payerAddress?: string
  amountUsdc?: string
  nonce?: number
  signature?: string
  error?: { code: DrainErrorCode; message: string }
}

export type DrainErrorCode =
  | 'DRAIN_NOT_CONFIGURED'
  | 'DRAIN_VOUCHER_MISSING'
  | 'DRAIN_VOUCHER_INVALID'
  | 'DRAIN_SIGNATURE_INVALID'
  | 'DRAIN_INSUFFICIENT_AMOUNT'
  | 'DRAIN_CHANNEL_UNKNOWN'
  | 'DRAIN_NONCE_INVALID'

export interface DrainToolConfig {
  slug: string
  costCents: number
  displayName: string
}

export interface DrainValidateOptions {
  enabled: boolean
  toolConfig: DrainToolConfig
  /** Configured channel address — when set, voucher.channelAddress must match. */
  configuredChannelAddress?: string
  logger?: AdapterLogger
}

export interface Drain402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  appUrl: string
  /** Channel address for this SettleGrid deployment. */
  channelAddress?: string
}

// ─── EIP-712 voucher ───────────────────────────────────────────────────────

interface DrainVoucher {
  channelAddress: string
  payer: string
  amount: string
  nonce: number
  expiry: number
  signature: string
}

function parseVoucher(raw: string): DrainVoucher | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return extractVoucher(parsed)
  } catch {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8')
      const parsed = JSON.parse(decoded) as Record<string, unknown>
      return extractVoucher(parsed)
    } catch {
      return null
    }
  }
}

/**
 * Voucher `amount` must be a non-negative decimal integer string. Crucially,
 * this is the ONLY validation `amount` gets before it flows into BigInt(amount)
 * downstream (in validateDrainPayment's cost comparison, in computeVoucherHash
 * for EIP-712, and in DrainAdapter.extractPaymentContext for the
 * PaymentContext.payment.amount bigint). BigInt throws SyntaxError on
 * anything that isn't a parseable decimal/hex literal — hostile-review H2
 * documents the uncaught-exception path we're closing here.
 */
const DECIMAL_INT_RE = /^\d+$/

function extractVoucher(obj: Record<string, unknown>): DrainVoucher | null {
  const channelAddress =
    typeof obj.channelAddress === 'string'
      ? obj.channelAddress
      : typeof obj.channel_address === 'string'
        ? obj.channel_address
        : ''
  const payer = typeof obj.payer === 'string' ? obj.payer : ''
  const amount =
    typeof obj.amount === 'string'
      ? obj.amount
      : typeof obj.amount === 'number' && Number.isFinite(obj.amount) && obj.amount >= 0 && Number.isInteger(obj.amount)
        ? String(obj.amount)
        : ''
  const nonce =
    typeof obj.nonce === 'number' ? obj.nonce : parseInt(String(obj.nonce ?? ''), 10)
  const expiry =
    typeof obj.expiry === 'number' ? obj.expiry : parseInt(String(obj.expiry ?? '0'), 10)
  const signature = typeof obj.signature === 'string' ? obj.signature : ''

  if (!channelAddress || !payer || !amount || !signature) return null
  if (!Number.isFinite(nonce) || nonce < 0) return null
  // Hostile-review H2: reject non-decimal amount strings at the parse
  // boundary so BigInt(amount) downstream never throws. The voucher
  // format spec (DRAIN EIP-712 types) declares amount as uint256 — only
  // non-negative decimal integers are valid on the wire.
  if (!DECIMAL_INT_RE.test(amount)) return null

  return {
    channelAddress,
    payer,
    amount,
    nonce,
    expiry: Number.isFinite(expiry) ? expiry : 0,
    signature,
  }
}

// ─── EIP-712 hash (genuine Keccak-256, P3.K5) ───────────────────────────
//
// Both helpers emit lowercase hex. `keccak256` hashes a UTF-8-encoded
// string; `keccak256Hex` hashes the raw bytes decoded from a hex string
// (used for the EIP-712 concat-and-hash chain where inputs are already
// hex-encoded). The `@noble/hashes/sha3` package exports `keccak_256`
// — the pre-FIPS Keccak round, distinct from SHA-3's `sha3_256` which
// uses a different padding rule. Ethereum / EIP-712 require
// `keccak_256`.

function keccak256(input: string): string {
  return bytesToHex(keccak_256(new TextEncoder().encode(input)))
}

function keccak256Hex(hexInput: string): string {
  return bytesToHex(keccak_256(hexToBytes(hexInput)))
}

function padAddress(address: string): string {
  const clean = address.startsWith('0x') ? address.slice(2) : address
  return clean.toLowerCase().padStart(64, '0')
}

function padUint256(value: number | bigint): string {
  return BigInt(value).toString(16).padStart(64, '0')
}

function computeVoucherHash(voucher: DrainVoucher): string {
  const domainTypeHash = keccak256(
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
  )
  const nameHash = keccak256('DRAIN')
  const versionHash = keccak256('1')
  const chainIdHex = padUint256(POLYGON_CHAIN_ID)
  const contractHex = padAddress(voucher.channelAddress)

  const domainSeparator = keccak256Hex(
    domainTypeHash + nameHash + versionHash + chainIdHex + contractHex,
  )

  const structTypeHash = keccak256(
    'Voucher(address payer,uint256 amount,uint256 nonce,uint256 expiry)',
  )
  const payerHex = padAddress(voucher.payer)
  const amountHex = padUint256(BigInt(voucher.amount))
  const nonceHex = padUint256(voucher.nonce)
  const expiryHex = padUint256(voucher.expiry)

  const structHash = keccak256Hex(
    structTypeHash + payerHex + amountHex + nonceHex + expiryHex,
  )

  const prefix = '1901'
  return keccak256Hex(prefix + domainSeparator + structHash)
}

function verifyVoucherSignature(voucher: DrainVoucher): {
  valid: boolean
  recoveredAddress?: string
  error?: string
} {
  const sig = voucher.signature.startsWith('0x')
    ? voucher.signature.slice(2)
    : voucher.signature

  if (sig.length !== EIP712_SIG_HEX_LENGTH) {
    return {
      valid: false,
      error: `Invalid signature length: expected ${EIP712_SIG_HEX_LENGTH} hex chars (65 bytes), got ${sig.length}.`,
    }
  }

  if (!/^[0-9a-fA-F]+$/.test(sig)) {
    return { valid: false, error: 'Invalid signature format: not valid hex.' }
  }

  // Compute hash for future ecrecover integration (currently unused).
  void computeVoucherHash(voucher)

  return { valid: true, recoveredAddress: voucher.payer }
}

function centsToUsdcBaseUnits(cents: number): string {
  return String(cents * USDC_BASE_UNITS_PER_CENT)
}

// ─── Adapter class ─────────────────────────────────────────────────────────

export class DrainAdapter implements ProtocolAdapter {
  readonly name = 'drain' as const
  readonly displayName = 'DRAIN (Off-chain USDC via EIP-712 vouchers)'

  canHandle(request: Request): boolean {
    if (request.headers.get(DRAIN_HEADERS.VOUCHER)) return true
    if (request.headers.get(DRAIN_HEADERS.PROTOCOL) === 'drain') return true
    return false
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const voucherRaw = request.headers.get(DRAIN_HEADERS.VOUCHER)
    const voucher = voucherRaw ? parseVoucher(voucherRaw) : null

    return {
      protocol: 'drain',
      identity: {
        type: 'eip3009',
        value: voucher?.payer ?? request.headers.get(DRAIN_HEADERS.PAYER) ?? 'unknown',
        metadata: {
          channelAddress: voucher?.channelAddress,
          nonce: voucher?.nonce,
        },
      },
      operation: {
        service: 'drain-service',
        method: 'payment',
      },
      payment: {
        type: 'eip3009',
        proof: voucher?.signature,
        ...(voucher?.amount
          ? { amount: { value: BigInt(voucher.amount), currency: 'USDC' } }
          : {}),
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'drain',
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
    const isVoucherError =
      msg.includes('voucher') || msg.includes('invalid') || msg.includes('signature')
    const isInsufficient = msg.includes('insufficient') || msg.includes('amount')

    let status: number
    let code: string
    if (isVoucherError) {
      status = 401
      code = 'DRAIN_VOUCHER_INVALID'
    } else if (isInsufficient) {
      status = 402
      code = 'DRAIN_INSUFFICIENT_AMOUNT'
    } else {
      status = 500
      code = 'DRAIN_VOUCHER_INVALID'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'drain' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    )
  }

  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const safeCost = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    const amountBaseUnits = centsToUsdcBaseUnits(safeCost)
    return {
      scheme: 'drain',
      provider: 'drain',
      costCents: safeCost,
      currency: 'USDC',
      amountUsdcBaseUnits: amountBaseUnits,
      acceptedPayments: ['eip712-voucher'],
      network: 'polygon',
      chainId: POLYGON_CHAIN_ID,
    }
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(
    request: Request,
    options: DrainValidateOptions,
  ): Promise<DrainPaymentResult> {
    return validateDrainPayment(request, options)
  }

  /** P2.K2 — generate a full DRAIN 402 Payment Required response. */
  build402Response(options: Drain402Options): Response {
    return generateDrain402Response(options)
  }
}

// ─── Module-level validation ───────────────────────────────────────────────

export async function validateDrainPayment(
  request: Request,
  options: DrainValidateOptions,
): Promise<DrainPaymentResult> {
  const { enabled, toolConfig, configuredChannelAddress } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'DRAIN_NOT_CONFIGURED',
        message: 'DRAIN payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const voucherRaw = request.headers.get(DRAIN_HEADERS.VOUCHER)
  if (!voucherRaw) {
    return {
      valid: false,
      error: {
        code: 'DRAIN_VOUCHER_MISSING',
        message:
          'No DRAIN voucher found in request. Provide x-drain-voucher header with a JSON or base64-encoded EIP-712 signed voucher.',
      },
    }
  }

  const voucher = parseVoucher(voucherRaw)
  if (!voucher) {
    return {
      valid: false,
      error: {
        code: 'DRAIN_VOUCHER_INVALID',
        message:
          'Failed to parse DRAIN voucher. Ensure it contains channelAddress, payer, amount, nonce, expiry, and signature fields.',
      },
    }
  }

  const sigResult = verifyVoucherSignature(voucher)
  if (!sigResult.valid) {
    return {
      valid: false,
      channelId: voucher.channelAddress,
      payerAddress: voucher.payer,
      error: {
        code: 'DRAIN_SIGNATURE_INVALID',
        message: sigResult.error ?? 'DRAIN voucher signature verification failed.',
      },
    }
  }

  if (voucher.expiry > 0) {
    const now = Math.floor(Date.now() / 1000)
    if (now > voucher.expiry) {
      return {
        valid: false,
        channelId: voucher.channelAddress,
        payerAddress: voucher.payer,
        nonce: voucher.nonce,
        error: {
          code: 'DRAIN_VOUCHER_INVALID',
          message: `DRAIN voucher expired ${now - voucher.expiry}s ago.`,
        },
      }
    }
  }

  if (voucher.nonce < 0) {
    return {
      valid: false,
      channelId: voucher.channelAddress,
      payerAddress: voucher.payer,
      error: {
        code: 'DRAIN_NONCE_INVALID',
        message: 'DRAIN voucher nonce must be non-negative.',
      },
    }
  }

  const requiredBaseUnits = BigInt(centsToUsdcBaseUnits(toolConfig.costCents))
  const providedBaseUnits = BigInt(voucher.amount || '0')

  if (providedBaseUnits < requiredBaseUnits) {
    const providedUsdc = Number(providedBaseUnits) / 1e6
    const requiredUsdc = Number(requiredBaseUnits) / 1e6
    return {
      valid: false,
      channelId: voucher.channelAddress,
      payerAddress: voucher.payer,
      amountUsdc: voucher.amount,
      nonce: voucher.nonce,
      error: {
        code: 'DRAIN_INSUFFICIENT_AMOUNT',
        message: `Voucher amount ${providedUsdc.toFixed(6)} USDC is less than required ${requiredUsdc.toFixed(6)} USDC (${toolConfig.costCents} cents).`,
      },
    }
  }

  if (
    configuredChannelAddress &&
    voucher.channelAddress.toLowerCase() !== configuredChannelAddress.toLowerCase()
  ) {
    return {
      valid: false,
      channelId: voucher.channelAddress,
      payerAddress: voucher.payer,
      error: {
        code: 'DRAIN_CHANNEL_UNKNOWN',
        message: `Voucher channel ${voucher.channelAddress} does not match configured channel ${configuredChannelAddress}.`,
      },
    }
  }

  logger.info('drain.payment_accepted', {
    toolSlug: toolConfig.slug,
    channelId: voucher.channelAddress,
    payerAddress: voucher.payer,
    amountBaseUnits: voucher.amount,
    nonce: voucher.nonce,
  })

  return {
    valid: true,
    channelId: voucher.channelAddress,
    payerAddress: voucher.payer,
    amountUsdc: voucher.amount,
    nonce: voucher.nonce,
    signature: voucher.signature,
  }
}

// ─── Module-level 402 generation ───────────────────────────────────────────

export function generateDrain402Response(options: Drain402Options): Response {
  const { toolSlug, costCents, toolName, appUrl } = options
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`
  const amountBaseUnits = centsToUsdcBaseUnits(costCents)
  const channelAddress = options.channelAddress ?? ZERO_ADDRESS

  const body = {
    error: 'payment_required',
    protocol: 'drain',
    version: DRAIN_PROTOCOL_VERSION,
    amount_cents: costCents,
    amount_usdc_base_units: amountBaseUnits,
    currency: 'usdc',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['eip712-voucher'],
    channel: {
      address: channelAddress,
      network: 'polygon',
      chain_id: POLYGON_CHAIN_ID,
      asset: POLYGON_USDC_ADDRESS,
      opening_cost_usd: 0.02,
      min_payment_usd: 0.0001,
    },
    eip712: {
      domain: {
        name: 'DRAIN',
        version: '1',
        chainId: POLYGON_CHAIN_ID,
        verifyingContract: channelAddress,
      },
      types: {
        Voucher: [
          { name: 'payer', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
        ],
      },
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, create an EIP-712 signed voucher for at least ${amountBaseUnits} USDC base units (${costCents} cents) on the DRAIN channel at ${channelAddress} on Polygon. Re-send the request with x-drain-voucher header containing the JSON-encoded voucher with signature.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'drain',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}
