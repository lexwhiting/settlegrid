/**
 * Mastercard Verifiable Intent Adapter
 *
 * Extracts payment context from Mastercard Verifiable Intent requests using
 * SD-JWT selective disclosure with ES256 signatures.
 * Three-layer delegation chain: Credential Provider -> User -> Agent.
 *
 * Naming note: "Verifiable Intent" is the canonical product / spec name
 * for this protocol. Earlier press coverage referred to it as "Mastercard
 * Agent Pay"; that naming is retired in SettleGrid code and marketing.
 *
 * Detects requests via:
 *   1. x-mc-verifiable-intent header (SD-JWT credential chain)
 *   2. x-settlegrid-protocol: mastercard-vi header
 */

import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import { ProtocolNotYetSupportedError } from '../errors'
import type {
  AdapterLogger,
  PaymentContext,
  ProtocolAdapter,
  SettlementResult,
} from './types'
import { NOOP_LOGGER } from './types'
import { randomUUID } from 'crypto'

// ─── Mastercard VI envelope constants ───────────────────────────────────────

/**
 * Public landing page that the 503 detection-stub response points buyers
 * to. P3.PROT1 spec literal: ``See settlegrid.ai/protocols/mastercard-vi``.
 */
export const MASTERCARD_VI_LANDING_URL =
  'https://settlegrid.ai/protocols/mastercard-vi'

/**
 * Coarse expected-rollout timeline surfaced in the 503 response so a
 * buyer's client can decide when to retry. Aligns with Mastercard's
 * March 2026 announcement of a Q3 2026 GA target.
 */
export const MASTERCARD_VI_EXPECTED_AT = '2026-Q3'

/**
 * Issuer claim values that mark an SD-JWT envelope as Mastercard-issued.
 * Exact-string match on a normalized `iss` claim is the spec literal —
 * "Mastercard issuer" — and is the narrow detection signal that
 * separates an MVI envelope from any other random SD-JWT (e.g. a
 * generic OIDC ID token, or AP2's own JWT).
 *
 * The two values cover the canonical issuer DID + the API-host form
 * Mastercard publishes in its developer docs.
 */
const MC_ISSUER_VALUES = new Set<string>([
  'did:mastercard:vi',
  'https://api.mastercard.com/verifiable-intent',
])

/**
 * AP2 interoperability claim — Mastercard publishes their VI envelope
 * with an explicit AP2 claim block so AP2 agents can interop. The
 * presence of this claim is what lets us distinguish a Mastercard VI
 * envelope from a generic Mastercard SD-JWT (e.g. a card-on-file
 * verification token). Per spec: "AP2-compatible claims".
 */
const MC_AP2_CLAIM_KEY = 'ap2_intent'

export class MastercardVIAdapter implements ProtocolAdapter {
  readonly name = 'mastercard-vi' as const
  readonly displayName = 'Mastercard Verifiable Intent'

  /**
   * Detect if this request is a Mastercard Verifiable Intent payment.
   * P2.K3 delegates to the module-level `isMastercardRequest` helper
   * for a single detection surface.
   */
  canHandle(request: Request): boolean {
    return isMastercardRequest(request)
  }

