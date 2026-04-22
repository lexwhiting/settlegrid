/**
 * P3.K1 — unit tests for the spec-aligned MPPAdapter methods
 * (`detect` / `buildChallenge` + `buildMppChallenge` / `verifyPayment`
 * / `settle`).
 *
 * Exercises the four spec-named methods plus the hostile-audit
 * requirements:
 *
 *   - "detect returns a real confidence score, not a constant"
 *   - "verifyPayment actually validates the amount and currency,
 *      not just intent existence"
 *   - "settle is idempotent on the same invocation_id"
 *
 * The spec-diff round (F1-F6) added:
 *   F1 — body-inspection coverage for detect (MPP envelope shape,
 *        Stripe payment intent shape, malformed-JSON resilience)
 *   F2 — buildChallenge(MppChallengeOptions) overload parity with
 *        the existing buildChallenge(BuildChallengeOptions)
 *   F3 — snake_case envelope fields (merchant_id,
 *        payment_intent_client_secret, accepted_tokens,
 *        directory_url, amount, recipient) + lowercase currency
 *   F4 — Stripe test-mode URL/headers/body assertions on the
 *        fetch-mocked happy-path verify + capture round-trips
 *   F5 — MppSettlementEvent shape extends SettleGridInternalEvent
 *        (kind='unknown', railId='stripe-connect', data.subKind)
 *   F6 — malformed envelope graceful fallback
 *
 * Stripe API round-trips are exercised through a stubbed global
 * `fetch`. The stub is installed with `vi.stubGlobal('fetch', ...)`
 * inside individual tests so the baseline state (real global fetch)
 * is preserved between tests.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MPPAdapter,
  type MppLedgerEntry,
  type MppSettleDependencies,
  type MppSettleResult,
  type MppSettlement,
  type MppSettlementEvent,
  type MppToolConfig,
} from '../mpp'

// ─── Small helpers ────────────────────────────────────────────────────────

const TOOL_CONFIG: MppToolConfig = {
  slug: 'my-tool',
  costCents: 500,
  displayName: 'My Tool',
  recipientId: 'acct_merchant_123',
}

function newAdapter(): MPPAdapter {
  return new MPPAdapter()
}

function reqWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/proxy/my-tool', { headers })
}

function reqWithBody(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/proxy/my-tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── detect() — headers ──────────────────────────────────────────────────

describe('MPPAdapter.detect — header signatures', () => {
  it('returns confidence 0 and no reasons for an unrelated request', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({}))
    expect(result.confidence).toBe(0)
    expect(result.reasons).toEqual([])
  })

  it('returns 1.0 for an explicit X-Payment-Protocol: MPP/1.0 header', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({ 'X-Payment-Protocol': 'MPP/1.0' }))
    expect(result.confidence).toBe(1.0)
    expect(result.reasons).toContain('X-Payment-Protocol: MPP/1.0')
  })

  it('returns 1.0 for an explicit x-mpp-version header', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({ 'x-mpp-version': '1.0' }))
    expect(result.confidence).toBe(1.0)
    expect(result.reasons).toContain('x-mpp-version: 1.0')
  })

  it('returns 0.9 for X-Payment-Token: spt_*', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({ 'X-Payment-Token': 'spt_test_abc' }))
    expect(result.confidence).toBeCloseTo(0.9, 10)
    expect(result.reasons[0]).toMatch(/spt_\*/)
  })

  it('returns 0.8 for x-mpp-credential header', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({ 'x-mpp-credential': 'abc123' }))
    expect(result.confidence).toBeCloseTo(0.8, 10)
    expect(result.reasons).toContain('x-mpp-credential')
  })

  it('returns 0.7 for x-settlegrid-protocol: mpp hint', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({ 'x-settlegrid-protocol': 'mpp' }))
    expect(result.confidence).toBeCloseTo(0.7, 10)
    expect(result.reasons).toContain('x-settlegrid-protocol: mpp')
  })

  it('returns 0.6 for Authorization: Bearer spt_*', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({ Authorization: 'Bearer spt_abc' }))
    expect(result.confidence).toBeCloseTo(0.6, 10)
    expect(result.reasons[0]).toMatch(/Bearer spt_\*/)
  })

  it('returns 0 for a non-MPP Bearer token (x402_*)', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithHeaders({ Authorization: 'Bearer x402_xyz' }))
    expect(result.confidence).toBe(0)
    expect(result.reasons).toEqual([])
  })

  it('reports MAX confidence across multiple matched signatures', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(
      reqWithHeaders({
        'x-mpp-version': '1.0',
        Authorization: 'Bearer spt_abc',
      }),
    )
    expect(result.confidence).toBe(1.0)
    expect(result.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('score strictly orders mid-weight vs low-weight signatures', async () => {
    // Hostile-audit (a): detect must return a REAL score, not a
    // constant. Asserting strict ordering across five distinct
    // header weights proves the score is data-dependent.
    const adapter = newAdapter()
    const low = await adapter.detect(reqWithHeaders({ Authorization: 'Bearer spt_abc' }))
    const midHint = await adapter.detect(reqWithHeaders({ 'x-settlegrid-protocol': 'mpp' }))
    const midCred = await adapter.detect(reqWithHeaders({ 'x-mpp-credential': 'x' }))
    const highTok = await adapter.detect(reqWithHeaders({ 'X-Payment-Token': 'spt_x' }))
    const topVer = await adapter.detect(reqWithHeaders({ 'x-mpp-version': '1.0' }))
    expect(low.confidence).toBeLessThan(midHint.confidence)
    expect(midHint.confidence).toBeLessThan(midCred.confidence)
    expect(midCred.confidence).toBeLessThan(highTok.confidence)
    expect(highTok.confidence).toBeLessThan(topVer.confidence)
  })
})

