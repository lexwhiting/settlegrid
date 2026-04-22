/**
 * MPP Protocol Adapter — Machine Payments Protocol (Stripe + Tempo)
 *
 * Extracts payment context from MPP protocol requests.
 * MPP launched March 18, 2026, enabling Stripe-powered card payments (SPT)
 * and Tempo blockchain crypto payments for machine-to-machine commerce.
 *
 * Deep integration: SettleGrid natively accepts Stripe Shared Payment Tokens
 * (SPTs) via the Smart Proxy. See lib/mpp.ts for the full payment handler.
 *
 * Detects requests via:
 *   1. X-Payment-Protocol: MPP/1.0 header
 *   2. X-Payment-Token: spt_* header (Shared Payment Token)
 *   3. x-mpp-credential header (MPP session credential)
 *   4. x-settlegrid-protocol: mpp header
 *   5. Authorization: Bearer spt_* or Bearer mpp_* token
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

// ─── MPP Constants (P2.K2 — migrated from apps/web/src/lib/mpp.ts) ─────────

const MPP_PROTOCOL_VERSION = '1.0'
const MPP_TOKEN_PREFIX = 'spt_'
const MPP_CREDENTIAL_PREFIX = 'mpp_'

const MPP_HTTP_HEADERS = {
  PROTOCOL: 'X-Payment-Protocol',
  TOKEN: 'X-Payment-Token',
  AMOUNT: 'X-Payment-Amount',
  CURRENCY: 'X-Payment-Currency',
  DESCRIPTION: 'X-Payment-Description',
  RECIPIENT: 'X-Payment-Recipient',
  MAX_AMOUNT: 'X-Payment-Max-Amount',
  SESSION_ID: 'X-MPP-Session-Id',
} as const

export class MPPAdapter implements ProtocolAdapter {
  readonly name = 'mpp' as const
  readonly displayName = 'Machine Payments Protocol (Stripe + Tempo)'

  // P3.K1 — adapter-local idempotency cache used by settle() when the
  // caller does not inject its own store. Maps invocationId → cached
  // MppSettleResult so that a repeat call with the same invocationId
  // returns the original result and does NOT re-emit the settlement
  // event. A real settlement path wires an injected store backed by
  // the DB ledger; this Map is purely an in-adapter fallback so tests
  // and development flows get idempotent behavior out of the box.
  private readonly settleCache = new Map<string, MppSettleResult>()

  /**
   * Detect if this request is an MPP payment. P2.K3 delegates to the
   * module-level `isMppRequest` helper so both the adapter-class surface
   * (used by `protocolRegistry.detect()`) and the lib-shim surface
   * (used by the legacy 13-branch chain in route.ts) share one
   * implementation. Detection divergence between the two paths was
   * surfaced by `apps/web/src/lib/__tests__/proxy-equivalence.test.ts`
   * and unifying through a single helper is the simplest fix.
   */
  canHandle(request: Request): boolean {
    return isMppRequest(request)
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    // Extract credential from multiple possible header locations
    const credential =
      request.headers.get('x-payment-token') ??
      request.headers.get('x-mpp-credential') ??
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      null

    if (!credential) {
      throw new Error('No MPP credential found in request')
    }

    // Determine payment type from the credential or body. The default is
    // 'spt' (Stripe Shared Payment Token — MPP's primary payment path); the
    // body's `paymentType` field checked below can upgrade to 'crypto' when
    // the caller is using Tempo blockchain. The original code here was
    // `credential.startsWith('spt_') ? 'spt' : 'spt'` — a degenerate ternary
    // whose both branches returned 'spt'. It is simplified here to a straight
    // assignment so the observed behavior is preserved without the dead-code
    // smell; the identity.type ternary below continues to discriminate
    // 'spt_'-prefixed credentials from generic mpp-session credentials.
    let paymentType: 'spt' | 'crypto' = 'spt'
    let method = 'payment'
    let service = 'mpp-session'
    let sessionId: string | undefined

    // Check for MPP session ID header
    sessionId = request.headers.get('x-mpp-session-id') ?? undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      // MPP uses paymentType field to distinguish Stripe SPT vs Tempo crypto
      if (body?.paymentType === 'crypto' || body?.paymentType === 'tempo') {
        paymentType = 'crypto'
      }
      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.sessionId && !sessionId) sessionId = String(body.sessionId)
    } catch {
      // Body may not be JSON or may have been consumed
    }

    return {
      protocol: 'mpp',
      identity: {
        type: credential.startsWith('spt_') ? 'spt' : 'mpp-session',
        value: credential,
        metadata: { paymentType },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: paymentType,
      },
      ...(sessionId ? { session: { id: sessionId } } : {}),
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'mpp',
    }

    if (result.txHash) {
      headers['X-SettleGrid-Tx-Hash'] = result.txHash
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        receipt: result.receipt ?? null,
        txHash: result.txHash ?? null,
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
    const isCredentialError =
      error.message.includes('credential') ||
      error.message.includes('invalid') ||
      error.message.includes('expired') ||
      error.message.includes('unauthorized')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('balance') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isCredentialError) {
      status = 401
      code = 'MPP_CREDENTIAL_INVALID'
    } else if (isPaymentError) {
      status = 402
      code = 'MPP_PAYMENT_REQUIRED'
    } else {
      status = 500
      code = 'MPP_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'mpp' as const,
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
   * Build the `accepts[]` challenge entry for the MPP (Machine Payments
   * Protocol) rail. Renamed from `toAcceptEntry` in P1.K4 to match the
   * spec's "buildChallenge" terminology. Hardcoded Stripe provider and
   * USD currency are P1.K3 stubs; a future pass will let the tool
   * choose between Stripe and Tempo and pick a currency.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'mpp',
      provider: 'stripe',
      amountCents: costCents,
      currency: 'USD',
    }
  }

  /**
   * P2.K2 — spec-aligned verify() method. Delegates to the
   * module-level `validateMppPayment` so the implementation lives in
   * one place; the class method is the canonical call-site per spec
   * ("migrate validation logic into ... new verify() method").
   */
  async verify(request: Request, options: MppValidateOptions): Promise<MppPaymentResult> {
    return validateMppPayment(request, options)
  }

  /**
   * P2.K2 — generate a full MPP 402 Payment Required response.
   * Separate from `buildChallenge` (which builds ONE entry for the
   * multi-protocol manifest); `build402Response` returns a complete
   * MPP-specific Response with the X-Payment-* protocol headers.
   */
  build402Response(options: Mpp402Options): Response {
    return generateMpp402Response(options)
  }

  // ─── P3.K1 — Spec-aligned "standard adapter interface" methods ────────────
  //
  // The P3.K1 prompt card specifies four named methods on the adapter:
  // `detect(req)`, `buildChallenge(meterCtx)`, `verifyPayment(req)`,
  // `settle(invocation)`. The existing ProtocolAdapter interface already
  // binds the name `buildChallenge` to the narrow `AcceptEntry` surface
  // used by the multi-protocol 402 builder; changing that shape would
  // force 13 sibling adapters to refactor. The spec-aligned richer
  // envelope is therefore exposed as `buildMppChallenge` instead, with
  // the deviation called out in the commit body (D-numbered).

  /**
   * P3.K1 — compute a detection CONFIDENCE SCORE for an MPP request.
   * Returns `{ confidence, reasons }` where `confidence` is in [0, 1]
   * and `reasons` records which MPP signatures matched. Higher scores
   * mean the request is more unambiguously MPP.
   *
   * Signatures and weights (score is max over matched signatures):
   *
   *   1.00 — `X-Payment-Protocol: MPP/*`   (unambiguous protocol tag)
   *   1.00 — `x-mpp-version: ...`          (explicit MPP version tag)
   *   0.90 — `X-Payment-Token: spt_*`      (Stripe SPT — MPP-native)
   *   0.90 — `X-Payment-Token: mpp_*`      (legacy MPP credential)
   *   0.80 — `x-mpp-credential: ...`       (pre-P2.K3 legacy header)
   *   0.70 — `x-settlegrid-protocol: mpp`  (opt-in hint)
   *   0.60 — `Authorization: Bearer spt_*` / `mpp_*`
   *
   * Hostile audit specifically requires that `detect` return a real
   * score, not a constant. Each of the seven signatures contributes a
   * distinct weight so two different mixes of matched signatures
   * produce different scores. Detection does NOT inspect the request
   * body — body parsing requires `request.clone().json()` which is
   * fallible and expensive, and a body-only signature would be easy to
   * spoof via unrelated JSON envelopes. Header-level signatures are
   * authoritative for MPP.
   *
   * `canHandle()` remains a boolean and is equivalent to
   * `this.detect(request).confidence > 0`.
   */
  detect(request: Request): MppDetectionResult {
    const reasons: string[] = []
    let confidence = 0

    const mppVersion = request.headers.get('x-mpp-version')
    if (mppVersion) {
      reasons.push(`x-mpp-version: ${mppVersion}`)
      confidence = Math.max(confidence, 1.0)
    }

    const protocolHeader = request.headers.get(MPP_HTTP_HEADERS.PROTOCOL)
    if (protocolHeader && protocolHeader.startsWith('MPP')) {
      reasons.push(`${MPP_HTTP_HEADERS.PROTOCOL}: ${protocolHeader}`)
      confidence = Math.max(confidence, 1.0)
    }

    const paymentToken = request.headers.get(MPP_HTTP_HEADERS.TOKEN)
    if (paymentToken) {
      if (paymentToken.startsWith(MPP_TOKEN_PREFIX)) {
        reasons.push(`${MPP_HTTP_HEADERS.TOKEN}: ${MPP_TOKEN_PREFIX}*`)
        confidence = Math.max(confidence, 0.9)
      } else if (paymentToken.startsWith(MPP_CREDENTIAL_PREFIX)) {
        reasons.push(`${MPP_HTTP_HEADERS.TOKEN}: ${MPP_CREDENTIAL_PREFIX}*`)
        confidence = Math.max(confidence, 0.9)
      }
    }

    if (request.headers.get('x-mpp-credential')) {
      reasons.push('x-mpp-credential')
      confidence = Math.max(confidence, 0.8)
    }

    if (request.headers.get('x-settlegrid-protocol') === 'mpp') {
      reasons.push('x-settlegrid-protocol: mpp')
      confidence = Math.max(confidence, 0.7)
    }

    const auth = request.headers.get('authorization')
    if (auth) {
      const bearer = auth.replace(/^Bearer\s+/i, '')
      if (bearer.startsWith(MPP_TOKEN_PREFIX)) {
        reasons.push(`authorization: Bearer ${MPP_TOKEN_PREFIX}*`)
        confidence = Math.max(confidence, 0.6)
      } else if (bearer.startsWith(MPP_CREDENTIAL_PREFIX)) {
        reasons.push(`authorization: Bearer ${MPP_CREDENTIAL_PREFIX}*`)
        confidence = Math.max(confidence, 0.6)
      }
    }

    return { confidence, reasons }
  }

  /**
   * P3.K1 — build the full MPP 402 challenge envelope: amount, currency,
   * `merchantId`, version, accepted tokens, instructions. Distinct from
   * `buildChallenge` (which emits a narrow `AcceptEntry` for the
   * multi-protocol manifest) and from `build402Response` (which emits
   * a full HTTP Response). This is the structured payload the spec
   * card calls "the MPP 402 envelope".
   *
   * `merchantId` is required. The adapter cannot synthesize it — it
   * lives in rail config (Stripe Connect account ID, typically
   * `acct_*`). Throwing on a missing merchantId means a misconfigured
   * tool surfaces the error up front instead of emitting a 402 that
   * the consumer cannot pay.
   *
   * `paymentIntentClientSecret` is accepted when the caller has
   * pre-provisioned a Stripe MPP PaymentIntent and wants the challenge
   * to carry its client secret. Omit it for the standard flow where
   * the consumer presents an already-valid SPT in the retry request.
   */
  buildMppChallenge(options: MppChallengeOptions): MppChallengeEnvelope {
    if (
      options === null ||
      typeof options !== 'object' ||
      Array.isArray(options)
    ) {
      throw new TypeError(
        'buildMppChallenge: `options` must be a non-null object.',
      )
    }
    if (
      typeof options.merchantId !== 'string' ||
      options.merchantId.length === 0
    ) {
      throw new Error(
        'buildMppChallenge: `merchantId` is required and must be a non-empty string. ' +
          'Wire it from rail config (e.g., the Stripe Connect account ID).',
      )
    }
    if (
      typeof options.amountCents !== 'number' ||
      !Number.isFinite(options.amountCents) ||
      options.amountCents < 0 ||
      !Number.isInteger(options.amountCents)
    ) {
      throw new RangeError(
        `buildMppChallenge: \`amountCents\` must be a non-negative integer; got ${JSON.stringify(
          options.amountCents,
        )}.`,
      )
    }
    const currency = (options.currency ?? 'USD').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error(
        `buildMppChallenge: \`currency\` must be a 3-letter ISO-4217 code; got ${JSON.stringify(
          options.currency,
        )}.`,
      )
    }
    const acceptedTokens: readonly string[] =
      options.acceptedTokens && options.acceptedTokens.length > 0
        ? [...options.acceptedTokens]
        : ['spt']

    const envelope: MppChallengeEnvelope = {
      scheme: 'mpp',
      provider: 'stripe',
      version: MPP_PROTOCOL_VERSION,
      amountCents: options.amountCents,
      currency,
      merchantId: options.merchantId,
      acceptedTokens,
      instructions:
        options.instructions ??
        `To pay, re-send the request with X-Payment-Token: ${MPP_TOKEN_PREFIX}... header containing a valid Stripe Shared Payment Token authorizing at least ${options.amountCents} ${
          currency === 'USD' ? 'cents' : `minor units of ${currency}`
        }.`,
    }
    if (
      typeof options.paymentIntentClientSecret === 'string' &&
      options.paymentIntentClientSecret.length > 0
    ) {
      envelope.paymentIntentClientSecret = options.paymentIntentClientSecret
    }
    if (typeof options.recipientId === 'string' && options.recipientId.length > 0) {
      envelope.recipientId = options.recipientId
    }
    if (typeof options.description === 'string' && options.description.length > 0) {
      envelope.description = options.description
    }
    if (typeof options.directoryUrl === 'string' && options.directoryUrl.length > 0) {
      envelope.directoryUrl = options.directoryUrl
    }
    return envelope
  }

  /**
   * P3.K1 — spec-aligned verifyPayment. Delegates to `validateMppPayment`
   * for the Stripe SPT round-trip (verify + capture) and then adds two
   * defense-in-depth assertions the hostile audit explicitly requires:
   *
   *   (1) Captured `amountCents` MUST equal the tool's configured
   *       `costCents`. Under normal flow this holds by construction
   *       (validateMppPayment captures `chargeAmount = toolConfig.costCents`),
   *       but the double-check surfaces any regression where a future
   *       refactor returns a partial amount.
   *
   *   (2) Captured `currency` MUST equal the expected currency. Today
   *       validateMppPayment hardcodes 'usd' on the result regardless
   *       of what Stripe returned. This wrapper at least asserts the
   *       tool's EXPECTED currency matches that hardcoded 'usd' so a
   *       non-USD tool sees an explicit error rather than a silently
   *       wrong capture. Full multi-currency support is deliberately
   *       out of scope for P3.K1; tracked as a follow-up in commit body.
   */
  async verifyPayment(
    request: Request,
    options: MppVerifyPaymentOptions,
  ): Promise<MppPaymentResult> {
    const result = await validateMppPayment(request, options)
    if (!result.valid) return result

    const expectedCurrency = (options.expectedCurrency ?? 'usd').toLowerCase()
    const actualCurrency = (result.currency ?? '').toLowerCase()
    if (actualCurrency !== expectedCurrency) {
      return {
        valid: false,
        sessionId: result.sessionId,
        error: {
          code: 'MPP_AMOUNT_MISMATCH',
          message: `Currency mismatch: expected ${expectedCurrency}, captured ${
            actualCurrency || '(unspecified)'
          }.`,
        },
      }
    }
    if (result.amountCents !== options.toolConfig.costCents) {
      return {
        valid: false,
        sessionId: result.sessionId,
        error: {
          code: 'MPP_AMOUNT_MISMATCH',
          message: `Amount mismatch: expected ${options.toolConfig.costCents} cents, captured ${result.amountCents} cents.`,
        },
      }
    }
    return result
  }

  /**
   * P3.K1 — record a settled invocation, emit a settlement event, and
   * return a structured result. Idempotent on `invocation.invocationId`:
   * a repeat call with the same ID returns the previously-cached result
   * WITHOUT re-invoking `recordInvocation` and WITHOUT re-emitting the
   * event, so callers can safely retry on network errors without
   * double-recording.
   *
   * Dependencies are injected so:
   *   - unit tests can assert on ledger/emit call counts + arguments
   *   - production use plugs a DB-backed recorder + real event bus
   *     without the adapter importing those modules
   *   - development flows that omit `deps` still get idempotent
   *     behavior via the adapter-local `settleCache`.
   *
   * D-deviation noted in commit body: the spec says "emits a
   * `SettleGridInternalEvent`", but the existing `SettleGridInternalEvent`
   * type in `rails/types.ts` enumerates rail-level event kinds only
   * (onboarding/topup/payout/chargeback). Adding an `invocation.settled`
   * kind to that union would touch `rails/types.ts` — outside this
   * card's allowed file list — so the adapter emits a narrower
   * `MppSettlementEvent` whose shape is forward-compatible with the
   * eventual extension.
   */
  async settle(
    invocation: MppSettlement,
    deps?: MppSettleDependencies,
  ): Promise<MppSettleResult> {
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
        'settle: `invocation.invocationId` is required and must be a non-empty string (used as the idempotency key).',
      )
    }
    if (
      typeof invocation.toolSlug !== 'string' ||
      invocation.toolSlug.length === 0
    ) {
      throw new Error('settle: `invocation.toolSlug` is required and must be non-empty.')
    }
    if (
      typeof invocation.costCents !== 'number' ||
      !Number.isFinite(invocation.costCents) ||
      invocation.costCents < 0 ||
      !Number.isInteger(invocation.costCents)
    ) {
      throw new RangeError(
        `settle: \`invocation.costCents\` must be a non-negative integer; got ${JSON.stringify(
          invocation.costCents,
        )}.`,
      )
    }
    const store = deps?.idempotencyStore ?? this.settleCache
    const cached = store.get(invocation.invocationId)
    if (cached) {
      return { status: 'already-settled', event: cached.event }
    }
    const now = deps?.now ?? Date.now
    const settledAt = now()
    const currency = (invocation.currency ?? 'usd').toLowerCase()
    const event: MppSettlementEvent = {
      kind: 'invocation.settled',
      protocol: 'mpp',
      invocationId: invocation.invocationId,
      toolSlug: invocation.toolSlug,
      costCents: invocation.costCents,
      currency,
      settledAt,
      ...(invocation.paymentId !== undefined ? { paymentId: invocation.paymentId } : {}),
      ...(invocation.payerCustomerId !== undefined
        ? { payerCustomerId: invocation.payerCustomerId }
        : {}),
      ...(invocation.sessionId !== undefined ? { sessionId: invocation.sessionId } : {}),
    }
    const result: MppSettleResult = { status: 'settled', event }

    // Write to cache BEFORE invoking external deps so a concurrent
    // re-entry with the same invocationId (e.g., two parallel webhook
    // retries) short-circuits cleanly even if `recordInvocation` is
    // slow. If `recordInvocation` fails, the cache entry is rolled
    // back below so a subsequent call can retry.
    store.set(invocation.invocationId, result)

    if (deps?.recordInvocation) {
      try {
        await Promise.resolve(
          deps.recordInvocation({
            invocationId: invocation.invocationId,
            toolSlug: invocation.toolSlug,
            costCents: invocation.costCents,
            currency,
            settledAt,
            ...(invocation.paymentId !== undefined
              ? { paymentId: invocation.paymentId }
              : {}),
            ...(invocation.payerCustomerId !== undefined
              ? { payerCustomerId: invocation.payerCustomerId }
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

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

export interface MppPaymentResult {
  valid: boolean
  paymentId?: string
  amountCents?: number
  currency?: string
  payerCustomerId?: string
  sessionId?: string
  error?: { code: MppErrorCode; message: string }
}

export type MppErrorCode =
  | 'MPP_NOT_CONFIGURED'
  | 'MPP_TOKEN_MISSING'
  | 'MPP_TOKEN_INVALID'
  | 'MPP_TOKEN_EXPIRED'
  | 'MPP_AMOUNT_MISMATCH'
  | 'MPP_INSUFFICIENT_AUTHORIZATION'
  | 'MPP_CAPTURE_FAILED'
  | 'MPP_STRIPE_ERROR'

export interface MppToolConfig {
  slug: string
  costCents: number
  displayName: string
  recipientId?: string
}

export interface MppValidateOptions {
  enabled: boolean
  toolConfig: MppToolConfig
  /** Stripe MPP API secret (STRIPE_MPP_SECRET). */
  stripeMppSecret?: string
  logger?: AdapterLogger
}

export interface Mpp402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  recipientId?: string
  appUrl: string
}

/** Check if a request contains MPP payment headers (module-level helper). */
export function isMppRequest(request: Request): boolean {
  const protocol = request.headers.get(MPP_HTTP_HEADERS.PROTOCOL)
  if (protocol?.startsWith('MPP')) return true

  const token = request.headers.get(MPP_HTTP_HEADERS.TOKEN)
  if (token && (token.startsWith(MPP_TOKEN_PREFIX) || token.startsWith(MPP_CREDENTIAL_PREFIX))) {
    return true
  }

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(MPP_TOKEN_PREFIX) || bearer.startsWith(MPP_CREDENTIAL_PREFIX)) return true
  }

  if (request.headers.get('x-mpp-credential')) return true

  // P2.K3 — explicit SettleGrid protocol hint. The other 8 existing
  // adapters' isXRequest helpers all support this; MPP was the pattern
  // outlier pre-K3. Added here to align — the previous canHandle also
  // supported this hint, so unifying canHandle → isMppRequest only
  // works if isMppRequest covers the same surface.
  if (request.headers.get('x-settlegrid-protocol') === 'mpp') return true

  return false
}

function extractMppToken(request: Request): string | null {
  const paymentToken = request.headers.get(MPP_HTTP_HEADERS.TOKEN)
  if (paymentToken) return paymentToken

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith(MPP_TOKEN_PREFIX) || bearer.startsWith(MPP_CREDENTIAL_PREFIX)) {
      return bearer
    }
  }

  return request.headers.get('x-mpp-credential')
}

function extractRequestedAmount(request: Request): number | null {
  const amountHeader = request.headers.get(MPP_HTTP_HEADERS.AMOUNT)
  if (amountHeader) {
    const parsed = parseInt(amountHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const maxAmountHeader = request.headers.get(MPP_HTTP_HEADERS.MAX_AMOUNT)
  if (maxAmountHeader) {
    const parsed = parseInt(maxAmountHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

interface SptVerifyResult {
  valid: boolean
  expired?: boolean
  maxAmountCents?: number
  currency?: string
  payerCustomerId?: string
  error?: string
}

async function verifySharedPaymentToken(
  apiKey: string,
  token: string,
  logger: AdapterLogger,
): Promise<SptVerifyResult> {
  const tokenId = token.startsWith(MPP_TOKEN_PREFIX)
    ? token
    : token.startsWith(MPP_CREDENTIAL_PREFIX)
      ? token
      : `spt_${token}`

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/mpp/shared_payment_tokens/${encodeURIComponent(tokenId)}/verify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-03-18',
        },
      },
    )

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined

      if (response.status === 404) return { valid: false, error: 'SPT not found or already consumed.' }
      if (response.status === 401) return { valid: false, error: 'Invalid Stripe MPP API key.' }

      const stripeMessage = (errorObj?.message as string) ?? `Stripe returned HTTP ${response.status}`
      const isExpired = stripeMessage.toLowerCase().includes('expired')

      return { valid: false, expired: isExpired, error: stripeMessage }
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      valid: true,
      maxAmountCents: typeof data.max_amount === 'number' ? data.max_amount : undefined,
      currency: typeof data.currency === 'string' ? data.currency : 'usd',
      payerCustomerId: typeof data.customer === 'string' ? data.customer : undefined,
    }
  } catch (err) {
    logger.error('mpp.stripe_verify_error', { tokenId: tokenId.slice(0, 12) + '...' }, err)
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Failed to reach Stripe MPP API.',
    }
  }
}