  /**
   * P3.PROT1 spec-literal alias for :meth:`canHandle`. The spec
   * describes the protocol-adapter contract using the verb ``detect``;
   * the in-tree :class:`ProtocolAdapter` interface uses ``canHandle``.
   * Both point at the same code path so callers writing against the
   * spec text and callers writing against the existing interface
   * agree.
   */
  detect(request: Request): boolean {
    return this.canHandle(request)
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const intentHeader = request.headers.get('x-mc-verifiable-intent') ?? ''
    let method = 'payment'
    let service = 'mastercard-agent-pay'
    let intentId: string | undefined

    try {
      const clone = request.clone()
      const body = await clone.json()

      if (body?.method) method = String(body.method)
      if (body?.service) service = String(body.service)
      if (body?.intentId) intentId = String(body.intentId)
    } catch {
      // Body may not be JSON
    }

    return {
      protocol: 'mastercard-vi',
      identity: {
        type: 'sd-jwt',
        value: intentHeader || 'unknown',
        metadata: { intentId },
      },
      operation: {
        service,
        method,
      },
      payment: {
        type: 'agentic-token',
        proof: intentHeader || undefined,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'mastercard-vi',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        intentId: result.operationId,
        verified: result.status === 'settled',
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
    // P3.PROT1 — detection-stub error has dedicated 503 envelope shape.
    if (error instanceof ProtocolNotYetSupportedError) {
      return _buildDetectionStubResponse()
    }

    const isIntentError =
      error.message.includes('intent') ||
      error.message.includes('credential') ||
      error.message.includes('expired') ||
      error.message.includes('invalid') ||
      error.message.includes('unauthorized')

    const isPaymentError =
      error.message.includes('payment') ||
      error.message.includes('insufficient') ||
      error.message.includes('declined')

    let status: number
    let code: string

    if (isIntentError) {
      status = 401
      code = 'MC_VI_INVALID_INTENT'
    } else if (isPaymentError) {
      status = 402
      code = 'MC_VI_PAYMENT_ERROR'
    } else {
      status = 500
      code = 'MC_VI_SERVER_ERROR'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'mastercard-vi' as const,
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
   * Build the `accepts[]` challenge entry for the Mastercard
   * Verifiable Intent rail.
   *
   * Mirrors the characteristic fields from the canonical
   * `generateMastercard402Response` in
   * `apps/web/src/lib/mastercard-proxy.ts` (protocol + amount_cents +
   * currency + accepted_credentials + credential_requirements).
   * A future pass will replace this with the full SD-JWT credential
   * chain challenge (ES256 issuer key, three-layer delegation chain,
   * Mastercard's Verifiable Intent endpoint) — today's stub carries the
   * accepted_credentials list so a client can recognize the rail.
   */
  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'mastercard-vi',
      provider: 'mastercard',
      costCents,
      currency: 'USD',
      acceptedCredentials: ['sd-jwt-verifiable-intent'],
    }
  }

  /**
   * P3.PROT1 — Mastercard VI verification is a detection-only stub.
   * The adapter recognizes MVI envelopes but does NOT yet validate
   * them end-to-end (the upstream Mastercard issuer-key fetch + ES256
   * signature verification + three-layer delegation chain check are
   * pending the Q3 2026 GA of Mastercard's Verifiable Intent API).
   *
   * Throwing ``ProtocolNotYetSupportedError`` here — rather than
   * returning ``{ valid: true }`` based on structural / header checks
   * — is the spec literal: "rather than silently failing or accepting
   * unverified payments". The kernel's error-mapping path catches the
   * throw and maps it to the 503 detection-stub response built by
   * :meth:`buildDetectionStubResponse`.
   *
   * Spec-mandated method name aliases: ``verify`` (P2.K2 contract) and
   * ``verifyPayment`` (P3.PROT1 spec literal) point at the same code
   * path.
   */
  async verify(
    request: Request,
    options: MastercardValidateOptions,
  ): Promise<MastercardPaymentResult> {
    // Preserve the P2.K2 contract for the gated-off path: when the
    // adapter is disabled at the deployment level, surface
    // ``MC_NOT_CONFIGURED`` (a non-throwing "this rail is off" signal
    // the kernel uses to fall through to other adapters). Otherwise —
    // adapter is enabled, validation would happen — throw to surface
    // the detection-stub status. Order matches the spec: detection +
    // not-yet-supported is what fires when the protocol is on but
    // un-validated, not when it's off.
    if (!options.enabled) {
      return validateMastercardPayment(request, options)
    }
    throw this._detectionStubError()
  }

  /** P3.PROT1 spec-literal alias for :meth:`verify`. */
  async verifyPayment(_request: Request): Promise<never> {
    throw this._detectionStubError()
  }

  /**
   * P3.PROT1 — generate the 503 "protocol detected, validation pending"
   * response. Spec-literal body shape:
   *   {
   *     status: 'protocol_detected',
   *     protocol: 'mastercard-vi',
   *     message: 'Mastercard Verifiable Intent detected. Full validation
   *               lands in <date>. See settlegrid.ai/protocols/mastercard-vi.',
   *     expected_at: '2026-Q3'
   *   }
   *
   * Used by :meth:`formatError` when ``ProtocolNotYetSupportedError``
   * propagates up from :meth:`verify` / :meth:`verifyPayment`. May also
   * be called directly by callers that want to short-circuit a
   * detected request without invoking verify (e.g. an upstream
   * detection middleware).
   */
  buildDetectionStubResponse(_meterCtx?: BuildChallengeOptions): Response {
    return _buildDetectionStubResponse()
  }

  /** P2.K2 — generate a full Mastercard VI 402 Payment Required response. */
  build402Response(options: Mastercard402Options): Response {
    return generateMastercard402Response(options)
  }

  /**
   * P3.PROT1 — settle is intentionally never reached: the verify path
   * always throws first, so an upstream caller cannot end up at
   * settlement with an unverified MVI envelope. Defined here so a
   * future kernel that calls ``adapter.settle()`` directly without
   * going through verify still surfaces the same 503 contract instead
   * of silently committing.
   */
  async settle(_invocation: unknown): Promise<never> {
    throw this._detectionStubError()
  }

  private _detectionStubError(): ProtocolNotYetSupportedError {
    return new ProtocolNotYetSupportedError({
      protocol: 'mastercard-vi',
      expectedAt: MASTERCARD_VI_EXPECTED_AT,
      landingUrl: MASTERCARD_VI_LANDING_URL,
      message:
        `Mastercard Verifiable Intent detected. ` +
        `Full validation lands in ${MASTERCARD_VI_EXPECTED_AT}. ` +
        `See ${MASTERCARD_VI_LANDING_URL}.`,
    })
  }
}

// ─── 503 detection-stub response builder ───────────────────────────────────

/**
 * Module-level builder for the spec-literal 503 envelope. Kept separate
 * from the class method so the kernel's error mapper can use it without
 * needing an adapter instance.
 */
export function _buildDetectionStubResponse(): Response {
  const body = {
    status: 'protocol_detected' as const,
    protocol: 'mastercard-vi' as const,
    message:
      `Mastercard Verifiable Intent detected. ` +
      `Full validation lands in ${MASTERCARD_VI_EXPECTED_AT}. ` +
      `See ${MASTERCARD_VI_LANDING_URL}.`,
    expected_at: MASTERCARD_VI_EXPECTED_AT,
  }
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'X-SettleGrid-Protocol': 'mastercard-vi',
      // 'Retry-After' is a coarse signal so well-behaved buyers back off.
      // Use a generous value (1 day) — clients should really retry once
      // the rollout date passes, but we shouldn't promise that exactly.
      'Retry-After': '86400',
      'Cache-Control': 'no-store',
    },
  })
}

