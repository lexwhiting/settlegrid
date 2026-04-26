/**
 * P3.PROT1 — Mastercard Verifiable Intent detection-stub tests.
 *
 * Hostile-review focus per spec:
 *   (a) detection actually distinguishes MVI envelopes from other SD-JWTs;
 *   (b) verifyPayment cannot be called without throwing;
 *   (c) the 503 stub response carries the spec-literal envelope shape +
 *       links to the public landing page.
 */

import { describe, it, expect } from 'vitest'

import {
  MASTERCARD_VI_EXPECTED_AT,
  MASTERCARD_VI_LANDING_URL,
  MastercardVIAdapter,
  generateMastercard402Response,
  isMastercardRequest,
  isMastercardVIEnvelope,
  validateMastercardPayment,
} from '../mastercard-vi'
import type { MastercardToolConfig } from '../mastercard-vi'
import { ProtocolNotYetSupportedError } from '../../errors'

// ─── helpers ───────────────────────────────────────────────────────────────

function b64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/**
 * Construct a structurally-valid MVI SD-JWT envelope with the given
 * payload. Signature segment is a placeholder ("sig") because the
 * detection path explicitly does NOT verify signatures (that's the
 * Q3 2026 GA work). Tilde-suffix simulates SD-JWT disclosures.
 */
function makeSDJWT(payload: Record<string, unknown>, withDisclosures = false): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'sd-jwt' }))
  const body = b64url(JSON.stringify(payload))
  const sig = b64url('sig')
  const base = `${header}.${body}.${sig}`
  return withDisclosures ? `${base}~${b64url('disclosure-1')}~${b64url('disclosure-2')}` : base
}

const validMVIEnvelope = makeSDJWT({
  iss: 'did:mastercard:vi',
  sub: 'agent-123',
  ap2_intent: { agent_id: 'a1', merchant: 'm1', amount: 1000 },
  exp: 9999999999,
})

// ─── 1. detect distinguishes MVI from other SD-JWTs ───────────────────────

describe('isMastercardVIEnvelope (narrow content check)', () => {
  it('accepts a real MVI envelope: Mastercard issuer + AP2 claim', () => {
    expect(isMastercardVIEnvelope(validMVIEnvelope)).toBe(true)
  })

  it('accepts the alternate canonical issuer URL', () => {
    const env = makeSDJWT({
      iss: 'https://api.mastercard.com/verifiable-intent',
      ap2_intent: { agent_id: 'a1' },
    })
    expect(isMastercardVIEnvelope(env)).toBe(true)
  })

  it('accepts envelopes with SD-JWT disclosure suffixes', () => {
    const env = makeSDJWT(
      {
        iss: 'did:mastercard:vi',
        ap2_intent: { agent_id: 'a1' },
      },
      /* withDisclosures */ true,
    )
    expect(isMastercardVIEnvelope(env)).toBe(true)
  })

  it('REJECTS a generic OIDC ID token (no Mastercard issuer)', () => {
    const env = makeSDJWT({
      iss: 'https://accounts.google.com',
      sub: 'user-1',
      ap2_intent: { agent_id: 'a1' },
    })
    expect(isMastercardVIEnvelope(env)).toBe(false)
  })

  it('REJECTS a Mastercard SD-JWT WITHOUT the AP2 claim', () => {
    // E.g. a legacy Mastercard card-on-file token — same issuer, no
    // AP2 interop claim. Detection must not treat this as MVI.
    const env = makeSDJWT({
      iss: 'did:mastercard:vi',
      sub: 'card-token-1',
    })
    expect(isMastercardVIEnvelope(env)).toBe(false)
  })

  it('REJECTS an envelope with empty / null AP2 claim', () => {
    expect(
      isMastercardVIEnvelope(makeSDJWT({ iss: 'did:mastercard:vi', ap2_intent: null })),
    ).toBe(false)
    expect(
      isMastercardVIEnvelope(makeSDJWT({ iss: 'did:mastercard:vi', ap2_intent: {} })),
    ).toBe(false)
    expect(
      isMastercardVIEnvelope(makeSDJWT({ iss: 'did:mastercard:vi', ap2_intent: [] })),
    ).toBe(false)
  })

  it('REJECTS malformed input gracefully (no throw)', () => {
    expect(isMastercardVIEnvelope(null)).toBe(false)
    expect(isMastercardVIEnvelope(undefined)).toBe(false)
    expect(isMastercardVIEnvelope('')).toBe(false)
    expect(isMastercardVIEnvelope('not.a.jwt')).toBe(false)
    expect(isMastercardVIEnvelope('only-one-segment')).toBe(false)
    expect(isMastercardVIEnvelope('a.b')).toBe(false) // 2 parts
    expect(isMastercardVIEnvelope('a.bad-base64$$$.c')).toBe(false)
  })

  it('REJECTS a JWT whose payload is not a JSON object', () => {
    const sigOnlyArray = `${b64url('{}')}.${b64url('["array",1]')}.${b64url('sig')}`
    expect(isMastercardVIEnvelope(sigOnlyArray)).toBe(false)
    const sigOnlyString = `${b64url('{}')}.${b64url('"plain-string"')}.${b64url('sig')}`
    expect(isMastercardVIEnvelope(sigOnlyString)).toBe(false)
  })
})