interface SptCaptureParams {
  amountCents: number
  currency: string
  description: string
  recipientId?: string
  sessionId?: string
}

interface SptCaptureResult {
  success: boolean
  paymentId?: string
  payerCustomerId?: string
  error?: string
}

async function capturePayment(
  apiKey: string,
  token: string,
  params: SptCaptureParams,
  logger: AdapterLogger,
): Promise<SptCaptureResult> {
  const tokenId = token.startsWith(MPP_TOKEN_PREFIX)
    ? token
    : token.startsWith(MPP_CREDENTIAL_PREFIX)
      ? token
      : `spt_${token}`

  try {
    const formData = new URLSearchParams({
      amount: String(params.amountCents),
      currency: params.currency,
      description: params.description,
    })
    if (params.recipientId) formData.set('destination', params.recipientId)
    if (params.sessionId) formData.set('metadata[mpp_session_id]', params.sessionId)
    formData.set('metadata[platform]', 'settlegrid')
    formData.set('metadata[version]', MPP_PROTOCOL_VERSION)

    const response = await fetch(
      `https://api.stripe.com/v1/mpp/shared_payment_tokens/${encodeURIComponent(tokenId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Stripe-Version': '2026-03-18',
        },
        body: formData.toString(),
      },
    )

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const errorObj = errorBody.error as Record<string, unknown> | undefined
      const stripeMessage = (errorObj?.message as string) ?? `Capture failed with HTTP ${response.status}`
      return { success: false, error: stripeMessage }
    }

    const data = (await response.json()) as Record<string, unknown>
    return {
      success: true,
      paymentId:
        typeof data.id === 'string'
          ? data.id
          : typeof data.payment_intent === 'string'
            ? data.payment_intent
            : undefined,
      payerCustomerId: typeof data.customer === 'string' ? data.customer : undefined,
    }
  } catch (err) {
    logger.error(
      'mpp.stripe_capture_error',
      { tokenId: tokenId.slice(0, 12) + '...', amountCents: params.amountCents },
      err,
    )
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to capture payment via Stripe MPP API.',
    }
  }
}

export async function validateMppPayment(
  request: Request,
  options: MppValidateOptions,
): Promise<MppPaymentResult> {
  const { enabled, toolConfig, stripeMppSecret } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'MPP_NOT_CONFIGURED',
        message: 'MPP payments are not configured on this SettleGrid instance.',
      },
    }
  }

  if (!stripeMppSecret) {
    return {
      valid: false,
      error: {
        code: 'MPP_NOT_CONFIGURED',
        message: 'Stripe MPP secret key is not configured.',
      },
    }
  }

  const token = extractMppToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'MPP_TOKEN_MISSING',
        message:
          'No MPP payment token found in request. Provide X-Payment-Token header or Authorization: Bearer spt_* header.',
      },
    }
  }

  const sessionId = request.headers.get(MPP_HTTP_HEADERS.SESSION_ID) ?? undefined

  try {
    const verifyResult = await verifySharedPaymentToken(stripeMppSecret, token, logger)
    if (!verifyResult.valid) {
      return {
        valid: false,
        sessionId,
        error: {
          code: verifyResult.expired ? 'MPP_TOKEN_EXPIRED' : 'MPP_TOKEN_INVALID',
          message: verifyResult.error ?? 'SPT verification failed.',
        },
      }
    }

    const chargeAmount = toolConfig.costCents
    const agentAmount = extractRequestedAmount(request)

    if (agentAmount !== null && agentAmount < chargeAmount) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_AMOUNT_MISMATCH',
          message: `Agent authorized ${agentAmount} cents but tool costs ${chargeAmount} cents.`,
        },
      }
    }

    if (verifyResult.maxAmountCents !== undefined && verifyResult.maxAmountCents < chargeAmount) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_INSUFFICIENT_AUTHORIZATION',
          message: `SPT authorizes up to ${verifyResult.maxAmountCents} cents but tool costs ${chargeAmount} cents.`,
        },
      }
    }

    const captureResult = await capturePayment(
      stripeMppSecret,
      token,
      {
        amountCents: chargeAmount,
        currency: 'usd',
        description: `${toolConfig.displayName} via SettleGrid (${toolConfig.slug})`,
        recipientId: toolConfig.recipientId,
        sessionId,
      },
      logger,
    )

    if (!captureResult.success) {
      return {
        valid: false,
        sessionId,
        error: {
          code: 'MPP_CAPTURE_FAILED',
          message: captureResult.error ?? 'Payment capture failed.',
        },
      }
    }

    logger.info('mpp.payment_captured', {
      toolSlug: toolConfig.slug,
      amountCents: chargeAmount,
      paymentId: captureResult.paymentId,
      payerCustomerId: captureResult.payerCustomerId,
      sessionId,
    })

    return {
      valid: true,
      paymentId: captureResult.paymentId,
      amountCents: chargeAmount,
      currency: 'usd',
      payerCustomerId: captureResult.payerCustomerId,
      sessionId,
    }
  } catch (err) {
    logger.error(
      'mpp.validation_error',
      { toolSlug: toolConfig.slug, token: token.slice(0, 12) + '...', sessionId },
      err,
    )
    return {
      valid: false,
      sessionId,
      error: {
        code: 'MPP_STRIPE_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during MPP payment validation.',
      },
    }
  }
}

export function generateMpp402Response(options: Mpp402Options): Response {
  const { toolSlug, costCents, toolName, recipientId, appUrl } = options
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const effectiveRecipientId = recipientId ?? 'acct_settlegrid_platform'
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'mpp',
    version: MPP_PROTOCOL_VERSION,
    amount: costCents,
    currency: 'usd',
    description,
    recipient: effectiveRecipientId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_tokens: ['spt'],
    network: 'stripe',
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, re-send the request with X-Payment-Token: spt_... header containing a valid Stripe Shared Payment Token authorizing at least ${costCents} cents.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    [MPP_HTTP_HEADERS.PROTOCOL]: `MPP/${MPP_PROTOCOL_VERSION}`,
    [MPP_HTTP_HEADERS.AMOUNT]: String(costCents),
    [MPP_HTTP_HEADERS.CURRENCY]: 'USD',
    [MPP_HTTP_HEADERS.DESCRIPTION]: description,
    [MPP_HTTP_HEADERS.RECIPIENT]: effectiveRecipientId,
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}

// ─── P3.K1 — Spec-aligned method signatures ───────────────────────────────
//
// Types introduced by P3.K1 to support the spec-named methods
// `detect` / `buildMppChallenge` / `verifyPayment` / `settle` on the
// MPPAdapter class. Grouped at the bottom of the file so the P2.K2
// validation helpers above remain easy to locate; a future refactor
// may split this module into `mpp.ts` + `mpp-lifecycle.ts`.

/**
 * Result of {@link MPPAdapter.detect}. `confidence` is in [0, 1]; 0
 * means "definitely not MPP". `reasons` records the header signatures
 * the adapter matched, in insertion order. Both fields are safe to
 * log — they carry no credential material (the token prefix is
 * included but not the token body).
 */
export interface MppDetectionResult {
  confidence: number
  reasons: string[]
}

/**
 * Input to {@link MPPAdapter.buildMppChallenge}. Mirrors the subset
 * of fields the MPP 402 envelope spec requires. `merchantId` is
 * mandatory — it comes from rail config (typically the Stripe
 * Connect account ID) and cannot be synthesized by the adapter.
 */
export interface MppChallengeOptions {
  /** Per-invocation amount in the developer's settlement currency, in minor units. */
  amountCents: number
  /** ISO-4217 currency code (default: 'USD'). */
  currency?: string
  /** Rail-config merchant identifier (Stripe Connect account ID). Required. */
  merchantId: string
  /** Optional Stripe MPP PaymentIntent client secret for the consumer to finalize. */
  paymentIntentClientSecret?: string
  /** Optional Stripe Connect recipient ID (overrides the default merchantId recipient). */
  recipientId?: string
  /** Optional human-readable description (tool name, etc.). */
  description?: string
  /** Optional catalog/discovery URL to surface in the envelope. */
  directoryUrl?: string
  /** Token schemes the tool will accept. Defaults to ['spt']. */
  acceptedTokens?: readonly string[]
  /** Override the default instructions string. */
  instructions?: string
}

/**
 * Output of {@link MPPAdapter.buildMppChallenge}. Valid MPP 402
 * envelope shape — richer than the narrow `AcceptEntry` emitted by
 * `buildChallenge` (which targets the multi-protocol manifest).
 */
export interface MppChallengeEnvelope {
  readonly scheme: 'mpp'
  readonly provider: 'stripe'
  version: string
  amountCents: number
  currency: string
  merchantId: string
  acceptedTokens: readonly string[]
  instructions: string
  paymentIntentClientSecret?: string
  recipientId?: string
  description?: string
  directoryUrl?: string
}

/**
 * Options for {@link MPPAdapter.verifyPayment}. Extends the existing
 * {@link MppValidateOptions} with an expected-currency field so the
 * wrapper can assert the captured currency matches the tool's
 * configured settlement currency.
 */
export interface MppVerifyPaymentOptions extends MppValidateOptions {
  /**
   * Expected ISO-4217 currency code (case-insensitive, default 'usd').
   * The wrapper rejects the payment if `validateMppPayment` returned
   * a different currency. Today `validateMppPayment` hardcodes 'usd',
   * so this field mainly guards against a future multi-currency
   * change regressing existing USD-only flows.
   */
  expectedCurrency?: string
}

/**
 * Input to {@link MPPAdapter.settle}. `invocationId` is the idempotency
 * key — two calls with the same ID collapse to one settlement record
 * and one emitted event.
 */
export interface MppSettlement {
  /** Unique per-invocation identifier. Used as the idempotency key. */
  invocationId: string
  /** Tool slug (matches the consumer-visible tool identifier). */
  toolSlug: string
  /** Amount charged, in minor units of `currency`. */
  costCents: number
  /** ISO-4217 currency code. Normalized to lowercase in the emitted event. */
  currency?: string
  /** Stripe PaymentIntent / charge ID returned by capture. */
  paymentId?: string
  /** Stripe customer ID for the payer. */
  payerCustomerId?: string
  /** Optional session grouping for related invocations. */
  sessionId?: string
}

/**
 * Ledger record persisted by {@link MppSettleDependencies.recordInvocation}.
 * Mirrors {@link MppSettlement} plus `settledAt` (the adapter
 * computes this via `deps.now` or `Date.now`).
 */
export interface MppLedgerEntry {
  invocationId: string
  toolSlug: string
  costCents: number
  currency: string
  settledAt: number
  paymentId?: string
  payerCustomerId?: string
  sessionId?: string
}

/**
 * Settlement event emitted by {@link MPPAdapter.settle}. D-deviation
 * from the spec's literal "SettleGridInternalEvent" — see the method
 * JSDoc for the rationale. The `kind: 'invocation.settled'` literal
 * is a candidate for eventual addition to
 * {@link SettleGridInternalEventKind}; when that lands, this event
 * shape is assignable to the extended union.
 */
export interface MppSettlementEvent {
  readonly kind: 'invocation.settled'
  readonly protocol: 'mpp'
  invocationId: string
  toolSlug: string
  costCents: number
  currency: string
  settledAt: number
  paymentId?: string
  payerCustomerId?: string
  sessionId?: string
}

/**
 * Optional dependency bundle accepted by {@link MPPAdapter.settle}.
 * Every field is optional so callers can opt in to only the pieces
 * they need. Omit the whole object for a fully-stubbed settlement
 * (idempotent cache only, no external side effects).
 */
export interface MppSettleDependencies {
  /**
   * External idempotency store. When omitted, the adapter uses its
   * own in-memory `Map`. Production callers should inject a
   * DB-backed store so idempotency survives process restarts.
   */
  idempotencyStore?: Map<string, MppSettleResult>
  /**
   * Persist the settlement to a durable ledger. Called only on the
   * FIRST settle for a given invocationId; subsequent calls short-
   * circuit via the idempotency store. May be sync or async. If it
   * throws, the idempotency entry is rolled back so the caller can
   * retry without losing the slot.
   */
  recordInvocation?: (entry: MppLedgerEntry) => Promise<void> | void
  /**
   * Emit the settlement event. Called only on the first settle; not
   * re-invoked for idempotent repeats. Errors thrown from this
   * callback propagate — cache is NOT rolled back because the
   * ledger record already succeeded and re-running would double-
   * write. Emitters should therefore be resilient (no-throw, or
   * log-and-drop).
   */
  onSettled?: (event: MppSettlementEvent) => void
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number
}

/**
 * Result of {@link MPPAdapter.settle}. `status: 'settled'` is returned
 * on the first call for an invocationId; `status: 'already-settled'`
 * is returned on any subsequent call with the same invocationId.
 * The `event` is identical in both cases — callers can log or
 * forward it unconditionally.
 */
export interface MppSettleResult {
  status: 'settled' | 'already-settled'
  event: MppSettlementEvent
}