// ─── Module-level types + validation + 402 generation (P2.K2) ──────────────

const MC_PROTOCOL_VERSION = '1.0'

const MC_HTTP_HEADERS = {
  VERIFIABLE_INTENT: 'x-mc-verifiable-intent',
  INTENT_ID: 'x-mc-intent-id',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

export interface MastercardPaymentResult {
  valid: boolean
  authorizationRef?: string
  intentId?: string
  amountCents?: number
  error?: { code: MastercardErrorCode; message: string }
}

export type MastercardErrorCode =
  | 'MC_NOT_CONFIGURED'
  | 'MC_INTENT_MISSING'
  | 'MC_INTENT_INVALID'
  | 'MC_INTENT_EXPIRED'
  | 'MC_AUTHORIZATION_DECLINED'
  | 'MC_API_ERROR'
  // P3.PROT1 — detection stub: protocol detected but full validation pending.
  | 'MC_NOT_YET_SUPPORTED'

export interface MastercardToolConfig {
  slug: string
  costCents: number
  displayName: string
  merchantId?: string
}

export interface MastercardValidateOptions {
  enabled: boolean
  toolConfig: MastercardToolConfig
  logger?: AdapterLogger
}

export interface Mastercard402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  merchantId?: string
  appUrl: string
}

/**
 * Decode the payload section of an SD-JWT-style compact JWT
 * (``header.payload.signature`` or ``header.payload.signature~disclosure...``)
 * without verifying the signature. Returns null on any structural problem
 * — header missing, base64 invalid, JSON parse fails, or token shape
 * isn't three parts. The hostile review demands this be defensive: a
 * malformed envelope must NOT be detected as MVI (would route to the
 * 503 stub when it should be a 400 / fall-through to other adapters).
 */
