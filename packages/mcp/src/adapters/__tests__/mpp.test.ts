/**
 * P3.K1 — unit tests for the spec-aligned MPPAdapter methods
 * (`detect` / `buildMppChallenge` / `verifyPayment` / `settle`).
 *
 * The test surface deliberately exercises the four spec-named methods
 * the P3.K1 card calls out, plus the edge cases the hostile audit
 * requirement enumerates:
 *
 *   - "detect returns a real confidence score, not a constant"
 *   - "verifyPayment actually validates the amount and currency,
 *      not just intent existence"
 *   - "settle is idempotent on the same invocation_id"
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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── detect() ─────────────────────────────────────────────────────────────

describe('MPPAdapter.detect', () => {
  it('returns confidence 0 and no reasons for an unrelated request', () => {
    const adapter = newAdapter()
    const result = adapter.detect(reqWithHeaders({}))
    expect(result.confidence).toBe(0)
    expect(result.reasons).toEqual([])
  })

  it('returns 1.0 for an explicit X-Payment-Protocol: MPP/1.0 header', () => {
    const adapter = newAdapter()
    const result = adapter.detect(reqWithHeaders({ 'X-Payment-Protocol': 'MPP/1.0' }))
    expect(result.confidence).toBe(1.0)
    expect(result.reasons).toContain('X-Payment-Protocol: MPP/1.0')
  })

  it('returns 1.0 for an explicit x-mpp-version header', () => {
    const adapter = newAdapter()
    const result = adapter.detect(reqWithHeaders({ 'x-mpp-version': '1.0' }))
    expect(result.confidence).toBe(1.0)
    expect(result.reasons).toContain('x-mpp-version: 1.0')
  })

  it('returns 0.9 for X-Payment-Token: spt_*', () => {
    const adapter = newAdapter()
    const result = adapter.detect(reqWithHeaders({ 'X-Payment-Token': 'spt_test_abc' }))
    expect(result.confidence).toBeCloseTo(0.9, 10)
    expect(result.reasons[0]).toMatch(/spt_\*/)
  })

  it('returns 0.8 for x-mpp-credential header', () => {
    const adapter = newAdapter()
    const result = adapter.detect(reqWithHeaders({ 'x-mpp-credential': 'abc123' }))
    expect(result.confidence).toBeCloseTo(0.8, 10)
    expect(result.reasons).toContain('x-mpp-credential')
  })

  it('returns 0.7 for x-settlegrid-protocol: mpp hint', () => {
    const adapter = newAdapter()
    const result = adapter.detect(reqWithHeaders({ 'x-settlegrid-protocol': 'mpp' }))
    expect(result.confidence).toBeCloseTo(0.7, 10)
    expect(result.reasons).toContain('x-settlegrid-protocol: mpp')
  })

  it('returns 0.6 for Authorization: Bearer spt_*', () => {
    const adapter = newAdapter()
    const result = adapter.detect(reqWithHeaders({ Authorization: 'Bearer spt_abc' }))
    expect(result.confidence).toBeCloseTo(0.6, 10)
    expect(result.reasons[0]).toMatch(/Bearer spt_\*/)
  })

  it('returns 0 for a non-MPP Bearer token (x402_*)', () => {
    const adapter = newAdapter()
    // Sanity check that detect() is not fooled by ANY Bearer prefix.
    const result = adapter.detect(reqWithHeaders({ Authorization: 'Bearer x402_xyz' }))
    expect(result.confidence).toBe(0)
    expect(result.reasons).toEqual([])
  })

  it('reports MAX confidence across multiple matched signatures', () => {
    const adapter = newAdapter()
    // Mix a 1.0-weight signal (x-mpp-version) with a 0.6-weight signal
    // (Bearer spt_*). The reported score must be the max (1.0), and
    // both reasons must be listed so callers can audit what matched.
    // Proves `confidence` is not a constant — different header mixes
    // yield different scores.
    const result = adapter.detect(
      reqWithHeaders({
        'x-mpp-version': '1.0',
        Authorization: 'Bearer spt_abc',
      }),
    )
    expect(result.confidence).toBe(1.0)
    expect(result.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('score strictly orders mid-weight vs low-weight signatures', () => {
    const adapter = newAdapter()
    // Drive down the max to 0.6 (Bearer spt_* only, nothing stronger)
    // and confirm the ordering: 0.6 < 0.7 < 0.8 < 0.9 < 1.0.
    const low = adapter.detect(reqWithHeaders({ Authorization: 'Bearer spt_abc' }))
    const midHint = adapter.detect(reqWithHeaders({ 'x-settlegrid-protocol': 'mpp' }))
    const midCred = adapter.detect(reqWithHeaders({ 'x-mpp-credential': 'x' }))
    const highTok = adapter.detect(reqWithHeaders({ 'X-Payment-Token': 'spt_x' }))
    const topVer = adapter.detect(reqWithHeaders({ 'x-mpp-version': '1.0' }))
    expect(low.confidence).toBeLessThan(midHint.confidence)
    expect(midHint.confidence).toBeLessThan(midCred.confidence)
    expect(midCred.confidence).toBeLessThan(highTok.confidence)
    expect(highTok.confidence).toBeLessThan(topVer.confidence)
  })
})

// ─── canHandle / detect consistency ──────────────────────────────────────

describe('MPPAdapter.canHandle vs detect', () => {
  it('canHandle is true exactly when detect().confidence > 0', () => {
    const adapter = newAdapter()
    const positive = reqWithHeaders({ 'X-Payment-Protocol': 'MPP/1.0' })
    const negative = reqWithHeaders({ Authorization: 'Bearer sg_live_abc' })
    expect(adapter.canHandle(positive)).toBe(true)
    expect(adapter.detect(positive).confidence).toBeGreaterThan(0)
    expect(adapter.canHandle(negative)).toBe(false)
    expect(adapter.detect(negative).confidence).toBe(0)
  })
})

// ─── buildMppChallenge ────────────────────────────────────────────────────

describe('MPPAdapter.buildMppChallenge', () => {
  it('builds a valid MPP 402 envelope with required fields', () => {
    const adapter = newAdapter()
    const env = adapter.buildMppChallenge({
      amountCents: 500,
      merchantId: 'acct_test_123',
    })
    expect(env.scheme).toBe('mpp')
    expect(env.provider).toBe('stripe')
    expect(env.version).toBe('1.0')
    expect(env.amountCents).toBe(500)
    expect(env.currency).toBe('USD')
    expect(env.merchantId).toBe('acct_test_123')
    expect(env.acceptedTokens).toEqual(['spt'])
    expect(env.instructions).toContain('spt_')
    // Optional fields must be ABSENT (not undefined keys) when not supplied.
    expect('paymentIntentClientSecret' in env).toBe(false)
    expect('recipientId' in env).toBe(false)
  })

  it('passes through paymentIntentClientSecret and recipientId when supplied', () => {
    const adapter = newAdapter()
    const env = adapter.buildMppChallenge({
      amountCents: 100,
      merchantId: 'acct_test_123',
      paymentIntentClientSecret: 'pi_test_abc_secret_xyz',
      recipientId: 'acct_recipient_456',
      description: 'unit test',
      directoryUrl: 'https://example/discover',
    })
    expect(env.paymentIntentClientSecret).toBe('pi_test_abc_secret_xyz')
    expect(env.recipientId).toBe('acct_recipient_456')
    expect(env.description).toBe('unit test')
    expect(env.directoryUrl).toBe('https://example/discover')
  })

  it('normalizes currency to uppercase and supports non-USD', () => {
    const adapter = newAdapter()
    const env = adapter.buildMppChallenge({
      amountCents: 100,
      currency: 'eur',
      merchantId: 'acct_test_123',
    })
    expect(env.currency).toBe('EUR')
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
    // Stripe verify endpoint returns HTTP 200 with `error: { message }`
    // is NOT the real shape — Stripe sends HTTP 4xx with a body. Match
    // the real shape: 400 + body.error.message containing 'expired'.
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
    // Stripe verify returns 200 with max_amount below the tool's cost.
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

  it('succeeds when Stripe verify + capture both return 200 with matching amount', async () => {
    // Two round-trips — verify then capture. First returns max_amount >= cost.
    // Second returns the captured PaymentIntent with id.
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
      reqWithHeaders({ 'X-Payment-Token': 'spt_ok' }),
      {
        enabled: true,
        toolConfig: TOOL_CONFIG,
        stripeMppSecret: 'sk_test_xxx',
      },
    )
    expect(result.valid).toBe(true)
    expect(result.paymentId).toBe('pi_test_abc')
    expect(result.amountCents).toBe(TOOL_CONFIG.costCents)
    expect(result.currency).toBe('usd')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns MPP_AMOUNT_MISMATCH when expectedCurrency does not match captured currency', async () => {
    // Same happy-path mocks as above but the caller expects EUR.
    // validateMppPayment hardcodes 'usd' on success, so the wrapper
    // must detect the mismatch and downgrade the result to invalid.
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

  it('settles on first call, emits event, and calls recordInvocation once', async () => {
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
    expect(result.event.kind).toBe('invocation.settled')
    expect(result.event.protocol).toBe('mpp')
    expect(result.event.invocationId).toBe('inv_abc_001')
    expect(result.event.settledAt).toBe(1_700_000_000_000)
    expect(result.event.currency).toBe('usd')
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.invocationId).toBe('inv_abc_001')
    expect(ledger[0]?.settledAt).toBe(1_700_000_000_000)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(result.event)
  })

  it('is idempotent on repeat call with the same invocationId', async () => {
    // This is the hostile-audit requirement (c): settle is idempotent
    // on the same invocation_id. Verifies:
    //   - second call returns status='already-settled'
    //   - recordInvocation is NOT called a second time
    //   - onSettled is NOT emitted a second time
    //   - the event payload matches the first call bit-for-bit
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
    // Idempotency entry MUST be rolled back so a retry can succeed.
    // Subsequent call should NOT short-circuit to 'already-settled'.
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
    // Two separate adapter instances sharing one store must still
    // converge on one settlement — proves settle() does not rely on
    // the private cache when an external store is provided.
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

  it('normalizes currency to lowercase in the emitted event', async () => {
    const adapter = newAdapter()
    const result = await adapter.settle({
      ...baseSettlement,
      invocationId: 'inv_currency_norm',
      currency: 'USD',
    })
    expect(result.event.currency).toBe('usd')
  })

  it('includes optional fields in the event only when supplied on the input', async () => {
    const adapter = newAdapter()
    // Minimal input — no paymentId / payerCustomerId / sessionId.
    const result = await adapter.settle({
      invocationId: 'inv_minimal',
      toolSlug: 'my-tool',
      costCents: 100,
    })
    expect('paymentId' in result.event).toBe(false)
    expect('payerCustomerId' in result.event).toBe(false)
    expect('sessionId' in result.event).toBe(false)
    expect(result.event.currency).toBe('usd')
  })
})