describe('isMastercardRequest (adapter-registry detection)', () => {
  it('detects via x-settlegrid-protocol header', () => {
    const req = new Request('http://localhost/t', {
      headers: { 'x-settlegrid-protocol': 'mastercard-vi' },
    })
    expect(isMastercardRequest(req)).toBe(true)
  })

  it('detects via mcvi_ Bearer prefix', () => {
    const req = new Request('http://localhost/t', {
      headers: { authorization: 'Bearer mcvi_abc123' },
    })
    expect(isMastercardRequest(req)).toBe(true)
  })

  it('detects via x-mc-verifiable-intent presence (legacy compat)', () => {
    const req = new Request('http://localhost/t', {
      headers: { 'x-mc-verifiable-intent': validMVIEnvelope },
    })
    expect(isMastercardRequest(req)).toBe(true)
  })

  it('does NOT detect a vanilla Bearer JWT with no Mastercard signal', () => {
    const req = new Request('http://localhost/t', {
      headers: { authorization: 'Bearer eyJhbGciOiJSUzI1NiJ9.body.sig' },
    })
    expect(isMastercardRequest(req)).toBe(false)
  })
})

// ─── 2. verifyPayment cannot be called without throwing ────────────────────

describe('MastercardVIAdapter.verifyPayment / verify — fail-fast contract', () => {
  it('verifyPayment throws ProtocolNotYetSupportedError', async () => {
    const adapter = new MastercardVIAdapter()
    const req = new Request('http://localhost/t', {
      headers: { 'x-mc-verifiable-intent': validMVIEnvelope },
    })
    await expect(adapter.verifyPayment(req)).rejects.toBeInstanceOf(
      ProtocolNotYetSupportedError,
    )
  })

  it('verifyPayment error carries the spec-literal envelope fields', async () => {
    const adapter = new MastercardVIAdapter()
    const req = new Request('http://localhost/t')
    try {
      await adapter.verifyPayment(req)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ProtocolNotYetSupportedError)
      const psErr = err as ProtocolNotYetSupportedError
      expect(psErr.protocol).toBe('mastercard-vi')
      expect(psErr.expectedAt).toBe('2026-Q3')
      expect(psErr.statusCode).toBe(503)
      expect(psErr.code).toBe('PROTOCOL_NOT_YET_SUPPORTED')
      expect(psErr.landingUrl).toBe(MASTERCARD_VI_LANDING_URL)
    }
  })

  it('verify with enabled=true also throws (no structural-acceptance path)', async () => {
    const adapter = new MastercardVIAdapter()
    const req = new Request('http://localhost/t', {
      headers: { 'x-mc-verifiable-intent': validMVIEnvelope },
    })
    await expect(
      adapter.verify(req, {
        enabled: true,
        toolConfig: { slug: 't', costCents: 10, displayName: 'T' },
      }),
    ).rejects.toBeInstanceOf(ProtocolNotYetSupportedError)
  })

  it('verify with enabled=false still returns MC_NOT_CONFIGURED (gating preserved)', async () => {
    // The detection-stub path is for ENABLED-but-not-yet-validated.
    // When the adapter is gated off entirely (enabled=false), surface
    // the legacy not-configured signal so the kernel can fall through.
    const adapter = new MastercardVIAdapter()
    const req = new Request('http://localhost/t')
    const res = await adapter.verify(req, {
      enabled: false,
      toolConfig: { slug: 't', costCents: 10, displayName: 'T' },
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('MC_NOT_CONFIGURED')
  })

  it('settle() ALSO throws (defense-in-depth — never reachable from verify path, but exposed for direct callers)', async () => {
    const adapter = new MastercardVIAdapter()
    await expect(adapter.settle({ any: 'shape' })).rejects.toBeInstanceOf(
      ProtocolNotYetSupportedError,
    )
  })
})

// ─── 3. 503 stub response shape + landing-page link ────────────────────────

describe('MastercardVIAdapter.buildChallenge / buildDetectionStubResponse', () => {
  it('returns 503 with the spec-literal envelope shape (buildChallenge no-arg form)', async () => {
    // P3.PROT1 spec literal: ``buildChallenge(meterCtx) — returns a
    // 503 with body { status: 'protocol_detected', ... }``. The no-arg
    // overload IS the spec-literal P3.PROT1 form (the with-options
    // overload returns AcceptEntry for the multi-protocol manifest
    // builder; tested separately below).
    const adapter = new MastercardVIAdapter()
    const res = adapter.buildChallenge()
    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(503)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('mastercard-vi')
    const body = await res.json()
    expect(body).toEqual({
      status: 'protocol_detected',
      protocol: 'mastercard-vi',
      message: expect.stringContaining(MASTERCARD_VI_LANDING_URL),
      expected_at: '2026-Q3',
    })
    expect(body.message).toContain(MASTERCARD_VI_EXPECTED_AT)
  })

  it('buildChallenge with options returns AcceptEntry (preserves multi-protocol manifest contract)', () => {
    const adapter = new MastercardVIAdapter()
    const entry = adapter.buildChallenge({
      resource: { url: 'http://localhost/t' },
      pricing: { defaultCostCents: 7 },
      method: 'default',
    })
    // Not a Response — the overload returns AcceptEntry data.
    expect(entry).not.toBeInstanceOf(Response)
    expect(entry.scheme).toBe('mastercard-vi')
    expect(entry.provider).toBe('mastercard')
    expect(entry.costCents).toBe(7)
    expect(entry.currency).toBe('USD')
    expect(entry.acceptedCredentials).toContain('sd-jwt-verifiable-intent')
  })

  it('buildDetectionStubResponse alias agrees with buildChallenge() no-arg form', async () => {
    const adapter = new MastercardVIAdapter()
    const a = await adapter.buildChallenge().json()
    const b = await adapter.buildDetectionStubResponse().json()
    expect(a).toEqual(b)
  })

  it('formatError routes ProtocolNotYetSupportedError through the 503 envelope', async () => {
    const adapter = new MastercardVIAdapter()
    const err = new ProtocolNotYetSupportedError({
      protocol: 'mastercard-vi',
      expectedAt: MASTERCARD_VI_EXPECTED_AT,
      landingUrl: MASTERCARD_VI_LANDING_URL,
    })
    const res = adapter.formatError(err, new Request('http://localhost/t'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('protocol_detected')
    expect(body.protocol).toBe('mastercard-vi')
    expect(body.expected_at).toBe(MASTERCARD_VI_EXPECTED_AT)
  })

  it('regression (formatError ordering): ProtocolNotYetSupportedError must be checked BEFORE string-match on "intent"', async () => {
    // Hostile-review pin: the message the MVI adapter actually surfaces
    // for the detection-stub error — produced by
    // ``MastercardVIAdapter._detectionStubError()`` and thrown from
    // ``verify()`` / ``verifyPayment()`` — contains the substring
    // "Verifiable Intent". The ``formatError`` method's generic-error
    // classifier looks for ``error.message.includes('intent')`` to
    // route to a 401 ``MC_VI_INVALID_INTENT``. Today the
    // ``instanceof ProtocolNotYetSupportedError`` check runs FIRST and
    // short-circuits to the 503 envelope; if a future refactor swaps
    // those checks, a real MVI detection-stub error would be
    // misclassified as a 401. This test pins the contract by feeding
    // the EXACT error a real verify() throws and asserting 503.
    const adapter = new MastercardVIAdapter()
    let realErr: Error | undefined
    try {
      await adapter.verifyPayment(new Request('http://localhost/t'))
    } catch (e) {
      realErr = e as Error
    }
    expect(realErr).toBeInstanceOf(ProtocolNotYetSupportedError)
    // Sanity: the live error message DOES contain the trap substring
    // — i.e. the regression risk this test pins is real.
    expect(realErr!.message.toLowerCase()).toContain('intent')
    const res = adapter.formatError(realErr!, new Request('http://localhost/t'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe('protocol_detected')
    // And NOT the 401 invalid-intent error shape:
    expect(body.error).toBeUndefined()
    expect(body.code).toBeUndefined()
  })

  it('regression (toJSON round-trip): error.toJSON() matches the 503 response body shape', async () => {
    // Hostile-review pin: ProtocolNotYetSupportedError.toJSON() and the
    // 503 body emitted by buildChallenge() must round-trip identically.
    // Drift between the two would mean a caller that serializes the
    // error directly (for logging or re-throw) sees a different envelope
    // than the one a buyer's client sees on the wire.
    const adapter = new MastercardVIAdapter()
    const err = new ProtocolNotYetSupportedError({
      protocol: 'mastercard-vi',
      expectedAt: MASTERCARD_VI_EXPECTED_AT,
      landingUrl: MASTERCARD_VI_LANDING_URL,
      message:
        `Mastercard Verifiable Intent detected. ` +
        `Full validation lands in ${MASTERCARD_VI_EXPECTED_AT}. ` +
        `See ${MASTERCARD_VI_LANDING_URL}.`,
    })
    const wireBody = await adapter.buildChallenge().json()
    expect(err.toJSON()).toEqual(wireBody)
    // And the toJSON shape is exactly the spec literal four fields:
    expect(Object.keys(err.toJSON()).sort()).toEqual(
      ['expected_at', 'message', 'protocol', 'status'].sort(),
    )
  })

  it('Retry-After header is set (clients can back off until rollout)', () => {
    const adapter = new MastercardVIAdapter()
    const res = adapter.buildDetectionStubResponse()
    const retryAfter = res.headers.get('Retry-After')
    expect(retryAfter).toBeTruthy()
    expect(Number(retryAfter)).toBeGreaterThan(0)
  })

  it('Cache-Control: no-store (the rollout date is dynamic — never cache)', () => {
    const adapter = new MastercardVIAdapter()
    const res = adapter.buildDetectionStubResponse()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('landing URL points to the in-app /protocols/mastercard-vi page', () => {
    expect(MASTERCARD_VI_LANDING_URL).toMatch(/\/protocols\/mastercard-vi$/)
  })
})

// ─── 4. registry registration ─────────────────────────────────────────────

describe('MastercardVIAdapter — registry plumbing', () => {
  it('exposes name and displayName per ProtocolAdapter contract', () => {
    const adapter = new MastercardVIAdapter()
    expect(adapter.name).toBe('mastercard-vi')
    expect(adapter.displayName).toBe('Mastercard Verifiable Intent')
  })

  it('canHandle delegates to isMastercardRequest', () => {
    const adapter = new MastercardVIAdapter()
    const ok = new Request('http://localhost/t', {
      headers: { 'x-settlegrid-protocol': 'mastercard-vi' },
    })
    const noMatch = new Request('http://localhost/t')
    expect(adapter.canHandle(ok)).toBe(true)
    expect(adapter.canHandle(noMatch)).toBe(false)
  })

  it('detect() spec-literal alias agrees with canHandle()', () => {
    const adapter = new MastercardVIAdapter()
    const ok = new Request('http://localhost/t', {
      headers: { 'x-settlegrid-protocol': 'mastercard-vi' },
    })
    const noMatch = new Request('http://localhost/t')
    expect(adapter.detect(ok)).toBe(adapter.canHandle(ok))
    expect(adapter.detect(noMatch)).toBe(adapter.canHandle(noMatch))
    expect(adapter.detect(ok)).toBe(true)
    expect(adapter.detect(noMatch)).toBe(false)
  })
})

// ─── 5. validateMastercardPayment direct (P3.PROT1 verify-layer return shape)─

describe('validateMastercardPayment (direct) — P3.PROT1 detection-stub return', () => {
  const toolConfig: MastercardToolConfig = {
    slug: 'tool-x',
    costCents: 12,
    displayName: 'Tool X',
  }

  it('disabled — returns MC_NOT_CONFIGURED', async () => {
    const res = await validateMastercardPayment(new Request('http://localhost/t'), {
      enabled: false,
      toolConfig,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('MC_NOT_CONFIGURED')
    expect(res.error?.message).toMatch(/not configured/i)
  })

  it('enabled + missing intent header — returns MC_INTENT_MISSING', async () => {
    const res = await validateMastercardPayment(new Request('http://localhost/t'), {
      enabled: true,
      toolConfig,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('MC_INTENT_MISSING')
    expect(res.error?.message).toMatch(/x-mc-verifiable-intent/i)
  })

  it('enabled + intent header present — returns MC_NOT_YET_SUPPORTED with intentId echo', async () => {
    // Spec-literal: P3.PROT1's verify layer must surface the structured
    // detection-stub outcome (NOT silently accept based on header
    // presence) so the proxy can route it to a 503. Direct test —
    // verify() in the adapter calls into this path indirectly, but the
    // verify-layer contract is exercised independently here so a future
    // refactor that bypasses ``validateMastercardPayment`` would still
    // have a regression signal.
    const req = new Request('http://localhost/t', {
      headers: {
        'x-mc-verifiable-intent': validMVIEnvelope,
        'x-mc-intent-id': 'intent-abc-123',
      },
    })
    const res = await validateMastercardPayment(req, {
      enabled: true,
      toolConfig,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('MC_NOT_YET_SUPPORTED')
    expect(res.intentId).toBe('intent-abc-123')
    expect(res.error?.message).toContain(MASTERCARD_VI_LANDING_URL)
    expect(res.error?.message).toContain(MASTERCARD_VI_EXPECTED_AT)
  })

  it('enabled + intent header present + intentId absent — works without intentId', async () => {
    // The intentId header is optional. validateMastercardPayment must
    // still surface MC_NOT_YET_SUPPORTED even when it's not provided.
    const req = new Request('http://localhost/t', {
      headers: { 'x-mc-verifiable-intent': validMVIEnvelope },
    })
    const res = await validateMastercardPayment(req, {
      enabled: true,
      toolConfig,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('MC_NOT_YET_SUPPORTED')
    expect(res.intentId).toBeUndefined()
  })

  it('enabled + intent header present — fires structured logger.info instrumentation', async () => {
    // Hostile-review pin: the detection-stub flow surfaces a
    // ``mastercard.detection_stub`` log line so operators can
    // monitor MVI-detection volume during the 2026-Q3 rollout
    // runway. Drift would mean the rollout dashboard goes dark.
    const calls: Array<[string, Record<string, unknown> | undefined]> = []
    const fakeLogger = {
      info: (event: string, data?: Record<string, unknown>) => {
        calls.push([event, data])
      },
      warn: () => {},
      error: () => {},
    }
    const req = new Request('http://localhost/t', {
      headers: {
        'x-mc-verifiable-intent': validMVIEnvelope,
        'x-mc-intent-id': 'intent-log-1',
      },
    })
    await validateMastercardPayment(req, {
      enabled: true,
      toolConfig,
      logger: fakeLogger,
    })
    expect(calls).toHaveLength(1)
    const [event, data] = calls[0]
    expect(event).toBe('mastercard.detection_stub')
    expect(data).toMatchObject({
      toolSlug: toolConfig.slug,
      intentId: 'intent-log-1',
      expectedAt: MASTERCARD_VI_EXPECTED_AT,
    })
    // The note must point to the public landing page so an operator
    // tailing the log can click straight to the rollout doc.
    expect(String((data ?? {}).note ?? '')).toContain(MASTERCARD_VI_LANDING_URL)
  })

  it('disabled path does NOT fire the detection-stub log', async () => {
    // Symmetric pin to the previous test — when the rail is gated off
    // (no API key in the legacy P2.K2 flow), the verify layer takes
    // the early ``MC_NOT_CONFIGURED`` exit without instrumenting,
    // so dashboards aren't polluted with empty-deployment noise.
    const calls: string[] = []
    const fakeLogger = {
      info: (event: string) => calls.push(event),
      warn: () => {},
      error: () => {},
    }
    await validateMastercardPayment(new Request('http://localhost/t'), {
      enabled: false,
      toolConfig,
      logger: fakeLogger,
    })
    expect(calls).toEqual([])
  })
})

// ─── 6. extractPaymentContext — body parsing + header reading ─────────────

describe('MastercardVIAdapter.extractPaymentContext', () => {
  it('extracts intentHeader, method, service, intentId from JSON body + headers', async () => {
    const adapter = new MastercardVIAdapter()
    const req = new Request('http://localhost/t', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mc-verifiable-intent': validMVIEnvelope,
        'x-request-id': 'req-abc-1',
      },
      body: JSON.stringify({ method: 'execute', service: 'demo-svc', intentId: 'i-1' }),
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.protocol).toBe('mastercard-vi')
    expect(ctx.identity.type).toBe('sd-jwt')
    expect(ctx.identity.value).toBe(validMVIEnvelope)
    expect(ctx.identity.metadata).toEqual({ intentId: 'i-1' })
    expect(ctx.operation.service).toBe('demo-svc')
    expect(ctx.operation.method).toBe('execute')
    expect(ctx.payment.type).toBe('agentic-token')
    expect(ctx.payment.proof).toBe(validMVIEnvelope)
    expect(ctx.requestId).toBe('req-abc-1')
  })

  it('falls back to defaults when body is not JSON or fields are missing', async () => {
    const adapter = new MastercardVIAdapter()
    const req = new Request('http://localhost/t', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not-json-at-all',
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.operation.method).toBe('payment')
    expect(ctx.operation.service).toBe('mastercard-agent-pay')
    expect(ctx.identity.value).toBe('unknown')
    expect(ctx.payment.proof).toBeUndefined()
    // No x-request-id header — adapter mints a UUID to keep tracing live.
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/i)
  })
})

// ─── 7. formatResponse + formatError fallback paths ───────────────────────

describe('MastercardVIAdapter.formatResponse', () => {
  it('emits success envelope with operationId, costCents, and SettleGrid headers', async () => {
    const adapter = new MastercardVIAdapter()
    const res = adapter.formatResponse(
      {
        operationId: 'op-1',
        status: 'settled',
        costCents: 25,
        receipt: 'signed-receipt-token',
        metadata: {
          protocol: 'mastercard-vi',
          latencyMs: 42,
          settlementType: 'real-time',
        },
      },
      new Request('http://localhost/t'),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('X-SettleGrid-Operation-Id')).toBe('op-1')
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('mastercard-vi')
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.verified).toBe(true)
    expect(body.operationId).toBe('op-1')
    expect(body.intentId).toBe('op-1')
    expect(body.costCents).toBe(25)
    expect(body.receipt).toBe('signed-receipt-token')
    expect(body.metadata.latencyMs).toBe(42)
    expect(body.metadata.settlementType).toBe('real-time')
  })
})

describe('MastercardVIAdapter.formatError — non-MVI fallback paths', () => {
  // These pin the pre-P3.PROT1 fallback classifier ordering. The
  // ``ProtocolNotYetSupportedError`` short-circuit is tested above
  // (regression: formatError ordering); these tests cover the
  // string-matching classifier that runs after.

  function adapterAndReq() {
    return [new MastercardVIAdapter(), new Request('http://localhost/t')] as const
  }

  it('intent-keyword error → 401 / MC_VI_INVALID_INTENT', async () => {
    const [adapter, req] = adapterAndReq()
    const res = adapter.formatError(new Error('credential expired'), req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('MC_VI_INVALID_INTENT')
  })

  it('payment-keyword error → 402 / MC_VI_PAYMENT_ERROR', async () => {
    const [adapter, req] = adapterAndReq()
    const res = adapter.formatError(new Error('payment declined'), req)
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error.code).toBe('MC_VI_PAYMENT_ERROR')
  })

  it('insufficient-keyword error → 402 / MC_VI_PAYMENT_ERROR', async () => {
    const [adapter, req] = adapterAndReq()
    const res = adapter.formatError(new Error('insufficient funds'), req)
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error.code).toBe('MC_VI_PAYMENT_ERROR')
  })

  it('unrecognized error → 500 / MC_VI_SERVER_ERROR', async () => {
    const [adapter, req] = adapterAndReq()
    const res = adapter.formatError(new Error('some database hiccup'), req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('MC_VI_SERVER_ERROR')
    // The fallback envelope echoes the request-id (when present); when
    // absent it round-trips as null.
    expect(body.error.requestId).toBeNull()
  })

  it('round-trips x-request-id header into the error envelope', async () => {
    const adapter = new MastercardVIAdapter()
    const req = new Request('http://localhost/t', {
      headers: { 'x-request-id': 'req-trace-9' },
    })
    const res = adapter.formatError(new Error('boom'), req)
    const body = await res.json()
    expect(body.error.requestId).toBe('req-trace-9')
    // And ISO-8601 timestamp is present so log correlation works.
    expect(body.error.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})

// ─── 8. generateMastercard402Response — 402 manifest contract ─────────────

describe('generateMastercard402Response (P2.K2 manifest)', () => {
  it('emits the 402 challenge with full delegation requirements', async () => {
    const res = generateMastercard402Response({
      toolSlug: 'tool-x',
      costCents: 17,
      toolName: 'Tool X Name',
      appUrl: 'https://app.example.com',
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('mastercard-vi')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body.error).toBe('payment_required')
    expect(body.protocol).toBe('mastercard-vi')
    expect(body.amount_cents).toBe(17)
    expect(body.currency).toBe('usd')
    expect(body.tool).toBe('tool-x')
    expect(body.payment_endpoint).toBe('https://app.example.com/api/proxy/tool-x')
    expect(body.directory_url).toBe('https://app.example.com/api/v1/discover')
    expect(body.merchant_id).toBe('settlegrid_platform')
    expect(body.description).toContain('Tool X Name')
    expect(body.accepted_credentials).toEqual(['sd-jwt-verifiable-intent'])
    expect(body.credential_requirements.delegation_chain).toEqual([
      'credential-provider',
      'user',
      'agent',
    ])
    expect(body.credential_requirements.signature_algorithm).toBe('ES256')
  })

  it('falls back to toolSlug as description when toolName is omitted', async () => {
    const res = generateMastercard402Response({
      toolSlug: 'just-slug',
      costCents: 1,
      appUrl: 'https://app.example.com',
    })
    const body = await res.json()
    expect(body.description).toContain('just-slug')
  })

  it('honors a custom merchantId override', async () => {
    const res = generateMastercard402Response({
      toolSlug: 'tool-x',
      costCents: 10,
      merchantId: 'merchant_custom',
      appUrl: 'https://app.example.com',
    })
    const body = await res.json()
    expect(body.merchant_id).toBe('merchant_custom')
  })
})

// ─── 9. build402Response wrapper on the adapter ───────────────────────────

describe('MastercardVIAdapter.build402Response (delegating wrapper)', () => {
  it('delegates to generateMastercard402Response with same shape', async () => {
    const adapter = new MastercardVIAdapter()
    const a = await adapter
      .build402Response({
        toolSlug: 's',
        costCents: 9,
        appUrl: 'https://app.example.com',
      })
      .json()
    const b = await generateMastercard402Response({
      toolSlug: 's',
      costCents: 9,
      appUrl: 'https://app.example.com',
    }).json()
    expect(a).toEqual(b)
  })
})

// ─── 10. edge-case branches (push branch coverage) ────────────────────────

describe('edge-case branches', () => {
  it('formatResponse: receipt absent → body.receipt is null (default branch)', async () => {
    const adapter = new MastercardVIAdapter()
    const res = adapter.formatResponse(
      {
        operationId: 'op-2',
        status: 'settled',
        costCents: 0,
        // receipt intentionally undefined
        metadata: {
          protocol: 'mastercard-vi',
          latencyMs: 0,
          settlementType: 'real-time',
        },
      },
      new Request('http://localhost/t'),
    )
    const body = await res.json()
    expect(body.receipt).toBeNull()
  })

  it("buildChallenge(options): omitted method falls back to 'default'", () => {
    // Hits the ``options.method ?? 'default'`` branch where `method`
    // is undefined.
    const adapter = new MastercardVIAdapter()
    const entry = adapter.buildChallenge({
      resource: { url: 'http://localhost/t' },
      pricing: { defaultCostCents: 5 },
    })
    expect(entry).not.toBeInstanceOf(Response)
    expect(entry.costCents).toBe(5)
  })

  it('buildChallenge(options): non-finite or negative cost clamps to 0', () => {
    // The cost guard ``Number.isFinite(rawCost) && rawCost >= 0 ?
    // Math.floor(rawCost) : 0`` exists so a mis-configured pricing
    // fixture (NaN, Infinity, negative number) doesn't surface a
    // surprising value to the buyer's 402 manifest.
    const adapter = new MastercardVIAdapter()
    const entry = adapter.buildChallenge({
      resource: { url: 'http://localhost/t' },
      pricing: { defaultCostCents: Number.NaN },
    })
    expect(entry).not.toBeInstanceOf(Response)
    expect(entry.costCents).toBe(0)

    const negative = adapter.buildChallenge({
      resource: { url: 'http://localhost/t' },
      pricing: { defaultCostCents: -1 },
    })
    expect(negative).not.toBeInstanceOf(Response)
    expect(negative.costCents).toBe(0)
  })

  it('isMastercardVIEnvelope: rejects 3-part token with empty payload section', () => {
    // Hits the ``if (!payloadB64) return null`` branch in
    // decodeSDJWTPayload — token has three dot-separated parts but
    // the middle one is empty.
    const headerOnly = `${b64url('{}')}..${b64url('sig')}`
    expect(isMastercardVIEnvelope(headerOnly)).toBe(false)
  })

  it('isMastercardVIEnvelope: rejects truthy non-string input (defensive cast)', () => {
    // Public signature is ``string | null | undefined`` so TypeScript
    // never lets a non-string reach this function — but the
    // module-internal ``decodeSDJWTPayload`` has a defensive
    // ``typeof token !== 'string'`` guard. Coverage demands we exercise
    // the branch; a truthy non-string (number, plain object) bypasses
    // ``if (!token)`` and lands on the typeof guard. Future-proof
    // against an upstream caller that loses the string type via
    // ``unknown``.
    expect(isMastercardVIEnvelope(123 as unknown as string)).toBe(false)
    expect(isMastercardVIEnvelope({} as unknown as string)).toBe(false)
  })

  it('isMastercardVIEnvelope: rejects ap2_intent of non-object type (string / number)', () => {
    // Hits the ``typeof ap2 !== 'object'`` branch — adversary tries
    // to pass a primitive value for the AP2 claim.
    expect(
      isMastercardVIEnvelope(
        makeSDJWT({ iss: 'did:mastercard:vi', ap2_intent: 'agent-1' }),
      ),
    ).toBe(false)
    expect(
      isMastercardVIEnvelope(
        makeSDJWT({ iss: 'did:mastercard:vi', ap2_intent: 42 }),
      ),
    ).toBe(false)
    expect(
      isMastercardVIEnvelope(
        makeSDJWT({ iss: 'did:mastercard:vi', ap2_intent: true }),
      ),
    ).toBe(false)
  })
})