// ─── detect() — body (F1, F6) ────────────────────────────────────────────

describe('MPPAdapter.detect — body signatures', () => {
  it('adds 0.5 for an MPP envelope body (protocol: "mpp")', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(
      reqWithBody({ protocol: 'mpp', amount: 500, currency: 'usd' }),
    )
    expect(result.confidence).toBeCloseTo(0.5, 10)
    expect(result.reasons).toContain('body: MPP envelope shape')
  })

  it('adds 0.5 for an MPP envelope body (scheme: "mpp")', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(
      reqWithBody({ scheme: 'mpp', provider: 'stripe', amount: 500 }),
    )
    expect(result.confidence).toBeCloseTo(0.5, 10)
    expect(result.reasons).toContain('body: MPP envelope shape')
  })

  it('adds 0.4 for a Stripe payment intent body (pi_* + client_secret)', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(
      reqWithBody({ id: 'pi_3AbCdEf', client_secret: 'pi_3AbCdEf_secret_xyz' }),
    )
    expect(result.confidence).toBeCloseTo(0.4, 10)
    expect(result.reasons).toContain('body: Stripe payment intent shape')
  })

  it('adds 0.4 for a top-level payment_intent_client_secret field', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(
      reqWithBody({ payment_intent_client_secret: 'pi_test_secret_xyz' }),
    )
    expect(result.confidence).toBeCloseTo(0.4, 10)
  })

  it('ignores unrelated JSON bodies (returns 0)', async () => {
    const adapter = newAdapter()
    const result = await adapter.detect(reqWithBody({ foo: 'bar', baz: 42 }))
    expect(result.confidence).toBe(0)
    expect(result.reasons).toEqual([])
  })

  it('F6: gracefully falls back to header-only confidence on malformed JSON body', async () => {
    // Spec step 6 demands a "malformed envelope" test. A broken JSON
    // body paired with a legit MPP header MUST still produce the
    // header-level confidence without throwing. Regressions here
    // would let a malformed body DoS the detection path.
    const adapter = newAdapter()
    const req = new Request('http://localhost/api/proxy/my-tool', {
      method: 'POST',
      headers: {
        'X-Payment-Token': 'spt_test_abc',
        'Content-Type': 'application/json',
      },
      body: 'this is not { valid JSON',
    })
    const result = await adapter.detect(req)
    expect(result.confidence).toBeCloseTo(0.9, 10)
    expect(result.reasons.some((r) => r.startsWith('body:'))).toBe(false)
  })

  it('gracefully handles an empty body', async () => {
    const adapter = newAdapter()
    const req = new Request('http://localhost/api/proxy/my-tool', {
      method: 'POST',
      headers: { 'X-Payment-Token': 'spt_abc' },
    })
    const result = await adapter.detect(req)
    // No body → header signature stands alone.
    expect(result.confidence).toBeCloseTo(0.9, 10)
  })

  it('gracefully handles a non-object JSON body (e.g., a string or array)', async () => {
    const adapter = newAdapter()
    const arrayReq = new Request('http://localhost/api/proxy/my-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['not', 'an', 'object']),
    })
    const stringReq = new Request('http://localhost/api/proxy/my-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('just a string'),
    })
    expect((await adapter.detect(arrayReq)).confidence).toBe(0)
    expect((await adapter.detect(stringReq)).confidence).toBe(0)
  })

  it('header signal always beats body signal (MAX across sources)', async () => {
    const adapter = newAdapter()
    const req = new Request('http://localhost/api/proxy/my-tool', {
      method: 'POST',
      headers: {
        'X-Payment-Token': 'spt_abc',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ protocol: 'mpp' }),
    })
    const result = await adapter.detect(req)
    // Header = 0.9, body = 0.5. MAX = 0.9.
    expect(result.confidence).toBeCloseTo(0.9, 10)
    // Both reasons logged.
    expect(result.reasons.some((r) => r.includes('X-Payment-Token'))).toBe(true)
    expect(result.reasons.some((r) => r.startsWith('body:'))).toBe(true)
  })

  it('H1: skips body inspection when Content-Length exceeds 64 KiB cap', async () => {
    // Hostile fix H1 — oversize bodies must NOT be materialized into
    // a JS string or parsed. This test lies about Content-Length with
    // a header value well above the cap; the adapter should skip body
    // inspection entirely (body reason absent) while preserving any
    // header-level confidence. Without the fix, the adapter would
    // buffer and parse the whole body as a memory amplification vector.
    const adapter = newAdapter()
    const smallBody = JSON.stringify({ protocol: 'mpp' })
    const req = new Request('http://localhost/api/proxy/my-tool', {
      method: 'POST',
      headers: {
        'X-Payment-Token': 'spt_abc',
        'Content-Length': String(10 * 1024 * 1024), // 10 MiB — fabricated
        'Content-Type': 'application/json',
      },
      body: smallBody,
    })
    const result = await adapter.detect(req)
    // Header stands; body path is short-circuited by Content-Length.
    expect(result.confidence).toBeCloseTo(0.9, 10)
    expect(result.reasons.some((r) => r.startsWith('body:'))).toBe(false)
  })

  it('H1: skips body inspection when post-read body text exceeds the cap', async () => {
    // Defense-in-depth against a spoofed / missing Content-Length:
    // build a body that is actually > 64 KiB and confirm detect
    // stops before JSON.parse. Use a valid-but-oversize MPP envelope
    // so the ONLY reason the body score is absent is the size cap.
    const adapter = newAdapter()
    const filler = 'A'.repeat(64 * 1024 + 1000) // > 64 KiB
    const oversizeEnvelope = JSON.stringify({ protocol: 'mpp', pad: filler })
    const req = new Request('http://localhost/api/proxy/my-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversizeEnvelope,
    })
    const result = await adapter.detect(req)
    expect(result.confidence).toBe(0)
    expect(result.reasons).toEqual([])
  })
})

