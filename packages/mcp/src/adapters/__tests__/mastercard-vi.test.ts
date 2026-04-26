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
  isMastercardRequest,
  isMastercardVIEnvelope,
} from '../mastercard-vi'
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