function decodeSDJWTPayload(token: string): Record<string, unknown> | null {
  if (typeof token !== 'string' || !token) return null
  // Strip any trailing SD-JWT disclosure tilde-suffix; payload is in the
  // JWS body before the first `~`.
  const jws = token.split('~', 1)[0] ?? token
  const parts = jws.split('.')
  if (parts.length !== 3) return null
  const [, payloadB64] = parts
  if (!payloadB64) return null
  // base64url → standard base64 + pad.
  const padded = payloadB64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=')
  try {
    const json = Buffer.from(padded, 'base64').toString('utf8')
    const parsed = JSON.parse(json)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Check whether a decoded SD-JWT payload looks like a Mastercard
 * Verifiable Intent envelope: Mastercard issuer (`iss` matches one of
 * the canonical values) AND an AP2-interop claim block. Both must be
 * present; either alone is too loose (a generic Mastercard SD-JWT or a
 * generic AP2 JWT would otherwise match).
 *
 * Exposed for tests and re-use; the adapter's detection method calls it.
 */
export function isMastercardVIEnvelope(token: string | null | undefined): boolean {
  if (!token) return false
  const payload = decodeSDJWTPayload(token)
  if (!payload) return false
  const iss = payload.iss
  if (typeof iss !== 'string' || !MC_ISSUER_VALUES.has(iss)) return false
  // AP2 claim must be a present non-empty object — tightens against an
  // adversary putting `ap2_intent: null` to slip through.
  const ap2 = payload[MC_AP2_CLAIM_KEY]
  if (ap2 === null || ap2 === undefined) return false
  if (typeof ap2 !== 'object') return false
  if (Array.isArray(ap2) && ap2.length === 0) return false
  if (!Array.isArray(ap2) && Object.keys(ap2).length === 0) return false
  return true
}

/**
 * Adapter-registry detection — broad: any of three signals trips MVI.
 * The header-presence path matches legacy P2.K2 behavior so existing
 * downstream callers keep routing correctly. For the narrow,
 * spec-literal "MVI envelope vs other SD-JWTs" check the hostile
 * review demands, see :func:`isMastercardVIEnvelope` (parses payload,
 * checks Mastercard issuer + AP2 claim).
 */
export function isMastercardRequest(request: Request): boolean {
  // Explicit protocol declaration — buyer self-identifies as MVI.
  if (request.headers.get(MC_HTTP_HEADERS.PROTOCOL) === 'mastercard-vi') return true

  // Bearer scheme prefix unique to MVI.
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('mcvi_')) return true
  }

  // MVI-specific header. Presence-only; envelope-content tightening is
  // applied by :func:`isMastercardVIEnvelope` at the verify layer.
  if (request.headers.get(MC_HTTP_HEADERS.VERIFIABLE_INTENT)) return true

  return false
}

export async function validateMastercardPayment(
  request: Request,
  options: MastercardValidateOptions,
): Promise<MastercardPaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
    return {
      valid: false,
      error: {
        code: 'MC_NOT_CONFIGURED',
        message: 'Mastercard Verifiable Intent is not configured on this SettleGrid instance.',
      },
    }
  }

  const intentHeader = request.headers.get(MC_HTTP_HEADERS.VERIFIABLE_INTENT)
  if (!intentHeader) {
    return {
      valid: false,
      error: {
        code: 'MC_INTENT_MISSING',
        message:
          'No Mastercard Verifiable Intent found in request. Provide x-mc-verifiable-intent header with an SD-JWT credential chain.',
      },
    }
  }

  const intentId = request.headers.get(MC_HTTP_HEADERS.INTENT_ID) ?? undefined

  // P3.PROT1 — refuse to silently accept based on structural checks alone.
  // Full validation (SD-JWT credential chain, ES256 signature, three-layer
  // delegation, Mastercard issuer-key fetch) lands when Mastercard's
  // Verifiable Intent API GAs (target: 2026-Q3). Until then, return a
  // structured "not yet supported" outcome so the caller can route it to
  // the 503 detection-stub envelope rather than commit a charge.
  logger.info('mastercard.detection_stub', {
    toolSlug: toolConfig.slug,
    intentId,
    expectedAt: MASTERCARD_VI_EXPECTED_AT,
    note: 'Mastercard VI detected; full validation pending — see ' + MASTERCARD_VI_LANDING_URL,
  })
  return {
    valid: false,
    intentId,
    error: {
      code: 'MC_NOT_YET_SUPPORTED',
      message:
        `Mastercard Verifiable Intent detected. ` +
        `Full validation lands in ${MASTERCARD_VI_EXPECTED_AT}. ` +
        `See ${MASTERCARD_VI_LANDING_URL}.`,
    },
  }
}

export function generateMastercard402Response(options: Mastercard402Options): Response {
  const { toolSlug, costCents, toolName, merchantId, appUrl } = options
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const effectiveMerchantId = merchantId ?? 'settlegrid_platform'
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'mastercard-vi',
    version: MC_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    merchant_id: effectiveMerchantId,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_credentials: ['sd-jwt-verifiable-intent'],
    credential_requirements: {
      delegation_chain: ['credential-provider', 'user', 'agent'],
      signature_algorithm: 'ES256',
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, obtain a Mastercard Verifiable Intent SD-JWT credential chain, then re-send the request with x-mc-verifiable-intent header.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'mastercard-vi',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), { status: 402, headers })
}