// ─── canHandle / detect consistency ──────────────────────────────────────

describe('MPPAdapter.canHandle vs detect', () => {
  it('canHandle (sync, headers-only) is true when detect would score > 0 on headers', async () => {
    const adapter = newAdapter()
    const positive = reqWithHeaders({ 'X-Payment-Protocol': 'MPP/1.0' })
    const negative = reqWithHeaders({ Authorization: 'Bearer sg_live_abc' })
    expect(adapter.canHandle(positive)).toBe(true)
    expect((await adapter.detect(positive)).confidence).toBeGreaterThan(0)
    expect(adapter.canHandle(negative)).toBe(false)
    expect((await adapter.detect(negative)).confidence).toBe(0)
  })
})

// ─── buildChallenge overload + buildMppChallenge (F2) ────────────────────

describe('MPPAdapter.buildChallenge — overloaded AcceptEntry + envelope paths', () => {
  it('returns an AcceptEntry when called with BuildChallengeOptions (no merchantId)', () => {
    const adapter = newAdapter()
    const entry = adapter.buildChallenge({
      resource: { url: 'https://tool.example' },
      pricing: { defaultCostCents: 50 },
    })
    expect(entry.scheme).toBe('mpp')
    // AcceptEntry path still emits the pre-existing camelCase fields
    // because the AcceptEntry shape is shared across 14 adapters.
    expect(entry.provider).toBe('stripe')
    expect(entry.amountCents).toBe(50)
    expect(entry.currency).toBe('USD')
  })

  it('returns an MppChallengeEnvelope when called with MppChallengeOptions (has merchantId)', () => {
    const adapter = newAdapter()
    const env = adapter.buildChallenge({
      amountCents: 75,
      merchantId: 'acct_test_overload',
    })
    // Envelope path emits snake_case.
    expect(env.scheme).toBe('mpp')
    expect(env.amount).toBe(75)
    expect(env.merchant_id).toBe('acct_test_overload')
    expect(env.currency).toBe('usd')
  })

  it('H3: throws a TypeError with a clean message on null options', () => {
    const adapter = newAdapter()
    expect(() =>
      // @ts-expect-error intentional null
      adapter.buildChallenge(null),
    ).toThrow(TypeError)
    expect(() =>
      // @ts-expect-error intentional null
      adapter.buildChallenge(null),
    ).toThrow(/non-null object/)
  })

  it('H3: throws on undefined options', () => {
    const adapter = newAdapter()
    expect(() =>
      // @ts-expect-error intentional undefined
      adapter.buildChallenge(undefined),
    ).toThrow(TypeError)
  })

  it('H3: throws on primitive options (number, string, boolean)', () => {
    const adapter = newAdapter()
    for (const bad of [42, 'hello', true, false] as const) {
      expect(() =>
        // @ts-expect-error intentional primitive
        adapter.buildChallenge(bad),
      ).toThrow(TypeError)
    }
  })

  it('H3: throws on array options', () => {
    const adapter = newAdapter()
    expect(() =>
      // @ts-expect-error intentional array
      adapter.buildChallenge([]),
    ).toThrow(TypeError)
  })
})

