/**
 * Circle Nanopayments Adapter
 *
 * Extracts payment context from Circle Nanopayment requests.
 * Gas-free (for the payer) micropayments as small as $0.000001 using USDC: the
 * payer signs an EIP-3009 authorization, SettleGrid verifies it offline and (as
 * of P3.K4 A2) settles it on-chain from its own gas wallet. x402-compatible.
 *
 * Detects requests via:
 *   1. x-circle-nano-auth header (EIP-3009 authorization)
 *   2. x-settlegrid-protocol: circle-nano header
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

export class CircleNanoAdapter implements ProtocolAdapter {
  readonly name = 'circle-nano' as const
  readonly displayName = 'Circle Nanopayments (USDC)'

  /**
   * Detect if this request is a Circle Nanopayment. P2.K3 delegates to
   * the module-level `isCircleNanoRequest` helper for a single
   * detection surface.
   */
  canHandle(request: Request): boolean {
    return isCircleNanoRequest(request)
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const authHeader = request.headers.get('x-circle-nano-auth')

    if (!authHeader) {
      throw new Error('Missing x-circle-nano-auth header for Circle Nanopayment request')
    }

    // Parse the EIP-3009 authorization payload
    let fromAddress = ''
    let amount: bigint | undefined
    let authorizationId: string | undefined
    let method = 'nanopayment'
    let service = 'circle-nano'

    try {
      const clone = request.clone()
      const body = await clone.json()

      if (body?.from) fromAddress = String(body.from)
      if (body?.amount) amount = BigInt(body.amount)
      if (body?.authorizationId) authorizationId = String(body.authorizationId)
      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
    } catch {
      // Body may not be JSON or may have been consumed
    }

    return {
      protocol: 'circle-nano',
      identity: {
        type: 'eip3009',
        value: fromAddress || authHeader,
        metadata: { authorizationId },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'nanopayment',
        proof: authHeader,
        ...(amount != null
          ? { amount: { value: amount, currency: 'USDC' } }
          : {}),
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'circle-nano',
    }

    if (result.txHash) {
      headers['X-SettleGrid-Tx-Hash'] = result.txHash
    }

    return new Response(
      JSON.stringify({
        // Legacy defensive branch. P3.K4 A2 made the settle route on-chain — it
        // now returns 'settled' (with a txHash) or a structured HTTP error,
        // never a 'pending' SettlementResult. We still treat a first-party
        // 'pending' as a consumer-success for backward compatibility (the kernel
        // facilitator IS SettleGrid's own settle route, not an untrusted third
        // party).
        success: result.status === 'settled' || result.status === 'pending',
        operationId: result.operationId,
        costCents: result.costCents,
        receipt: result.receipt ?? null,
        batchId: result.txHash ?? null,
        // Honest derivation: report 'on-chain' only when a real settlement
        // transaction exists (result.txHash). P3.K4 A2 submits the EIP-3009
        // transferWithAuthorization on-chain and populates txHash, so a settled
        // on-chain payment reports 'on-chain'; free / unattributable settlements
        // (no txHash) still report 'off-chain-confirmed'.
        settlementStatus: result.txHash ? 'on-chain' : 'off-chain-confirmed',
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
    const isAuthError =
      error.message.includes('auth') ||
      error.message.includes('invalid') ||
      error.message.includes('expired') ||
      error.message.includes('unauthorized')

    const isPaymentError =
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('funds')

    let status: number
    let code: string

    if (isAuthError) {
      status = 401
      code = 'NANO_AUTH_INVALID'
    } else if (isPaymentError) {
      status = 402
      code = 'NANO_INSUFFICIENT_FUNDS'
    } else {
      status = 500
      code = 'NANO_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'circle-nano' as const,
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
   * Build the `accepts[]` challenge entry for the Circle Nanopayments
   * rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateCircleNano402Response` in
   * `apps/web/src/lib/circle-nano-proxy.ts`: protocol + amount_cents
   * + amount_usdc_base_units + currency 'usdc' + accepted_payments
   * ['eip3009-nanopayment']. The amount is converted from cents to
   * USDC 6-decimal base units (same conversion x402 uses) with the
   * same defensive clamp so malformed pricing (NaN / Infinity / float
   * / negative) produces `'0'` instead of a RangeError from BigInt().
   *
   * A future pass will replace this with the full Circle Nano
   * x402-compatible entry (off-chain batch config, max nano amount,
   * Circle API endpoint, settlement window).
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const safeCost =
      Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    // 1 cent = 10_000 base units of USDC (6 decimals).
    const USDC_BASE_UNITS_PER_CENT = 10_000n
    const amountBaseUnits = BigInt(safeCost) * USDC_BASE_UNITS_PER_CENT
    return {
      scheme: 'circle-nano',
      provider: 'circle',
      costCents: safeCost,
      currency: 'USDC',
      amountUsdcBaseUnits: amountBaseUnits.toString(),
      acceptedPayments: ['eip3009-nanopayment'],
    }
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(
    request: Request,
    options: CircleNanoValidateOptions,
  ): Promise<CircleNanoPaymentResult> {
    return validateCircleNanoPayment(request, options)
  }

  /**
   * P2.K2 — generate a full Circle Nano 402 Payment Required response.
   *
   * NOTE on payment discovery (B1.1): the `recipient` / `assetAddress` /
   * `assetDomain` fields that make the 402 payable are NOT sourced here. This
   * package is intentionally crypto-constant-free — duplicating the USDC
   * address + EIP-712 domain into packages/mcp would reintroduce exactly the
   * drift class that shipped the A2 Base-Sepolia domain bug. The app layer is
   * the canonical injector: `apps/web/src/lib/circle-nano-proxy.ts` passes them
   * from the pinned constants the verifier binds to. Called WITHOUT them (e.g.
   * the bare adapter / kernel manifest teaser) this emits a discovery-less,
   * unpayable 402 BY DESIGN. Any production path that must serve a payable
   * circle-nano 402 MUST inject discovery the way that wrapper does.
   */
  build402Response(options: CircleNano402Options): Response {
    return generateCircleNano402Response(options)
  }
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const CIRCLE_NANO_PROTOCOL_VERSION = '1.0'

const CIRCLE_NANO_HTTP_HEADERS = {
  AUTH: 'x-circle-nano-auth',
  WALLET: 'x-circle-nano-wallet',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface CircleNanoPaymentResult {
  valid: boolean
  confirmationId?: string
  payerAddress?: string
  amountUsdc?: string
  error?: { code: CircleNanoErrorCode; message: string }
}

export type CircleNanoErrorCode =
  | 'CIRCLE_NANO_NOT_CONFIGURED'
  | 'CIRCLE_NANO_AUTH_MISSING'
  | 'CIRCLE_NANO_AUTH_INVALID'
  | 'CIRCLE_NANO_NETWORK_UNSUPPORTED'
  | 'CIRCLE_NANO_WRONG_RECIPIENT'
  | 'CIRCLE_NANO_NOT_YET_VALID'
  | 'CIRCLE_NANO_EXPIRED'
  | 'CIRCLE_NANO_VALIDBEFORE_TOO_FAR'
  | 'CIRCLE_NANO_AMOUNT_MISMATCH'
  | 'CIRCLE_NANO_INSUFFICIENT_FUNDS'
  | 'CIRCLE_NANO_API_ERROR'

export interface CircleNanoToolConfig {
  slug: string
  costCents: number
  displayName: string
}

export interface CircleNanoValidateOptions {
  enabled: boolean
  toolConfig: CircleNanoToolConfig
  logger?: AdapterLogger
}

export interface CircleNano402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  appUrl: string
  /**
   * B1.1 — payment-discovery fields a payer needs to construct a valid EIP-3009
   * `transferWithAuthorization` from the 402 alone. The app wrapper sources these
   * from the pinned on-chain constants in apps/web (`USDC_ADDRESSES` +
   * `USDC_EIP712_DOMAINS`) — the SAME single source the verifier binds signatures
   * to — so the advertised payee/token/domain match what the verifier enforces
   * BY CONSTRUCTION. The core stays crypto-constant-free (no duplication, no
   * drift — the exact class of bug that shipped the A2 Sepolia domain-name issue).
   *
   * Emitted as a coherent all-or-nothing set: the body advertises `pay_to` +
   * `asset_address` + `eip712_domain` only when the wrapper supplies a recipient
   * AND the network's pinned asset + domain; otherwise they are omitted rather
   * than advertise a payee/contract the rail can't honor.
   */
  /** `authorization.to` the verifier requires (a 0x address). */
  recipient?: string
  /** CAIP-2 settlement network advertised in the body. Defaults to `eip155:8453`. */
  network?: string
  /** USDC token contract for {@link network} (the EIP-712 `verifyingContract`). */
  assetAddress?: string
  /** USDC EIP-712 domain identity for {@link network} (`name`/`version`/`chainId`). */
  assetDomain?: { name: string; version: string; chainId: number }
}

export function isCircleNanoRequest(request: Request): boolean {
  if (request.headers.get(CIRCLE_NANO_HTTP_HEADERS.AUTH)) return true
  if (request.headers.get(CIRCLE_NANO_HTTP_HEADERS.PROTOCOL) === 'circle-nano') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('cnano_')) return true
  }

  return false
}

/**
 * Networks the circle-nano kernel rail verifies EIP-3009 authorizations
 * against — Base mainnet + Base Sepolia, matching the USDC deployments the
 * web-app verifier knows the EIP-712 domain for. Kept narrow on purpose: a
 * network we can't pin the USDC contract + domain for must fail closed.
 */
export const CIRCLE_NANO_SUPPORTED_NETWORKS = [
  'eip155:8453',
  'eip155:84532',
] as const

/** 1 US cent = 10,000 USDC base units (USDC has 6 decimals). */
const CIRCLE_NANO_BASE_UNITS_PER_CENT = 10_000n

/** The EIP-3009 `transferWithAuthorization` message fields the payer signs. */
export interface CircleNanoAuthorization {
  from: string
  to: string
  /** Authorized amount in USDC base units (6 decimals), as a decimal string. */
  value: string
  /** Unix-seconds lower bound, as a decimal string. */
  validAfter: string
  /** Unix-seconds upper bound, as a decimal string. */
  validBefore: string
  /** 0x-prefixed bytes32 EIP-3009 nonce. */
  nonce: string
}

/**
 * The serialized payment proof carried in the `x-circle-nano-auth` header
 * and forwarded as `PaymentContext.payment.proof` across the kernel→
 * facilitator hop. A self-contained EIP-3009 authorization + its EIP-712
 * signature + the CAIP-2 network, so the server can verify it offline
 * (no Circle account or API key required).
 */
export interface CircleNanoProof {
  /** CAIP-2 network id, e.g. 'eip155:8453'. */
  network: string
  authorization: CircleNanoAuthorization
  /** 0x-prefixed 65-byte EIP-712 signature over the authorization. */
  signature: string
}

/**
 * Decode + shape-validate the serialized EIP-3009 proof. Accepts base64(JSON)
 * or raw JSON (mirrors the x402 X-Payment header decode). Returns null on any
 * structural defect. This is the single decode surface shared by the SDK
 * structural check and the web-app's viem signature verifier, so both agree
 * on what a well-formed proof is.
 */
export function parseCircleNanoProof(proof: string): CircleNanoProof | null {
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s)
    } catch {
      return undefined
    }
  }
  // base64-first (the wire default), then raw-JSON fallback.
  let obj = tryParse(Buffer.from(proof, 'base64').toString('utf-8'))
  if (obj === undefined) obj = tryParse(proof)
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null

  const o = obj as Record<string, unknown>
  if (typeof o.network !== 'string' || typeof o.signature !== 'string') return null

  const auth = o.authorization
  if (auth === null || typeof auth !== 'object' || Array.isArray(auth)) return null
  const a = auth as Record<string, unknown>
  const fields = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'] as const
  for (const f of fields) {
    if (typeof a[f] !== 'string') return null
  }

  return {
    network: o.network,
    signature: o.signature,
    authorization: {
      from: a.from as string,
      to: a.to as string,
      value: a.value as string,
      validAfter: a.validAfter as string,
      validBefore: a.validBefore as string,
      nonce: a.nonce as string,
    },
  }
}

/**
 * Structural (NON-cryptographic) validation of a circle-nano EIP-3009 proof.
 *
 * IMPORTANT: this does NOT verify the EIP-712 signature, nor that the payee
 * (`authorization.to`) is SettleGrid. Signature recovery requires
 * secp256k1/EIP-712 (viem), which lives in the web app
 * (`apps/web/src/lib/settlement/circle-nano/verify.ts`) because
 * `@settlegrid/mcp` is a zero-crypto-dependency package. The AUTHORITATIVE
 * signature + recipient check runs server-side on the kernel facilitator
 * route. This check validates shape, supported network, the time window, and
 * the authorized amount so a direct SDK consumer of `adapter.verify()` gets
 * fast structural feedback — it must NOT be treated as proof the payment is
 * authentic.
 */
export function validateCircleNanoProofString(
  proof: string | null,
  options: CircleNanoValidateOptions,
): CircleNanoPaymentResult {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_NOT_CONFIGURED',
        message: 'Circle Nanopayments are not configured on this SettleGrid instance.',
      },
    }
  }

  if (!proof) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AUTH_MISSING',
        message:
          'No Circle Nanopayment authorization found. Provide x-circle-nano-auth with an EIP-3009 authorization.',
      },
    }
  }

  const parsed = parseCircleNanoProof(proof)
  if (!parsed) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AUTH_INVALID',
        message:
          'Malformed circle-nano authorization: expected base64/JSON { network, authorization{from,to,value,validAfter,validBefore,nonce}, signature }.',
      },
    }
  }

  if (!(CIRCLE_NANO_SUPPORTED_NETWORKS as readonly string[]).includes(parsed.network)) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_NETWORK_UNSUPPORTED',
        message: `Unsupported network: ${parsed.network}. Supported: ${CIRCLE_NANO_SUPPORTED_NETWORKS.join(', ')}.`,
      },
    }
  }

  // Time window. Best-effort here; the server re-checks authoritatively.
  const now = Math.floor(Date.now() / 1000)
  const validAfter = Number(parsed.authorization.validAfter)
  const validBefore = Number(parsed.authorization.validBefore)
  if (Number.isFinite(validAfter) && now < validAfter) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_NOT_YET_VALID',
        message: `Authorization not yet valid: becomes valid in ${validAfter - now}s (validAfter=${validAfter}, now=${now}).`,
      },
    }
  }
  if (Number.isFinite(validBefore) && now > validBefore) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_EXPIRED',
        message: `Authorization expired ${now - validBefore}s ago (validBefore=${validBefore}, now=${now}).`,
      },
    }
  }

  // Authorized amount must cover the tool's registered cost.
  let authorized: bigint
  try {
    authorized = BigInt(parsed.authorization.value)
  } catch {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AUTH_INVALID',
        message: `Authorization value is not an integer base-unit string: "${parsed.authorization.value}".`,
      },
    }
  }
  const required =
    BigInt(Math.max(0, Math.floor(toolConfig.costCents))) * CIRCLE_NANO_BASE_UNITS_PER_CENT
  if (authorized < required) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AMOUNT_MISMATCH',
        message: `Authorization covers ${authorized} USDC base units but tool costs ${required} (${toolConfig.costCents}¢).`,
      },
    }
  }

  logger.info('circle_nano.proof_structurally_valid', {
    toolSlug: toolConfig.slug,
    payer: parsed.authorization.from,
    amountBaseUnits: parsed.authorization.value,
  })

  return {
    valid: true,
    payerAddress: parsed.authorization.from,
    amountUsdc: parsed.authorization.value,
  }
}

/**
 * SDK-side validation entrypoint (the P2.K2 `verify()` delegate). Reads the
 * `x-circle-nano-auth` header and runs {@link validateCircleNanoProofString}.
 * See that function's note: this is STRUCTURAL only — the authoritative
 * EIP-712 signature + recipient check is server-side.
 */
export async function validateCircleNanoPayment(
  request: Request,
  options: CircleNanoValidateOptions,
): Promise<CircleNanoPaymentResult> {
  const proof = request.headers.get(CIRCLE_NANO_HTTP_HEADERS.AUTH)
  return validateCircleNanoProofString(proof, options)
}

export function generateCircleNano402Response(options: CircleNano402Options): Response {
  const { toolSlug, costCents, toolName, appUrl, recipient, assetAddress, assetDomain } = options
  const network = options.network ?? 'eip155:8453'
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`
  // Mirror the verifier's amount math (it floors + clamps costCents to a
  // non-negative integer before computing required base units) so the
  // advertised amount can NEVER diverge from what the verifier requires — even
  // if a future caller passes an unfloored / negative / non-finite cost. The
  // sole production caller already floors at source; this keeps the core
  // self-consistent on its own rather than relying on the caller.
  const safeCents = Number.isFinite(costCents) ? Math.max(0, Math.floor(costCents)) : 0
  const amountBaseUnits = String(safeCents * 10_000)

  // B1.1 — payment discovery. Surface the payee + token contract + EIP-712 domain
  // so an external payer can build a valid authorization from this response alone.
  // All-or-nothing: only advertise when we have a recipient AND the network's
  // pinned asset + domain (the wrapper supplies the same constants the verifier
  // binds to). Narrowed via one object so property access can't leak `undefined`.
  const discovery =
    recipient && assetAddress && assetDomain
      ? {
          payTo: recipient,
          assetAddress,
          eip712Domain: {
            name: assetDomain.name,
            version: assetDomain.version,
            chain_id: assetDomain.chainId,
            verifying_contract: assetAddress,
          },
        }
      : null

  const settlement = {
    type: 'on-chain',
    batch_settlement: 'none',
    network,
    asset: 'USDC',
    ...(discovery
      ? { asset_address: discovery.assetAddress, eip712_domain: discovery.eip712Domain }
      : {}),
  }

  // Tell the payer to sign for the EXACT advertised amount: EIP-3009 transfers
  // the precise signed `value`, so "at least" would induce overpayment (the
  // verifier accepts value >= required, but the payer should sign exactly this).
  const instructions = discovery
    ? `To pay, sign an EIP-3009 transferWithAuthorization for ${amountBaseUnits} USDC base units of token ${discovery.assetAddress} to ${discovery.payTo} on Base (${network}), signed with the eip712_domain in this response, then re-send the request with the signed authorization in the x-circle-nano-auth header.`
    : `To pay, sign an EIP-3009 transferWithAuthorization for ${amountBaseUnits} USDC base units, then re-send the request with the x-circle-nano-auth header.`

  const body = {
    error: 'payment_required',
    protocol: 'circle-nano',
    version: CIRCLE_NANO_PROTOCOL_VERSION,
    amount_cents: safeCents,
    amount_usdc_base_units: amountBaseUnits,
    currency: 'usdc',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    ...(discovery ? { pay_to: discovery.payTo } : {}),
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['eip3009-nanopayment'],
    settlement,
    directory_url: `${appUrl}/api/v1/discover`,
    instructions,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'circle-nano',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}
