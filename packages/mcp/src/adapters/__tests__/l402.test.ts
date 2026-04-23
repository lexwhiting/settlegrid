/**
 * P3.K2 — unit + gated-integration tests for L402Adapter.
 *
 * Covers the spec-named surface (`detect` / `buildChallenge` overload
 * / `verifyPayment` / `settle`) plus the three hostile-audit rules:
 *
 *   (a) preimage validation actually hashes the preimage and compares
 *       against the invoice's payment_hash (NOT a length check)
 *   (b) msat→fiat conversion uses a LIVE rate source (NOT hardcoded)
 *   (c) integration test does NOT run in CI by default — gated by
 *       `L402_INTEGRATION=true` + `VOLTAGE_NODE_URL` + `VOLTAGE_MACAROON`
 *
 * All unit tests mock the Voltage client + rate fetcher so they run
 * offline. The integration test is `it.skipIf(...)`'d so CI + local
 * `npm test` skip it unless the gating env is set.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'crypto'
import {
  CoinGeckoRateFetcher,
  L402Adapter,
  type BtcUsdRateFetcher,
  type L402ChallengeOptions,
  type L402LedgerEntry,
  type L402SettleDependencies,
  type L402SettleResult,
  type L402Settlement,
  type L402SettlementEvent,
  type L402VerifyPaymentOptions,
  generateL402_402Response,
  resolveLightningBackend,
  createLightningClient,
} from '../l402'
import {
  LND_NOT_WIRED_MESSAGE,
  createLndClient,
} from '../lightning/lnd'
import type { VoltageClient, VoltageInvoice } from '../lightning/voltage'
import {
  VOLTAGE_MAX_BODY_BYTES,
  VOLTAGE_MAX_MEMO_CHARS,
  createVoltageClient,
  sha256Hex,
  timingSafeHexEqual,
} from '../lightning/voltage'

// ─── Fixtures ─────────────────────────────────────────────────────────────

const SIGNING_KEY = 'test-l402-signing-key'
const APP_URL = 'https://settlegrid.test'
const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test Tool' }

const REAL_PREIMAGE = 'a'.repeat(64)
const REAL_PAYMENT_HASH = createHash('sha256')
  .update(Buffer.from(REAL_PREIMAGE, 'hex'))
  .digest('hex')

function fakeInvoice(overrides: Partial<VoltageInvoice> = {}): VoltageInvoice {
  return {
    paymentRequest: 'lnbc100n1p0testinvoice',
    paymentHash: REAL_PAYMENT_HASH,
    amountMsat: 1000,
    expirySeconds: 3600,
    creationDate: 1_700_000_000,
    settled: false,
    ...overrides,
  }
}

function mockVoltageClient(overrides: Partial<VoltageClient> = {}): VoltageClient {
  return {
    createInvoice: vi.fn().mockResolvedValue(fakeInvoice()),
    lookupInvoice: vi.fn().mockResolvedValue(fakeInvoice()),
    decodePreimage: (p: string) => sha256Hex(p),
    ...overrides,
  }
}

function fixedRateFetcher(rate = 100_000): BtcUsdRateFetcher {
  return { fetchBtcUsdRate: () => Promise.resolve(rate) }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── voltage.ts primitives ────────────────────────────────────────────────

describe('Voltage client — primitives', () => {
  describe('sha256Hex', () => {
    it('hashes a 32-byte hex preimage to its payment hash', () => {
      const expected = createHash('sha256')
        .update(Buffer.from(REAL_PREIMAGE, 'hex'))
        .digest('hex')
      expect(sha256Hex(REAL_PREIMAGE)).toBe(expected)
    })

    it('throws on non-hex input', () => {
      expect(() => sha256Hex('ZZZZ')).toThrow(/32-byte hex/)
      expect(() => sha256Hex('')).toThrow(/32-byte hex/)
      expect(() => sha256Hex('a'.repeat(63))).toThrow(/32-byte hex/)
    })
  })

  describe('timingSafeHexEqual', () => {
    it('returns true for equal hex strings', () => {
      expect(timingSafeHexEqual('deadbeef', 'deadbeef')).toBe(true)
    })

    it('returns false for different-length strings without throwing', () => {
      expect(timingSafeHexEqual('dead', 'deadbeef')).toBe(false)
    })

    it('returns false for non-hex strings without throwing', () => {
      expect(timingSafeHexEqual('xyzw', 'abcd')).toBe(false)
    })
  })
})

// ─── createVoltageClient — input validation ───────────────────────────────

describe('createVoltageClient', () => {
  it('throws TypeError on non-object options', () => {
    // @ts-expect-error intentional null
    expect(() => createVoltageClient(null)).toThrow(TypeError)
    // @ts-expect-error intentional undefined
    expect(() => createVoltageClient(undefined)).toThrow(TypeError)
    // @ts-expect-error intentional primitive
    expect(() => createVoltageClient(42)).toThrow(TypeError)
  })

  it('throws on empty nodeUrl', () => {
    expect(() =>
      createVoltageClient({ nodeUrl: '', macaroon: 'aa' }),
    ).toThrow(/nodeUrl/)
  })

  it('throws on empty macaroon', () => {
    expect(() =>
      createVoltageClient({ nodeUrl: 'https://x', macaroon: '' }),
    ).toThrow(/macaroon/)
  })

  it('normalizes trailing slash on nodeUrl', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            payment_request: 'lnbc...',
            r_hash_str: REAL_PAYMENT_HASH,
            value_msat: '1000',
            expiry: '3600',
            creation_date: '1700000000',
            settled: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test/',
      macaroon: 'deadbeef',
      fetchImpl: fetchMock,
    })
    await client.createInvoice(1000)
    // URL used should not have double slash.
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://voltage.test/v1/invoices')
  })

  it('sends Grpc-Metadata-macaroon header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc...',
          r_hash_str: REAL_PAYMENT_HASH,
          value_msat: '1000',
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc123',
      fetchImpl: fetchMock,
    })
    await client.createInvoice(1000)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['Grpc-Metadata-macaroon']).toBe('abc123')
  })

  it('throws RangeError on non-integer / negative / zero amountMsat', async () => {
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: vi.fn(),
    })
    await expect(client.createInvoice(0)).rejects.toBeInstanceOf(RangeError)
    await expect(client.createInvoice(1.5)).rejects.toBeInstanceOf(RangeError)
    await expect(client.createInvoice(-1)).rejects.toBeInstanceOf(RangeError)
    await expect(client.createInvoice(Number.NaN)).rejects.toBeInstanceOf(RangeError)
  })

  it('throws on memo exceeding VOLTAGE_MAX_MEMO_CHARS', async () => {
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: vi.fn(),
    })
    const longMemo = 'x'.repeat(VOLTAGE_MAX_MEMO_CHARS + 1)
    await expect(
      client.createInvoice(1000, { memo: longMemo }),
    ).rejects.toThrow(/memo/)
  })

  it('rejects oversize response bodies via Content-Length', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"payment_request":"..."}', {
        status: 200,
        headers: { 'content-length': String(VOLTAGE_MAX_BODY_BYTES + 1) },
      }),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(
      /exceeds.*cap/,
    )
  })

  it('lookupInvoice validates paymentHash format', async () => {
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: vi.fn(),
    })
    await expect(client.lookupInvoice('not-hex')).rejects.toThrow(/hex/)
    await expect(client.lookupInvoice('a'.repeat(63))).rejects.toThrow(/hex/)
  })

  it('decodePreimage returns the SHA-256 of the hex preimage', () => {
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: vi.fn(),
    })
    expect(client.decodePreimage(REAL_PREIMAGE)).toBe(REAL_PAYMENT_HASH)
  })
})

// ─── lnd.ts stub ──────────────────────────────────────────────────────────

describe('createLndClient (stub)', () => {
  it('throws the spec-mandated message', () => {
    expect(() => createLndClient()).toThrow(LND_NOT_WIRED_MESSAGE)
  })
})

describe('resolveLightningBackend', () => {
  it('defaults to voltage when env is undefined / empty', () => {
    expect(resolveLightningBackend(undefined)).toBe('voltage')
    expect(resolveLightningBackend(null)).toBe('voltage')
    expect(resolveLightningBackend('')).toBe('voltage')
  })

  it('accepts voltage and lnd (case-insensitive)', () => {
    expect(resolveLightningBackend('voltage')).toBe('voltage')
    expect(resolveLightningBackend('VOLTAGE')).toBe('voltage')
    expect(resolveLightningBackend('lnd')).toBe('lnd')
    expect(resolveLightningBackend('LND')).toBe('lnd')
  })

  it('throws on unknown backend', () => {
    expect(() => resolveLightningBackend('clightning')).toThrow(/voltage.*lnd/)
    expect(() => resolveLightningBackend('voltage-beta')).toThrow(/voltage.*lnd/)
  })
})

describe('createLightningClient — backend dispatch', () => {
  it('returns a Voltage client for backend=voltage', () => {
    const client = createLightningClient({
      backend: 'voltage',
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: vi.fn(),
    })
    expect(typeof client.createInvoice).toBe('function')
    expect(typeof client.lookupInvoice).toBe('function')
    expect(typeof client.decodePreimage).toBe('function')
  })

  it('routes backend=lnd to the stub (throws LND_NOT_WIRED_MESSAGE)', () => {
    expect(() =>
      createLightningClient({
        backend: 'lnd',
        nodeUrl: 'ignored',
        macaroon: 'ignored',
      }),
    ).toThrow(LND_NOT_WIRED_MESSAGE)
  })

  it('defaults backend to voltage when omitted', () => {
    const client = createLightningClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: vi.fn(),
    })
    expect(typeof client.createInvoice).toBe('function')
  })
})

// ─── L402Adapter.detect ───────────────────────────────────────────────────

describe('L402Adapter.detect — headers', () => {
  const adapter = new L402Adapter()

  it('returns 0 for an unrelated request', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-api-key': 'sg_live_abc' },
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBe(0)
    expect(r.reasons).toEqual([])
  })

  it('returns 1.0 for Authorization: L402', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: 'L402 macaroon:preimage' },
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBe(1.0)
  })

  it('returns 1.0 for Authorization: LSAT (legacy)', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: 'LSAT macaroon:preimage' },
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBe(1.0)
  })

  it('returns 0.9 for WWW-Authenticate: L402', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'WWW-Authenticate': 'L402 macaroon="...", invoice="..."' },
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBeCloseTo(0.9, 10)
  })

  it('returns 0.7 for x-settlegrid-protocol: l402', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-settlegrid-protocol': 'l402' },
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBeCloseTo(0.7, 10)
  })

  it('ranks header signals strictly (1.0 > 0.9 > 0.7)', async () => {
    const auth = await adapter.detect(
      new Request('http://x', { headers: { authorization: 'L402 a:b' } }),
    )
    const www = await adapter.detect(
      new Request('http://x', { headers: { 'WWW-Authenticate': 'L402 realm="x"' } }),
    )
    const hint = await adapter.detect(
      new Request('http://x', { headers: { 'x-settlegrid-protocol': 'l402' } }),
    )
    expect(hint.confidence).toBeLessThan(www.confidence)
    expect(www.confidence).toBeLessThan(auth.confidence)
  })
})

describe('L402Adapter.detect — body signatures', () => {
  const adapter = new L402Adapter()

  it('adds 0.5 for body with protocol: "l402"', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol: 'l402' }),
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBeCloseTo(0.5, 10)
    expect(r.reasons).toContain('body: L402 envelope shape')
  })

  it('adds 0.4 for body with macaroon+preimage fields', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ macaroon: 'abc', preimage: 'def' }),
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBeCloseTo(0.4, 10)
  })

  it('gracefully ignores malformed JSON body', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      method: 'POST',
      headers: {
        authorization: 'L402 a:b',
        'Content-Type': 'application/json',
      },
      body: 'not { valid json',
    })
    const r = await adapter.detect(req)
    // Header 1.0 survives; body reason absent.
    expect(r.confidence).toBe(1.0)
    expect(r.reasons.some((x) => x.startsWith('body:'))).toBe(false)
  })

  it('skips body inspection when Content-Length exceeds cap', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      method: 'POST',
      headers: {
        authorization: 'L402 a:b',
        'Content-Length': String(10 * 1024 * 1024),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ protocol: 'l402' }),
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBe(1.0)
    expect(r.reasons.some((x) => x.startsWith('body:'))).toBe(false)
  })

  it('skips body inspection when request.bodyUsed is true', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      method: 'POST',
      headers: {
        authorization: 'L402 a:b',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ protocol: 'l402' }),
    })
    await req.text()
    const r = await adapter.detect(req)
    expect(r.confidence).toBe(1.0)
    expect(r.reasons.some((x) => x.startsWith('body:'))).toBe(false)
  })
})

// ─── L402Adapter.buildChallenge overload ──────────────────────────────────

describe('L402Adapter.buildChallenge (overload)', () => {
  const adapter = new L402Adapter()

  it('returns AcceptEntry for BuildChallengeOptions (no lightningClient)', () => {
    const entry = adapter.buildChallenge({
      resource: { url: 'https://tool.example' },
      pricing: { defaultCostCents: 5 },
    })
    expect(entry.scheme).toBe('l402')
    expect(entry.provider).toBe('lightning')
    expect(entry.costCents).toBe(5)
    expect(entry.currency).toBe('btc-lightning')
  })

  it('returns Promise<L402ChallengeEnvelope> when lightningClient is supplied', async () => {
    const client = mockVoltageClient({
      createInvoice: vi.fn().mockResolvedValue(
        fakeInvoice({ paymentHash: REAL_PAYMENT_HASH, amountMsat: 100_000 }),
      ),
    })
    const options: L402ChallengeOptions = {
      toolSlug: 'test-tool',
      amountMsat: 100_000,
      signingKey: SIGNING_KEY,
      lightningClient: client,
      costCents: 5,
    }
    const env = await adapter.buildChallenge(options)
    expect(env.scheme).toBe('l402')
    expect(env.amount_msat).toBe(100_000)
    expect(env.amount_sats).toBe(100)
    expect(env.payment_hash).toBe(REAL_PAYMENT_HASH)
    expect(env.macaroon).toBeTypeOf('string')
    expect(env.macaroon.length).toBeGreaterThan(0)
    expect(env.accepted_payments).toEqual(['lightning-invoice'])
  })

  it('throws TypeError on null/undefined options (H3 pattern)', () => {
    // @ts-expect-error intentional null
    expect(() => adapter.buildChallenge(null)).toThrow(TypeError)
    // @ts-expect-error intentional undefined
    expect(() => adapter.buildChallenge(undefined)).toThrow(TypeError)
  })

  it('throws on missing signingKey (rich path)', async () => {
    const client = mockVoltageClient()
    await expect(
      adapter.buildChallenge({
        toolSlug: 'test',
        amountMsat: 1000,
        signingKey: '',
        lightningClient: client,
      }),
    ).rejects.toThrow(/signingKey/)
  })

  it('throws RangeError on non-positive amountMsat (rich path)', async () => {
    const client = mockVoltageClient()
    await expect(
      adapter.buildChallenge({
        toolSlug: 'test',
        amountMsat: 0,
        signingKey: SIGNING_KEY,
        lightningClient: client,
      }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      adapter.buildChallenge({
        toolSlug: 'test',
        amountMsat: 1.5,
        signingKey: SIGNING_KEY,
        lightningClient: client,
      }),
    ).rejects.toBeInstanceOf(RangeError)
  })
})

// ─── L402Adapter.verifyPayment (hostile audit rule a) ────────────────────

describe('L402Adapter.verifyPayment — actually hashes preimage', () => {
  const adapter = new L402Adapter()

  async function mintTokenBound(preimage: string): Promise<string> {
    // Use generateL402_402Response to mint a macaroon with a
    // payment_hash caveat, then parse its Authorization-style token.
    // Build a Request carrying a mocked LND path that returns
    // payment_hash = SHA-256(preimage).
    const paymentHash = createHash('sha256')
      .update(Buffer.from(preimage, 'hex'))
      .digest('hex')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc1000n1ptest',
          r_hash: paymentHash,
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const response = await generateL402_402Response({
      toolSlug: TOOL_CONFIG.slug,
      costCents: TOOL_CONFIG.costCents,
      toolName: TOOL_CONFIG.displayName,
      appUrl: APP_URL,
      signingKey: SIGNING_KEY,
      lndRestUrl: 'https://lnd.test',
      lndMacaroonHex: 'deadbeef',
    })
    const wwwAuth = response.headers.get('WWW-Authenticate') ?? ''
    const macaroonMatch = wwwAuth.match(/macaroon="([^"]+)"/)
    if (!macaroonMatch) throw new Error('failed to extract macaroon from 402')
    return macaroonMatch[1] ?? ''
  }

  it('rule (a): accepts the correct preimage that hashes to payment_hash', async () => {
    const macaroon = await mintTokenBound(REAL_PREIMAGE)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: `L402 ${macaroon}:${REAL_PREIMAGE}` },
    })
    const options: L402VerifyPaymentOptions = {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    }
    const result = await adapter.verifyPayment(req, options)
    expect(result.valid).toBe(true)
  })

  it('rule (a): REJECTS a preimage with correct length but wrong bytes', async () => {
    const macaroon = await mintTokenBound(REAL_PREIMAGE)
    // Same 64-char hex length, different bytes — a pure length check
    // would incorrectly pass this. The spec-required SHA-256 compare
    // must reject it.
    const wrongPreimage = 'b'.repeat(64)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: `L402 ${macaroon}:${wrongPreimage}` },
    })
    const result = await adapter.verifyPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('L402_PREIMAGE_INVALID')
    expect(result.error?.message).toMatch(/SHA-256|payment_hash/)
  })

  it('propagates L402_MACAROON_MISSING when Authorization is absent', async () => {
    const req = new Request('http://localhost/api/proxy/t')
    const result = await adapter.verifyPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('L402_MACAROON_MISSING')
  })

  it('rejects macaroons whose amount_cents caveat does not match the current tool cost (F2)', async () => {
    // Spec step 5 "amount mismatch" — a macaroon minted when the tool
    // cost 5 cents must NOT be accepted by the same tool after it
    // raises to 10 cents. The macaroon's amount_cents caveat is the
    // authoritative bound; the verifier compares against the tool's
    // current costCents.
    const macaroon = await mintTokenBound(REAL_PREIMAGE)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: `L402 ${macaroon}:${REAL_PREIMAGE}` },
    })
    // Mint was done with TOOL_CONFIG.costCents = 5. Now present the
    // same token to a tool that expects 10 cents.
    const result = await adapter.verifyPayment(req, {
      enabled: true,
      toolConfig: { ...TOOL_CONFIG, costCents: 10 },
      signingKey: SIGNING_KEY,
    })
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('L402_CAVEAT_VIOLATION')
    expect(result.error?.message).toMatch(/amount_cents caveat.*does not match/i)
  })

  it('rejects expired invoices via the macaroon expires_at caveat (L402_MACAROON_EXPIRED)', async () => {
    // Mint a macaroon with generateL402_402Response, then advance the
    // clock past its expiry. Since the caveat encodes expires_at as
    // a Unix timestamp computed at mint time, we emulate "expired"
    // by using a date-fork via vi.useFakeTimers to walk the clock.
    const macaroon = await mintTokenBound(REAL_PREIMAGE)
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 2 * 3600 * 1000) // +2h > 1h default expiry
    try {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { authorization: `L402 ${macaroon}:${REAL_PREIMAGE}` },
      })
      const result = await adapter.verifyPayment(req, {
        enabled: true,
        toolConfig: TOOL_CONFIG,
        signingKey: SIGNING_KEY,
      })
      expect(result.valid).toBe(false)
      expect(result.error?.code).toBe('L402_MACAROON_EXPIRED')
    } finally {
      vi.useRealTimers()
    }
  })
})

// ─── L402Adapter.settle (hostile audit rule b) ───────────────────────────

describe('L402Adapter.settle', () => {
  const baseSettlement: L402Settlement = {
    invocationId: 'inv_l402_001',
    toolSlug: 'test-tool',
    amountMsat: 1_000_000, // 1M msat = 1000 sats
    paymentHash: REAL_PAYMENT_HASH,
    preimage: REAL_PREIMAGE,
    macaroonId: 'mac_123',
  }

  it('rule (b): uses an INJECTED live rate fetcher (not a hardcoded constant)', async () => {
    // Proves the injection seam: a caller-supplied rate is actually
    // used in the conversion. Without the rate-fetcher injection
    // (e.g., a hardcoded $100,000), varying the rate in the fetcher
    // would not change fiatCents.
    const adapter = new L402Adapter()
    const r1 = await adapter.settle(
      { ...baseSettlement, invocationId: 'inv_rate_1' },
      { rateFetcher: fixedRateFetcher(50_000), now: () => 0 },
    )
    const r2 = await adapter.settle(
      { ...baseSettlement, invocationId: 'inv_rate_2' },
      { rateFetcher: fixedRateFetcher(100_000), now: () => 0 },
    )
    expect(r1.event.data.btcUsdRate).toBe(50_000)
    expect(r2.event.data.btcUsdRate).toBe(100_000)
    // At 1M msat, doubling the rate doubles the fiat cents.
    expect(r2.event.data.fiatCents).toBe(2 * r1.event.data.fiatCents)
  })

  it('emits a SettleGridInternalEvent-shaped event with msat + fiat fields', async () => {
    const adapter = new L402Adapter()
    const events: L402SettlementEvent[] = []
    const ledger: L402LedgerEntry[] = []
    const deps: L402SettleDependencies = {
      rateFetcher: fixedRateFetcher(100_000),
      now: () => 1_700_000_000_000,
      onSettled: (e) => events.push(e),
      recordInvocation: (entry) => {
        ledger.push(entry)
      },
    }
    const result = await adapter.settle(baseSettlement, deps)
    expect(result.status).toBe('settled')
    expect(result.event.kind).toBe('unknown')
    expect(result.event.railId).toBe('stripe-connect')
    expect(result.event.externalEventId).toBe('inv_l402_001')
    expect(result.event.externalAccountId).toBe('mac_123')
    expect(result.event.data.subKind).toBe('invocation.settled')
    expect(result.event.data.protocol).toBe('l402')
    expect(result.event.data.amountMsat).toBe(1_000_000)
    expect(result.event.data.fiatCurrency).toBe('usd')
    expect(result.event.data.settledAt).toBe(1_700_000_000_000)
    // 1_000_000 msat = 1,000 sats = 0.00001 BTC. At $100k/BTC that is
    // $1.00 USD = 100 cents.
    expect(result.event.data.fiatCents).toBe(100)
    // preimage fingerprint is the first 8 chars only; full preimage is secret.
    expect(result.event.data.preimageFingerprint).toBe('aaaaaaaa')
    expect(ledger).toHaveLength(1)
    expect(events).toHaveLength(1)
  })

  it('is idempotent on repeat call with the same invocationId', async () => {
    const adapter = new L402Adapter()
    const ledger: L402LedgerEntry[] = []
    const events: L402SettlementEvent[] = []
    const deps: L402SettleDependencies = {
      rateFetcher: fixedRateFetcher(),
      now: () => 1_000_000,
      recordInvocation: (entry) => {
        ledger.push(entry)
      },
      onSettled: (e) => events.push(e),
    }
    const first = await adapter.settle(baseSettlement, deps)
    const second = await adapter.settle(baseSettlement, deps)
    expect(first.status).toBe('settled')
    expect(second.status).toBe('already-settled')
    expect(second.event).toEqual(first.event)
    expect(ledger).toHaveLength(1)
    expect(events).toHaveLength(1)
  })

  it('rolls back cache when recordInvocation throws', async () => {
    const adapter = new L402Adapter()
    const recordInvocation = vi
      .fn<(entry: L402LedgerEntry) => Promise<void>>()
      .mockRejectedValueOnce(new Error('ledger down'))
      .mockResolvedValue(undefined)
    await expect(
      adapter.settle(baseSettlement, {
        rateFetcher: fixedRateFetcher(),
        recordInvocation,
      }),
    ).rejects.toThrow('ledger down')
    const retried = await adapter.settle(baseSettlement, {
      rateFetcher: fixedRateFetcher(),
      recordInvocation,
    })
    expect(retried.status).toBe('settled')
    expect(recordInvocation).toHaveBeenCalledTimes(2)
  })

  it('rejects null invocation with TypeError', async () => {
    const adapter = new L402Adapter()
    await expect(
      // @ts-expect-error intentional null
      adapter.settle(null),
    ).rejects.toBeInstanceOf(TypeError)
  })

  it('rejects missing invocationId', async () => {
    const adapter = new L402Adapter()
    await expect(
      adapter.settle({ ...baseSettlement, invocationId: '' }),
    ).rejects.toThrow(/invocationId/)
  })

  it('rejects non-integer / negative amountMsat', async () => {
    const adapter = new L402Adapter()
    await expect(
      adapter.settle({
        ...baseSettlement,
        invocationId: 'inv_bad_amt_1',
        amountMsat: 1.5,
      }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      adapter.settle({
        ...baseSettlement,
        invocationId: 'inv_bad_amt_2',
        amountMsat: -1,
      }),
    ).rejects.toBeInstanceOf(RangeError)
  })

  it('throws when the rate fetcher returns a non-positive rate', async () => {
    const adapter = new L402Adapter()
    const badFetcher: BtcUsdRateFetcher = {
      fetchBtcUsdRate: () => Promise.resolve(0),
    }
    await expect(
      adapter.settle(
        { ...baseSettlement, invocationId: 'inv_bad_rate' },
        { rateFetcher: badFetcher },
      ),
    ).rejects.toThrow(/invalid BTC\/USD rate/)
  })

  it('omits optional event fields when input lacks them', async () => {
    const adapter = new L402Adapter()
    const result = await adapter.settle(
      {
        invocationId: 'inv_minimal',
        toolSlug: 'test-tool',
        amountMsat: 1000,
      },
      { rateFetcher: fixedRateFetcher(), now: () => 0 },
    )
    expect('externalAccountId' in result.event).toBe(false)
    expect('paymentHash' in result.event.data).toBe(false)
    expect('preimageFingerprint' in result.event.data).toBe(false)
    expect('macaroonId' in result.event.data).toBe(false)
  })

  it('respects an externally-supplied idempotencyStore', async () => {
    const store = new Map<string, L402SettleResult>()
    const a = new L402Adapter()
    const b = new L402Adapter()
    const events: L402SettlementEvent[] = []
    const r1 = await a.settle(baseSettlement, {
      rateFetcher: fixedRateFetcher(),
      idempotencyStore: store,
      onSettled: (e) => events.push(e),
    })
    const r2 = await b.settle(baseSettlement, {
      rateFetcher: fixedRateFetcher(),
      idempotencyStore: store,
      onSettled: (e) => events.push(e),
    })
    expect(r1.status).toBe('settled')
    expect(r2.status).toBe('already-settled')
    expect(events).toHaveLength(1)
  })
})

// ─── CoinGeckoRateFetcher (hostile audit rule b, default path) ───────────

describe('CoinGeckoRateFetcher — default live-rate source', () => {
  it('fetches + parses { bitcoin: { usd: N } } from the source', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ bitcoin: { usd: 95_000 } }), { status: 200 }),
    )
    const fetcher = new CoinGeckoRateFetcher({ fetchImpl: fetchMock })
    const rate = await fetcher.fetchBtcUsdRate()
    expect(rate).toBe(95_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches within the TTL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ bitcoin: { usd: 95_000 } }), { status: 200 }),
    )
    let nowValue = 0
    const fetcher = new CoinGeckoRateFetcher({
      fetchImpl: fetchMock,
      cacheTtlMs: 10_000,
      now: () => nowValue,
    })
    await fetcher.fetchBtcUsdRate()
    nowValue = 5_000 // within TTL
    await fetcher.fetchBtcUsdRate()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches after TTL expires', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ bitcoin: { usd: 95_000 } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ bitcoin: { usd: 110_000 } }), { status: 200 }),
      )
    let nowValue = 0
    const fetcher = new CoinGeckoRateFetcher({
      fetchImpl: fetchMock,
      cacheTtlMs: 10_000,
      now: () => nowValue,
    })
    const first = await fetcher.fetchBtcUsdRate()
    nowValue = 20_000 // past TTL
    const second = await fetcher.fetchBtcUsdRate()
    expect(first).toBe(95_000)
    expect(second).toBe(110_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws on HTTP errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('server error', { status: 500 }))
    const fetcher = new CoinGeckoRateFetcher({ fetchImpl: fetchMock })
    await expect(fetcher.fetchBtcUsdRate()).rejects.toThrow(/HTTP 500/)
  })

  it('throws on invalid rate (non-number / zero / negative)', async () => {
    for (const usd of [null, 'maybe', 0, -100]) {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ bitcoin: { usd } }), { status: 200 }),
      )
      const fetcher = new CoinGeckoRateFetcher({ fetchImpl: fetchMock })
      await expect(fetcher.fetchBtcUsdRate()).rejects.toThrow(/invalid USD rate/)
    }
  })
})

// ─── Integration test (hostile audit rule c — gated) ─────────────────────

describe('L402Adapter — Voltage integration', () => {
  const integrationEnabled =
    process.env.L402_INTEGRATION === 'true' &&
    typeof process.env.VOLTAGE_NODE_URL === 'string' &&
    typeof process.env.VOLTAGE_MACAROON === 'string'

  // Rule (c): gated so CI + default local `npm test` SKIP this test.
  // The condition combines the explicit L402_INTEGRATION toggle with
  // the presence of both Voltage env vars — forgetting to set either
  // env leaves the integration test inert instead of failing with a
  // connection error.
  it.skipIf(!integrationEnabled)(
    'mints a real invoice against the configured Voltage testnet node',
    async () => {
      const client = createVoltageClient({
        nodeUrl: process.env.VOLTAGE_NODE_URL as string,
        macaroon: process.env.VOLTAGE_MACAROON as string,
      })
      const invoice = await client.createInvoice(1000, {
        memo: 'SettleGrid P3.K2 integration test',
      })
      expect(invoice.paymentRequest).toMatch(/^lnbc/i)
      expect(invoice.paymentHash).toMatch(/^[0-9a-f]{64}$/)
      expect(invoice.amountMsat).toBe(1000)

      // Verify we can look the invoice back up.
      const fetched = await client.lookupInvoice(invoice.paymentHash)
      expect(fetched.paymentRequest).toBe(invoice.paymentRequest)
    },
    30_000,
  )
})