// ─── buildMppChallenge ────────────────────────────────────────────────────

describe('MPPAdapter.buildMppChallenge', () => {
  it('builds a valid MPP 402 envelope with snake_case fields', () => {
    const adapter = newAdapter()
    const env = adapter.buildMppChallenge({
      amountCents: 500,
      merchantId: 'acct_test_123',
    })
    expect(env.scheme).toBe('mpp')
    expect(env.provider).toBe('stripe')
    expect(env.version).toBe('1.0')
    expect(env.amount).toBe(500)
    expect(env.currency).toBe('usd')
    expect(env.merchant_id).toBe('acct_test_123')
    expect(env.accepted_tokens).toEqual(['spt'])
    expect(env.instructions).toContain('spt_')
    // Optional fields must be ABSENT (not undefined keys) when not supplied.
    expect('payment_intent_client_secret' in env).toBe(false)
    expect('recipient' in env).toBe(false)
    expect('directory_url' in env).toBe(false)
  })

  it('passes through optional fields under snake_case names when supplied', () => {
    const adapter = newAdapter()
    const env = adapter.buildMppChallenge({
      amountCents: 100,
      merchantId: 'acct_test_123',
      paymentIntentClientSecret: 'pi_test_abc_secret_xyz',
      recipientId: 'acct_recipient_456',
      description: 'unit test',
      directoryUrl: 'https://example/discover',
    })
    expect(env.payment_intent_client_secret).toBe('pi_test_abc_secret_xyz')
    expect(env.recipient).toBe('acct_recipient_456')
    expect(env.description).toBe('unit test')
    expect(env.directory_url).toBe('https://example/discover')
  })

  it('normalizes currency to lowercase and supports non-USD', () => {
    const adapter = newAdapter()
    const env = adapter.buildMppChallenge({
      amountCents: 100,
      currency: 'EUR',
      merchantId: 'acct_test_123',
    })
    // MPP wire format uses lowercase ISO-4217.
    expect(env.currency).toBe('eur')
    expect(env.instructions).toContain('minor units of EUR')
  })

  it('throws when merchantId is missing or empty', () => {
    const adapter = newAdapter()
    expect(() =>
      adapter.buildMppChallenge({ amountCents: 1, merchantId: '' }),
    ).toThrow(/merchantId.*required/i)
    expect(() =>
      // @ts-expect-error intentional omission
      adapter.buildMppChallenge({ amountCents: 1 }),
    ).toThrow(/merchantId.*required/i)
  })

  it('throws RangeError on non-integer / negative / NaN / Infinity amounts', () => {
    const adapter = newAdapter()
    const bad: unknown[] = [1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]
    for (const amountCents of bad) {
      expect(() =>
        adapter.buildMppChallenge({
          amountCents: amountCents as number,
          merchantId: 'acct_x',
        }),
      ).toThrow(RangeError)
    }
  })

  it('throws on malformed currency code', () => {
    const adapter = newAdapter()
    expect(() =>
      adapter.buildMppChallenge({
        amountCents: 1,
        merchantId: 'acct_x',
        currency: 'US$',
      }),
    ).toThrow(/ISO-4217/)
    expect(() =>
      adapter.buildMppChallenge({
        amountCents: 1,
        merchantId: 'acct_x',
        currency: 'DOLLARS',
      }),
    ).toThrow(/ISO-4217/)
  })

  it('rejects a null options object with a TypeError', () => {
    const adapter = newAdapter()
    expect(() =>
      // @ts-expect-error intentional null
      adapter.buildMppChallenge(null),
    ).toThrow(TypeError)
  })
})

