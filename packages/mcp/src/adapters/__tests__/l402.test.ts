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
import { createHash, createHmac } from 'crypto'
import type { AcceptEntry, BuildChallengeOptions } from '../../402-builder'
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

/**
 * Craft a macaroon with caller-chosen caveats, signed with the given
 * key. Used by hostile tests that need macaroons with deliberately
 * malformed caveat values — the HMAC signature is valid, but the
 * value strings bypass the usual shape guarantees that
 * `mintMacaroon` enforces at mint time.
 */
function craftSignedMacaroon(
  signingKey: string,
  payload: {
    id: string
    location: string
    caveats: Array<{ key: string; value: string }>
  },
): string {
  let signature = createHmac('sha256', signingKey)
    .update(payload.id)
    .digest('hex')
  for (const caveat of payload.caveats) {
    signature = createHmac('sha256', signature)
      .update(`${caveat.key}=${caveat.value}`)
      .digest('hex')
  }
  const envelope = {
    id: payload.id,
    location: payload.location,
    caveats: payload.caveats,
    signature,
  }
  return Buffer.from(JSON.stringify(envelope)).toString('base64')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── streamTextCapped ─────────────────────────────────────────────────────

describe('streamTextCapped', () => {
  it('returns empty string on null body', async () => {
    const { streamTextCapped } = await import('../lightning/voltage')
    const response = new Response(null, { status: 200 })
    const text = await streamTextCapped(response, 1024)
    expect(text).toBe('')
  })

  it('reads a normal-sized body through to completion', async () => {
    const { streamTextCapped } = await import('../lightning/voltage')
    const response = new Response('{"hello":"world"}', { status: 200 })
    const text = await streamTextCapped(response, 1024)
    expect(text).toBe('{"hello":"world"}')
  })

  it('rejects up front when Content-Length > cap (fast-path)', async () => {
    const { streamTextCapped } = await import('../lightning/voltage')
    const response = new Response('short-body', {
      status: 200,
      headers: { 'content-length': '99999' },
    })
    await expect(streamTextCapped(response, 1024)).rejects.toThrow(
      /Content-Length.*exceeds 1024-byte cap/,
    )
  })
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

  it('H8: rejects oversize bodies even when Content-Length is absent (streaming cap)', async () => {
    // The Content-Length fast-path catches honest upstreams. A
    // hostile / misconfigured upstream that chunk-encodes without
    // Content-Length would bypass that check. The streaming cap in
    // streamTextCapped must halt the read once the running total
    // crosses VOLTAGE_MAX_BODY_BYTES, regardless of Content-Length.
    const encoder = new TextEncoder()
    const oversizeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Emit two chunks whose total exceeds the cap; first fits,
        // second crosses it. After the second enqueue the reader
        // in streamTextCapped should abort.
        controller.enqueue(encoder.encode('A'.repeat(VOLTAGE_MAX_BODY_BYTES)))
        controller.enqueue(encoder.encode('B'.repeat(16)))
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(
      // No Content-Length header — Response.body stream is the only
      // signal of size.
      new Response(oversizeStream, { status: 200 }),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(
      /exceeds.*cap.*during stream/,
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

  it('normalizeInvoice: accepts `r_hash_str` form (LND ≥ 0.15 hex)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc1000n1ptest',
          r_hash_str: REAL_PAYMENT_HASH,
          value_msat: '1000',
          expiry: '3600',
          creation_date: '1700000000',
          settled: false,
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    const invoice = await client.createInvoice(1000)
    expect(invoice.paymentHash).toBe(REAL_PAYMENT_HASH)
    expect(invoice.paymentRequest).toBe('lnbc1000n1ptest')
    expect(invoice.amountMsat).toBe(1000)
    expect(invoice.expirySeconds).toBe(3600)
    expect(invoice.creationDate).toBe(1_700_000_000)
    expect(invoice.settled).toBe(false)
  })

  it('normalizeInvoice: accepts `r_hash` base64 form (LND POST response)', async () => {
    // LND's POST /v1/invoices returns r_hash as base64 (not hex).
    // The client must decode base64 → 32 bytes → hex.
    const hashBase64 = Buffer.from(REAL_PAYMENT_HASH, 'hex').toString('base64')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc1000n1ptest',
          r_hash: hashBase64,
          value_msat: '1000',
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    const invoice = await client.createInvoice(1000)
    expect(invoice.paymentHash).toBe(REAL_PAYMENT_HASH)
  })

  it('normalizeInvoice: accepts `r_hash` hex form (LND GET response)', async () => {
    // LND's GET /v1/invoice/{hash} returns r_hash already as hex.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc1000n1ptest',
          r_hash: REAL_PAYMENT_HASH,
          value_msat: '1000',
          settled: true,
          settle_date: '1700000100',
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    const invoice = await client.lookupInvoice(REAL_PAYMENT_HASH)
    expect(invoice.paymentHash).toBe(REAL_PAYMENT_HASH)
    expect(invoice.settled).toBe(true)
    expect(invoice.settleDate).toBe(1_700_000_100)
  })

  it('normalizeInvoice: falls back from value_msat to `value` (sats-only nodes)', async () => {
    // Older LND or minimally-configured nodes emit `value` (sats)
    // instead of `value_msat`. Adapter must multiply by 1000.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc...',
          r_hash_str: REAL_PAYMENT_HASH,
          value: '5', // 5 sats = 5000 msat
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    const invoice = await client.lookupInvoice(REAL_PAYMENT_HASH)
    expect(invoice.amountMsat).toBe(5000)
  })

  it('normalizeInvoice: throws on missing payment_request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          r_hash_str: REAL_PAYMENT_HASH,
          value_msat: '1000',
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(/payment_request/)
  })

  it('normalizeInvoice: throws on missing r_hash', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc...',
          value_msat: '1000',
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(/r_hash/)
  })

  it('normalizeInvoice: throws on missing amount fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc...',
          r_hash_str: REAL_PAYMENT_HASH,
          // neither value_msat nor value supplied
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    // lookupInvoice doesn't pass expectedAmountMsat, so it throws on
    // the amount-extraction failure itself rather than on a mismatch.
    await expect(client.lookupInvoice(REAL_PAYMENT_HASH)).rejects.toThrow(/value_msat/)
  })

  it('normalizeInvoice: throws when server returns a different amount than requested', async () => {
    // createInvoice passes expectedAmountMsat; if the server returns
    // a different value, refuse silently drift.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc...',
          r_hash_str: REAL_PAYMENT_HASH,
          value_msat: '2000', // requested 1000
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(/amountMsat=2000.*expected 1000/)
  })

  it('createInvoice: sends value_msat + memo + expiry in the POST body', async () => {
    // Regression guard for the body-shape on the Voltage POST.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          payment_request: 'lnbc...',
          r_hash_str: REAL_PAYMENT_HASH,
          value_msat: '2500',
        }),
        { status: 200 },
      ),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await client.createInvoice(2500, { memo: 'test-memo', expirySeconds: 600 })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, string>
    expect(body.value_msat).toBe('2500')
    expect(body.memo).toBe('test-memo')
    expect(body.expiry).toBe('600')
  })

  it('httpFetch: surfaces HTTP error status + body text on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"error":"invalid macaroon"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'bad',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(
      /HTTP 401.*invalid macaroon/,
    )
  })

  it('httpFetch: throws on empty response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(/empty body/)
  })

  it('httpFetch: throws on non-JSON response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('this is not json', { status: 200 }),
    )
    const client = createVoltageClient({
      nodeUrl: 'https://voltage.test',
      macaroon: 'abc',
      fetchImpl: fetchMock,
    })
    await expect(client.createInvoice(1000)).rejects.toThrow(/non-JSON body/)
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

  it('H38: tolerates leading/trailing whitespace in the env value', () => {
    // Env-file parsers and CI pipelines commonly introduce whitespace.
    // A `'  voltage  '` env value must resolve to 'voltage', not throw.
    expect(resolveLightningBackend('  voltage  ')).toBe('voltage')
    expect(resolveLightningBackend('\tlnd\n')).toBe('lnd')
    expect(resolveLightningBackend('   ')).toBe('voltage') // all-whitespace → default
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

  it('H16: does NOT match WWW-Authenticate where "L402" appears inside a non-L402 scheme', async () => {
    // A Basic-auth realm containing the string "L402" must not
    // false-positive as an L402 challenge. The tightened regex only
    // matches `L402` as the scheme token at the start of a comma-
    // separated challenge entry.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'WWW-Authenticate': 'Basic realm="L402 Management Console"' },
    })
    const r = await adapter.detect(req)
    expect(r.confidence).toBe(0)
    expect(r.reasons.some((x) => x.includes('L402'))).toBe(false)
  })

  it('H16: matches L402 when it appears as a non-first scheme in a multi-challenge header', async () => {
    // RFC 7235 allows multiple comma-separated challenges.
    // `Basic ..., L402 ...` is legitimate: L402 is offered alongside
    // another scheme. The split-and-test approach must detect it.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'WWW-Authenticate': 'Basic realm="fallback", L402 macaroon="abc"',
      },
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
        costCents: 5,
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
        costCents: 5,
      }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      adapter.buildChallenge({
        toolSlug: 'test',
        amountMsat: 1.5,
        signingKey: SIGNING_KEY,
        lightningClient: client,
        costCents: 5,
      }),
    ).rejects.toBeInstanceOf(RangeError)
  })

  it('H20: throws RangeError when costCents is omitted at runtime', async () => {
    // The TS type is now required, but runtime callers (or consumers
    // that cast through `any`) must still be rejected cleanly.
    const client = mockVoltageClient()
    const badOptions = {
      toolSlug: 'test',
      amountMsat: 1000,
      signingKey: SIGNING_KEY,
      lightningClient: client,
      // costCents intentionally omitted
    } as unknown as L402ChallengeOptions
    await expect(adapter.buildChallenge(badOptions)).rejects.toBeInstanceOf(
      RangeError,
    )
  })

  it('H20: throws RangeError on non-integer / negative costCents', async () => {
    const client = mockVoltageClient()
    await expect(
      adapter.buildChallenge({
        toolSlug: 'test',
        amountMsat: 1000,
        signingKey: SIGNING_KEY,
        lightningClient: client,
        costCents: 1.5,
      }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      adapter.buildChallenge({
        toolSlug: 'test',
        amountMsat: 1000,
        signingKey: SIGNING_KEY,
        lightningClient: client,
        costCents: -5,
      }),
    ).rejects.toBeInstanceOf(RangeError)
  })

  it('H19: falls through to AcceptEntry path when lightningClient lacks createInvoice', () => {
    // Before the fix, a `{ lightningClient: {} }` that passed the
    // "object" check would dispatch to `buildL402Challenge` and throw
    // `TypeError: not a function` deep inside. After the fix, dispatch
    // REQUIRES `lightningClient.createInvoice` to be a function;
    // otherwise it falls through to the synchronous AcceptEntry path
    // so the kernel's 402 manifest still gets a valid entry.
    const badOptions = {
      resource: { url: 'https://tool.example' },
      pricing: { defaultCostCents: 5 },
      lightningClient: { notCreateInvoice: () => undefined },
    } as unknown as BuildChallengeOptions
    const result = adapter.buildChallenge(badOptions) as unknown as AcceptEntry
    // Sync return — dispatch DID NOT route to the async envelope path.
    expect(result).not.toBeInstanceOf(Promise)
    expect(result.scheme).toBe('l402')
    expect(result.costCents).toBe(5)
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

  it('H22: rejects a crafted macaroon whose amount_cents caveat is unparseable', async () => {
    // Craft a valid-HMAC macaroon with a non-integer amount_cents.
    // The macaroon was correctly signed; the caveat value is the
    // hostile input. Before the H22 fix, `Number.isFinite(NaN)` was
    // false so the equality check was skipped, and the macaroon
    // validated against the tool's costCents bypassing amount
    // enforcement. After the fix, the caveat regex `/^\d+$/` rejects
    // non-digit values with L402_CAVEAT_VIOLATION.
    const craftedMacaroon = craftSignedMacaroon(SIGNING_KEY, {
      id: 'a'.repeat(32),
      location: 'test',
      caveats: [
        { key: 'service', value: `settlegrid:${TOOL_CONFIG.slug}` },
        { key: 'amount_sats', value: '100' },
        { key: 'amount_cents', value: 'abc' }, // NOT a digit string
        { key: 'expires_at', value: String(Math.floor(Date.now() / 1000) + 3600) },
        { key: 'created_at', value: String(Math.floor(Date.now() / 1000)) },
        { key: 'payment_hash', value: REAL_PAYMENT_HASH },
      ],
    })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: `L402 ${craftedMacaroon}:${REAL_PREIMAGE}` },
    })
    const result = await adapter.verifyPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
    })
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('L402_CAVEAT_VIOLATION')
    expect(result.error?.message).toMatch(/not a non-negative integer/i)
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

  it('falls back to length-check when the macaroon has no payment_hash caveat (legacy)', async () => {
    // Macaroons minted by pre-P3.K2 code (or by external tooling)
    // lack the `payment_hash` caveat. verifyPayment must NOT reject
    // them — it falls back to the existing length-check on the
    // preimage format (`validateL402Payment`) and logs a warning so
    // ops can grep for affected flows.
    //
    // Craft a macaroon without a payment_hash caveat (HMAC-signed),
    // present with any correctly-formatted preimage, and assert
    // valid=true.
    const now = Math.floor(Date.now() / 1000)
    const legacyMacaroon = craftSignedMacaroon(SIGNING_KEY, {
      id: 'c'.repeat(32),
      location: 'test',
      caveats: [
        { key: 'service', value: `settlegrid:${TOOL_CONFIG.slug}` },
        { key: 'amount_sats', value: '100' },
        { key: 'amount_cents', value: String(TOOL_CONFIG.costCents) },
        { key: 'expires_at', value: String(now + 3600) },
        { key: 'created_at', value: String(now) },
        // payment_hash caveat intentionally omitted
      ],
    })
    const warnSpy = vi.fn()
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { authorization: `L402 ${legacyMacaroon}:${REAL_PREIMAGE}` },
    })
    const result = await adapter.verifyPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      signingKey: SIGNING_KEY,
      logger: { info: vi.fn(), warn: warnSpy, error: vi.fn() },
    })
    expect(result.valid).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      'l402.macaroon_missing_payment_hash_caveat',
      expect.objectContaining({ macaroonId: 'c'.repeat(32) }),
    )
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

  it('H23: refuses to settle when amountMsat × btcUsdRate would exceed Number.MAX_SAFE_INTEGER', async () => {
    // Extreme input: amountMsat at the top of the safe-integer range
    // with any positive rate > 1. The intermediate product
    // (amountMsat × btcUsdRate) would lose precision before Math.ceil
    // even looked at it, so settle() must refuse up front rather than
    // silently emit a wrong fiatCents.
    const adapter = new L402Adapter()
    await expect(
      adapter.settle(
        {
          invocationId: 'inv_overflow',
          toolSlug: 'test-tool',
          amountMsat: Number.MAX_SAFE_INTEGER,
        },
        { rateFetcher: fixedRateFetcher(100_000) },
      ),
    ).rejects.toThrow(/MAX_SAFE_INTEGER/)
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

  it('throws on missing `bitcoin` key in response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ethereum: { usd: 2000 } }), { status: 200 }),
    )
    const fetcher = new CoinGeckoRateFetcher({ fetchImpl: fetchMock })
    await expect(fetcher.fetchBtcUsdRate()).rejects.toThrow(/missing.*bitcoin/i)
  })

  it('throws on non-object JSON response (array, string, null)', async () => {
    for (const bad of ['[1,2,3]', '"oops"', 'null']) {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(bad, { status: 200 }),
      )
      const fetcher = new CoinGeckoRateFetcher({ fetchImpl: fetchMock })
      await expect(fetcher.fetchBtcUsdRate()).rejects.toThrow(/non-object/i)
    }
  })

  it('rejects an oversize response body via the streaming cap', async () => {
    // Even if Content-Length is absent, the streaming cap in
    // streamTextCapped must halt before memory amplifies past 1 KiB.
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('A'.repeat(2048)))
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, { status: 200 }),
    )
    const fetcher = new CoinGeckoRateFetcher({ fetchImpl: fetchMock })
    await expect(fetcher.fetchBtcUsdRate()).rejects.toThrow(/exceeds 1024-byte cap/)
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