// ─── verifyPayment ────────────────────────────────────────────────────────

describe('MPPAdapter.verifyPayment', () => {
  it('returns MPP_NOT_CONFIGURED when disabled', async () => {
    const adapter = newAdapter()
    const result = await adapter.verifyPayment(reqWithHeaders({}), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('MPP_NOT_CONFIGURED')
  })

  it('returns MPP_NOT_CONFIGURED when Stripe secret is missing', async () => {
    const adapter = newAdapter()
    const result = await adapter.verifyPayment(
      reqWithHeaders({ 'X-Payment-Token': 'spt_abc' }),
      { enabled: true, toolConfig: TOOL_CONFIG },
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('MPP_NOT_CONFIGURED')
  })

  it('returns MPP_TOKEN_MISSING when no SPT present', async () => {
    const adapter = newAdapter()
    const result = await adapter.verifyPayment(reqWithHeaders({}), {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      stripeMppSecret: 'sk_test_xxx',
    })
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('MPP_TOKEN_MISSING')
  })

  it('returns MPP_TOKEN_EXPIRED when Stripe reports the SPT expired', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: 'SPT has expired.' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = newAdapter()
    const result = await adapter.verifyPayment(
      reqWithHeaders({ 'X-Payment-Token': 'spt_expired' }),
      {
        enabled: true,
        toolConfig: TOOL_CONFIG,
        stripeMppSecret: 'sk_test_xxx',
      },
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('MPP_TOKEN_EXPIRED')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns MPP_INSUFFICIENT_AUTHORIZATION when SPT maxAmount < tool cost', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ max_amount: 100, currency: 'usd', customer: 'cus_test' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = newAdapter()
    const result = await adapter.verifyPayment(
      reqWithHeaders({ 'X-Payment-Token': 'spt_low' }),
      {
        enabled: true,
        toolConfig: TOOL_CONFIG,
        stripeMppSecret: 'sk_test_xxx',
      },
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('MPP_INSUFFICIENT_AUTHORIZATION')
  })

  it('succeeds end-to-end and calls Stripe with correct URL/headers/body (F4)', async () => {
    // F4 — the Stripe test-mode verification pipeline must use the
    // correct endpoints, auth, API version, and capture form. Asserting
    // the mocked fetch's arguments proves the adapter is wire-compatible
    // with Stripe MPP (verify SPT → capture payment).
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ max_amount: 1000, currency: 'usd', customer: 'cus_test' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'pi_test_abc', customer: 'cus_test' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = newAdapter()
    const result = await adapter.verifyPayment(
      reqWithHeaders({
        'X-Payment-Token': 'spt_happypath',
        'X-MPP-Session-Id': 'sess_xyz',
      }),
      {
        enabled: true,
        toolConfig: TOOL_CONFIG,
        stripeMppSecret: 'sk_test_happypath',
      },
    )
    expect(result.valid).toBe(true)
    expect(result.paymentId).toBe('pi_test_abc')
    expect(result.amountCents).toBe(TOOL_CONFIG.costCents)
    expect(result.currency).toBe('usd')
    expect(result.sessionId).toBe('sess_xyz')

    // First call: SPT verify endpoint.
    const [verifyUrl, verifyInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(verifyUrl).toBe(
      'https://api.stripe.com/v1/mpp/shared_payment_tokens/spt_happypath/verify',
    )
    expect(verifyInit.method).toBe('POST')
    const verifyHeaders = verifyInit.headers as Record<string, string>
    expect(verifyHeaders.Authorization).toBe('Bearer sk_test_happypath')
    expect(verifyHeaders['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(verifyHeaders['Stripe-Version']).toBe('2026-03-18')

    // Second call: SPT capture endpoint + form body carrying
    // amount/currency/description/metadata.
    const [captureUrl, captureInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ]
    expect(captureUrl).toBe(
      'https://api.stripe.com/v1/mpp/shared_payment_tokens/spt_happypath/capture',
    )
    expect(captureInit.method).toBe('POST')
    const captureHeaders = captureInit.headers as Record<string, string>
    expect(captureHeaders.Authorization).toBe('Bearer sk_test_happypath')
    expect(captureHeaders['Stripe-Version']).toBe('2026-03-18')
    const captureForm = new URLSearchParams(captureInit.body as string)
    expect(captureForm.get('amount')).toBe(String(TOOL_CONFIG.costCents))
    expect(captureForm.get('currency')).toBe('usd')
    expect(captureForm.get('description')).toContain(TOOL_CONFIG.displayName)
    expect(captureForm.get('metadata[mpp_session_id]')).toBe('sess_xyz')
    expect(captureForm.get('metadata[platform]')).toBe('settlegrid')
    expect(captureForm.get('metadata[version]')).toBe('1.0')
  })

  it('returns MPP_AMOUNT_MISMATCH when expectedCurrency does not match captured currency', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ max_amount: 1000, currency: 'usd', customer: 'cus_test' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'pi_test', customer: 'cus_test' }), {
          status: 200,
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = newAdapter()
    const result = await adapter.verifyPayment(
      reqWithHeaders({ 'X-Payment-Token': 'spt_ok' }),
      {
        enabled: true,
        toolConfig: TOOL_CONFIG,
        stripeMppSecret: 'sk_test_xxx',
        expectedCurrency: 'eur',
      },
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('MPP_AMOUNT_MISMATCH')
    expect(result.error?.message).toMatch(/Currency mismatch/i)
  })
})

// ─── settle ───────────────────────────────────────────────────────────────

describe('MPPAdapter.settle', () => {
  const baseSettlement: MppSettlement = {
    invocationId: 'inv_abc_001',
    toolSlug: 'my-tool',
    costCents: 500,
    currency: 'usd',
    paymentId: 'pi_test_abc',
    payerCustomerId: 'cus_test',
  }

  it('settles on first call and emits a SettleGridInternalEvent-shaped event (F5)', async () => {
    const adapter = newAdapter()
    const ledger: MppLedgerEntry[] = []
    const events: MppSettlementEvent[] = []
    const deps: MppSettleDependencies = {
      recordInvocation: (entry) => {
        ledger.push(entry)
      },
      onSettled: (event) => {
        events.push(event)
      },
      now: () => 1_700_000_000_000,
    }

    const result = await adapter.settle(baseSettlement, deps)

    expect(result.status).toBe('settled')
    // F5 — top-level event satisfies SettleGridInternalEvent shape.
    expect(result.event.kind).toBe('unknown')
    expect(result.event.railId).toBe('stripe-connect')
    expect(result.event.externalEventId).toBe('inv_abc_001')
    expect(result.event.externalAccountId).toBe('cus_test')
    // Rich MPP details live under data.
    expect(result.event.data.subKind).toBe('invocation.settled')
    expect(result.event.data.protocol).toBe('mpp')
    expect(result.event.data.invocationId).toBe('inv_abc_001')
    expect(result.event.data.settledAt).toBe(1_700_000_000_000)
    expect(result.event.data.currency).toBe('usd')

    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.invocationId).toBe('inv_abc_001')
    expect(ledger[0]?.settledAt).toBe(1_700_000_000_000)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(result.event)
  })

  it('is idempotent on repeat call with the same invocationId', async () => {
    // Hostile-audit (c) — settle must be idempotent on the same
    // invocation_id. Second call returns status='already-settled',
    // recordInvocation + onSettled each invoked exactly once.
    const adapter = newAdapter()
    const ledger: MppLedgerEntry[] = []
    const events: MppSettlementEvent[] = []
    const deps: MppSettleDependencies = {
      recordInvocation: (entry) => {
        ledger.push(entry)
      },
      onSettled: (event) => {
        events.push(event)
      },
      now: () => 1_700_000_000_000,
    }

    const first = await adapter.settle(baseSettlement, deps)
    const second = await adapter.settle(baseSettlement, deps)

    expect(first.status).toBe('settled')
    expect(second.status).toBe('already-settled')
    expect(second.event).toEqual(first.event)
    expect(ledger).toHaveLength(1)
    expect(events).toHaveLength(1)
  })

  it('uses adapter-local cache when deps.idempotencyStore is omitted', async () => {
    const adapter = newAdapter()
    const first = await adapter.settle(baseSettlement)
    const second = await adapter.settle(baseSettlement)
    expect(first.status).toBe('settled')
    expect(second.status).toBe('already-settled')
    expect(second.event).toEqual(first.event)
  })

  it('rolls back the idempotency entry when recordInvocation throws', async () => {
    const adapter = newAdapter()
    const recordInvocation = vi
      .fn<(entry: MppLedgerEntry) => Promise<void>>()
      .mockRejectedValueOnce(new Error('ledger unavailable'))
      .mockResolvedValue(undefined)
    const events: MppSettlementEvent[] = []

    await expect(
      adapter.settle(baseSettlement, {
        recordInvocation,
        onSettled: (e) => events.push(e),
      }),
    ).rejects.toThrow('ledger unavailable')
    expect(events).toHaveLength(0)

    const retried = await adapter.settle(baseSettlement, {
      recordInvocation,
      onSettled: (e) => events.push(e),
    })
    expect(retried.status).toBe('settled')
    expect(recordInvocation).toHaveBeenCalledTimes(2)
    expect(events).toHaveLength(1)
  })

  it('honors an externally-supplied idempotencyStore across adapter instances', async () => {
    const store = new Map<string, MppSettleResult>()
    const a = newAdapter()
    const b = newAdapter()
    const events: MppSettlementEvent[] = []

    const first = await a.settle(baseSettlement, {
      idempotencyStore: store,
      onSettled: (e) => events.push(e),
    })
    const second = await b.settle(baseSettlement, {
      idempotencyStore: store,
      onSettled: (e) => events.push(e),
    })

    expect(first.status).toBe('settled')
    expect(second.status).toBe('already-settled')
    expect(events).toHaveLength(1)
  })

  it('rejects a non-object invocation with a TypeError', async () => {
    const adapter = newAdapter()
    await expect(
      // @ts-expect-error intentional bad type
      adapter.settle(null),
    ).rejects.toBeInstanceOf(TypeError)
  })

  it('rejects a missing/empty invocationId with an Error', async () => {
    const adapter = newAdapter()
    await expect(
      adapter.settle({ ...baseSettlement, invocationId: '' }),
    ).rejects.toThrow(/invocationId.*required/i)
  })

  it('rejects non-integer / negative costCents with a RangeError', async () => {
    const adapter = newAdapter()
    await expect(
      adapter.settle({ ...baseSettlement, costCents: 1.5 }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      adapter.settle({
        ...baseSettlement,
        invocationId: 'other',
        costCents: -1,
      }),
    ).rejects.toBeInstanceOf(RangeError)
  })

  it('normalizes currency to lowercase in the emitted event data', async () => {
    const adapter = newAdapter()
    const result = await adapter.settle({
      ...baseSettlement,
      invocationId: 'inv_currency_norm',
      currency: 'USD',
    })
    expect(result.event.data.currency).toBe('usd')
  })

  it('H6: rejects an empty-string currency before mutating cache', async () => {
    const adapter = newAdapter()
    await expect(
      adapter.settle({ ...baseSettlement, invocationId: 'inv_empty_cur', currency: '' }),
    ).rejects.toThrow(/ISO-4217/)
    // Cache MUST NOT be populated for a rejected input — confirm by
    // running a clean settle afterward with a different currency.
    const ok = await adapter.settle({
      ...baseSettlement,
      invocationId: 'inv_empty_cur',
      currency: 'usd',
    })
    expect(ok.status).toBe('settled')
    expect(ok.event.data.currency).toBe('usd')
  })

  it('H6: rejects a malformed ISO-4217 currency', async () => {
    const adapter = newAdapter()
    await expect(
      adapter.settle({ ...baseSettlement, invocationId: 'inv_bad_cur', currency: 'US$' }),
    ).rejects.toThrow(/ISO-4217/)
    await expect(
      adapter.settle({
        ...baseSettlement,
        invocationId: 'inv_bad_cur2',
        currency: 'DOLLARS',
      }),
    ).rejects.toThrow(/ISO-4217/)
  })

  it('omits externalAccountId + data.paymentId/sessionId when input lacks them', async () => {
    const adapter = newAdapter()
    const result = await adapter.settle({
      invocationId: 'inv_minimal',
      toolSlug: 'my-tool',
      costCents: 100,
    })
    expect('externalAccountId' in result.event).toBe(false)
    expect('paymentId' in result.event.data).toBe(false)
    expect('payerCustomerId' in result.event.data).toBe(false)
    expect('sessionId' in result.event.data).toBe(false)
    expect(result.event.data.currency).toBe('usd')
  })

  it('emits an event structurally assignable to SettleGridInternalEvent', async () => {
    // The spec literal — "emits a SettleGridInternalEvent" — is now
    // satisfied by the MppSettlementEvent interface extending
    // SettleGridInternalEvent. This compile-time assertion proves
    // the assignment works without losing type information.
    const adapter = newAdapter()
    const result = await adapter.settle({
      invocationId: 'inv_parent_compat',
      toolSlug: 'my-tool',
      costCents: 200,
    })
    // Type-level assertion — compiles only because MppSettlementEvent
    // extends SettleGridInternalEvent.
    const asParent: import('../../rails/types').SettleGridInternalEvent =
      result.event
    expect(asParent.kind).toBe('unknown')
    expect(asParent.railId).toBe('stripe-connect')
    expect(asParent.externalEventId).toBe('inv_parent_compat')
    expect(asParent.data).toBeTypeOf('object')
  })
})
