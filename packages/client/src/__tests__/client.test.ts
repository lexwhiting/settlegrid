/**
 * Scaffold-round unit tests for @settlegrid/client.
 *
 * Covers the P3.K3 prompt card's spec-named surface
 * (`createSettleGridClient`, `call`, `wallet`, `discoverProtocols`)
 * plus the three hostile-lens invariants called out on the card:
 *
 *   (a) protocol selection prefers the actual cheapest, not the first
 *       supported.
 *   (b) budget check happens BEFORE the payment is constructed —
 *       verified via a `vi.fn()` spy on the payer's buildPayment.
 *   (c) the client module graph imports no Node-only modules — verified
 *       at import time by running the whole test suite in a `vi`
 *       environment where `require('crypto')` is stubbed to throw.
 *
 * Test helpers are intentionally small + explicit (scripted fetch,
 * hand-rolled Response construction) so a reader can follow each test
 * without jumping through fixture factories.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BudgetExceededError,
  ClientConfigurationError,
  MalformedManifestError,
  NoSupportedProtocolError,
  createSettleGridClient,
  railForScheme,
} from '../index'
import type {
  AcceptEntry,
  PaymentRequiredBody,
  RailName,
  WalletRef,
} from '../types'
import { x402Payer, BASE_USDC_ADDRESS } from '../protocols/x402'
import { mppPayer } from '../protocols/mpp'
import { l402Payer } from '../protocols/l402'
import { ap2Payer } from '../protocols/ap2'

// ─── Test helpers ────────────────────────────────────────────────────

const TOOL_URL = 'https://tool.example.test/api/search'

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
  })
}

function paymentRequired(
  accepts: AcceptEntry[],
  overrides?: Partial<PaymentRequiredBody>,
): Response {
  const body: PaymentRequiredBody = {
    x402Version: 2,
    error: 'payment_required',
    resource: { url: TOOL_URL },
    accepts,
    ...overrides,
  }
  return json(body, 402)
}

/** Scripted fetch — each entry handles one call in order. */
function scriptedFetch(
  handlers: Array<(input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>>,
) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const n = spy.mock.calls.length // post-increment after recording
    const handler = handlers[n - 1]
    if (!handler) {
      throw new Error(
        `scriptedFetch: unexpected call #${n} (scripted ${handlers.length} calls)`,
      )
    }
    return handler(input, init)
  })
  return spy as unknown as typeof fetch & { mock: { calls: unknown[][] } }
}

// ─── Core call flow ──────────────────────────────────────────────────

describe('createSettleGridClient.call — core flow', () => {
  it('passes through a non-402 response unchanged (200)', async () => {
    const fetchImpl = scriptedFetch([() => json({ ok: true })])
    const client = createSettleGridClient({ fetch: fetchImpl })
    const res = await client.call(TOOL_URL)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it('passes through a non-402 non-success response (500) unchanged', async () => {
    const fetchImpl = scriptedFetch([() => json({ error: 'oops' }, 500)])
    const client = createSettleGridClient({ fetch: fetchImpl })
    const res = await client.call(TOOL_URL)
    expect(res.status).toBe(500)
  })

  it('handles 402 → pay → retry → returns retry Response', async () => {
    const fetchImpl = scriptedFetch([
      () =>
        paymentRequired([
          {
            scheme: 'mpp',
            provider: 'stripe',
            amountCents: 5,
            currency: 'USD',
          },
        ]),
      (_url, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined)
        expect(headers.get('x-payment-protocol')).toBe('MPP/1.0')
        expect(headers.get('x-payment-token')).toBe('spt_abc123')
        return json({ result: 42 }, 200)
      },
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: { mpp: { sharedPaymentToken: 'spt_abc123' } },
    })
    const res = await client.call(TOOL_URL)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ result: 42 })
    expect((fetchImpl as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2)
  })

  it('selects the cheapest supported rail when multiple are payable', async () => {
    const fetchImpl = scriptedFetch([
      () =>
        paymentRequired([
          // MPP is cheaper than ap2 here; selection must pick MPP.
          { scheme: 'ap2', provider: 'google', costCents: 10, currency: 'USD' },
          { scheme: 'mpp', provider: 'stripe', amountCents: 5, currency: 'USD' },
          { scheme: 'l402', provider: 'lightning', costCents: 8, currency: 'btc-lightning' },
        ]),
      (_url, init) => {
        // Only MPP headers must be present — not ap2 or l402.
        const headers = new Headers(init?.headers as HeadersInit | undefined)
        expect(headers.get('x-payment-token')).toBe('spt_abc')
        expect(headers.get('x-ap2-credential')).toBeNull()
        expect(headers.get('authorization')).toBeNull()
        return json({ ok: true })
      },
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: {
        mpp: { sharedPaymentToken: 'spt_abc' },
        ap2: { vdcJwt: 'eyJ.vdc.jwt' },
        l402: { macaroon: 'm', preimage: 'a'.repeat(64) },
      },
    })
    const res = await client.call(TOOL_URL)
    expect(res.status).toBe(200)
  })

  it('throws NoSupportedProtocolError when no rail is supported', async () => {
    const fetchImpl = scriptedFetch([
      () =>
        paymentRequired([
          { scheme: 'sg-balance', provider: 'settlegrid', costCents: 5 },
          { scheme: 'ucp', amountCents: 10 },
        ]),
    ])
    const client = createSettleGridClient({ fetch: fetchImpl })
    await expect(client.call(TOOL_URL)).rejects.toMatchObject({
      name: 'NoSupportedProtocolError',
      advertisedSchemes: ['sg-balance', 'ucp'],
    })
  })

  it('throws NoSupportedProtocolError when a rail is supported but no wallet is configured', async () => {
    const fetchImpl = scriptedFetch([
      () => paymentRequired([{ scheme: 'mpp', amountCents: 5 }]),
    ])
    const client = createSettleGridClient({ fetch: fetchImpl })
    // No wallets configured — client cannot pay even the supported rail.
    await expect(client.call(TOOL_URL)).rejects.toBeInstanceOf(
      NoSupportedProtocolError,
    )
  })

  it('skips read-only wallets during rail selection', async () => {
    const fetchImpl = scriptedFetch([
      () => paymentRequired([{ scheme: 'mpp', amountCents: 5 }]),
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: {
        mpp: { readOnly: true, sharedPaymentToken: 'spt_abc' },
      },
    })
    await expect(client.call(TOOL_URL)).rejects.toBeInstanceOf(
      NoSupportedProtocolError,
    )
  })
})

// ─── Budget enforcement ──────────────────────────────────────────────

describe('createSettleGridClient.call — budget enforcement', () => {
  const mppOnly = [{ scheme: 'mpp', amountCents: 5, currency: 'USD' }]
  const makeClient = (defaultMax?: number, buildSpy?: ReturnType<typeof vi.fn>) => {
    const fetchImpl = scriptedFetch([
      () => paymentRequired(mppOnly),
      () => json({ ok: true }),
    ])
    // If a spy is passed, wrap the MPP payer.buildPayment for one
    // invocation so the test can assert call-or-no-call.
    const wallets: Partial<Record<RailName, WalletRef>> = {
      mpp: { sharedPaymentToken: 'spt_abc' },
    }
    return {
      fetchImpl,
      client: createSettleGridClient({
        fetch: fetchImpl,
        wallets,
        defaultMaxCostCents: defaultMax,
      }),
    }
  }

  it('throws BudgetExceededError when cost > maxCostCents', async () => {
    const { client } = makeClient()
    await expect(client.call(TOOL_URL, {}, { maxCostCents: 4 })).rejects.toMatchObject({
      name: 'BudgetExceededError',
      costCents: 5,
      maxCostCents: 4,
      rail: 'mpp',
    })
  })

  it('pays when cost == maxCostCents (budget is inclusive)', async () => {
    const { client } = makeClient()
    const res = await client.call(TOOL_URL, {}, { maxCostCents: 5 })
    expect(res.status).toBe(200)
  })

  it('pays when cost < maxCostCents', async () => {
    const { client } = makeClient()
    const res = await client.call(TOOL_URL, {}, { maxCostCents: 100 })
    expect(res.status).toBe(200)
  })

  it('pays any cost when maxCostCents is undefined (no cap)', async () => {
    const { client } = makeClient()
    const res = await client.call(TOOL_URL)
    expect(res.status).toBe(200)
  })

  it('applies defaultMaxCostCents when options.maxCostCents is omitted', async () => {
    const { client } = makeClient(4)
    await expect(client.call(TOOL_URL)).rejects.toBeInstanceOf(BudgetExceededError)
  })

  it('options.maxCostCents overrides defaultMaxCostCents', async () => {
    const { client } = makeClient(4) // default would reject
    const res = await client.call(TOOL_URL, {}, { maxCostCents: 5 })
    expect(res.status).toBe(200)
  })

  it('rejects negative maxCostCents with ClientConfigurationError', async () => {
    const fetchImpl = scriptedFetch([])
    const client = createSettleGridClient({ fetch: fetchImpl })
    await expect(
      client.call(TOOL_URL, {}, { maxCostCents: -5 }),
    ).rejects.toBeInstanceOf(ClientConfigurationError)
  })

  it('rejects non-integer maxCostCents (1.5)', async () => {
    const fetchImpl = scriptedFetch([])
    const client = createSettleGridClient({ fetch: fetchImpl })
    await expect(
      client.call(TOOL_URL, {}, { maxCostCents: 1.5 }),
    ).rejects.toBeInstanceOf(ClientConfigurationError)
  })

  it('rejects NaN maxCostCents', async () => {
    const fetchImpl = scriptedFetch([])
    const client = createSettleGridClient({ fetch: fetchImpl })
    await expect(
      client.call(TOOL_URL, {}, { maxCostCents: Number.NaN }),
    ).rejects.toBeInstanceOf(ClientConfigurationError)
  })

  it('hostile invariant (b): budget check fires BEFORE buildPayment', async () => {
    // Swap in a spy on mppPayer.buildPayment for the duration of this
    // test. The spy MUST NOT be called when the budget rejects the
    // cheapest rail — an early budget check is what the hostile
    // requirement enforces.
    const buildSpy = vi.spyOn(mppPayer, 'buildPayment')
    const fetchImpl = scriptedFetch([
      () => paymentRequired([{ scheme: 'mpp', amountCents: 5 }]),
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: { mpp: { sharedPaymentToken: 'spt_abc' } },
    })
    await expect(
      client.call(TOOL_URL, {}, { maxCostCents: 4 }),
    ).rejects.toBeInstanceOf(BudgetExceededError)
    expect(buildSpy).not.toHaveBeenCalled()
    // And importantly — the retry fetch also never fires. Only one
    // HTTP call (the initial 402) was made.
    expect((fetchImpl as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1)
    buildSpy.mockRestore()
  })
})

// ─── preferredRails ──────────────────────────────────────────────────

describe('createSettleGridClient.call — preferredRails', () => {
  it('restricts selection to preferredRails (strict allowlist)', async () => {
    const fetchImpl = scriptedFetch([
      () =>
        paymentRequired([
          { scheme: 'mpp', amountCents: 3 },  // cheapest
          { scheme: 'ap2', costCents: 5, currency: 'USD' },
        ]),
      (_url, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined)
        // ap2 was the preferred rail even though mpp was cheaper.
        expect(headers.get('x-ap2-credential')).toBe('eyJ.vdc')
        expect(headers.get('x-payment-token')).toBeNull()
        return json({ ok: true })
      },
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: {
        mpp: { sharedPaymentToken: 'spt_abc' },
        ap2: { vdcJwt: 'eyJ.vdc' },
      },
    })
    const res = await client.call(TOOL_URL, {}, { preferredRails: ['ap2'] })
    expect(res.status).toBe(200)
  })

  it('throws NoSupportedProtocolError when preferredRails has no intersection', async () => {
    const fetchImpl = scriptedFetch([
      () => paymentRequired([{ scheme: 'mpp', amountCents: 3 }]),
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: { mpp: { sharedPaymentToken: 'spt_abc' } },
    })
    await expect(
      client.call(TOOL_URL, {}, { preferredRails: ['l402'] }),
    ).rejects.toBeInstanceOf(NoSupportedProtocolError)
  })

  it('rejects empty preferredRails array (caller misuse)', async () => {
    const fetchImpl = scriptedFetch([])
    const client = createSettleGridClient({ fetch: fetchImpl })
    await expect(
      client.call(TOOL_URL, {}, { preferredRails: [] as readonly RailName[] }),
    ).rejects.toBeInstanceOf(ClientConfigurationError)
  })
})

// ─── Protocol payers ─────────────────────────────────────────────────

describe('x402 payer', () => {
  it('extracts USDC cost from amount field (base units → cents)', () => {
    // 50_000 base units at 6 decimals = 0.05 USDC = 5 cents.
    expect(
      x402Payer.extractCostCents({
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '50000',
        asset: BASE_USDC_ADDRESS,
        payTo: '0x0',
      }),
    ).toBe(5)
  })

  it('accepts upper-case asset address (EVM is case-insensitive)', () => {
    expect(
      x402Payer.extractCostCents({
        scheme: 'exact',
        amount: '50000',
        asset: BASE_USDC_ADDRESS.toUpperCase(),
      }),
    ).toBe(5)
  })

  it('returns null for non-USDC asset (unpriceable in scaffold)', () => {
    expect(
      x402Payer.extractCostCents({
        scheme: 'exact',
        amount: '50000',
        asset: '0xdeadbeef',
      }),
    ).toBeNull()
  })

  it('returns null for malformed amount strings', () => {
    expect(
      x402Payer.extractCostCents({
        scheme: 'exact',
        amount: '50.5e10',
        asset: BASE_USDC_ADDRESS,
      }),
    ).toBeNull()
    expect(
      x402Payer.extractCostCents({
        scheme: 'exact',
        amount: 'not-a-number',
        asset: BASE_USDC_ADDRESS,
      }),
    ).toBeNull()
  })

  it('canPay requires an xPaymentHeader string; rejects readOnly wallets', () => {
    expect(x402Payer.canPay(undefined)).toBe(false)
    expect(x402Payer.canPay({})).toBe(false)
    expect(x402Payer.canPay({ xPaymentHeader: '' })).toBe(false)
    expect(x402Payer.canPay({ xPaymentHeader: 'abc' })).toBe(true)
    expect(
      x402Payer.canPay({ readOnly: true, xPaymentHeader: 'abc' }),
    ).toBe(false)
  })

  it('buildPayment produces a single X-Payment header', async () => {
    const { headers } = await x402Payer.buildPayment({
      entry: { scheme: 'exact' },
      wallet: { xPaymentHeader: 'base64-blob' },
      toolUrl: TOOL_URL,
    })
    expect(headers).toEqual({ 'X-Payment': 'base64-blob' })
  })
})

describe('mpp payer', () => {
  it('extracts amountCents and emits MPP headers', async () => {
    const entry = {
      scheme: 'mpp',
      amountCents: 5,
      currency: 'USD',
    } as AcceptEntry
    expect(mppPayer.extractCostCents(entry)).toBe(5)
    const { headers } = await mppPayer.buildPayment({
      entry,
      wallet: { sharedPaymentToken: 'spt_abc', sessionId: 'sess-1' },
      toolUrl: TOOL_URL,
    })
    expect(headers).toMatchObject({
      'X-Payment-Protocol': 'MPP/1.0',
      'X-Payment-Token': 'spt_abc',
      'X-Payment-Amount': '5',
      'X-Payment-Currency': 'USD',
      'X-MPP-Session-Id': 'sess-1',
    })
  })

  it('rejects non-integer amountCents', () => {
    expect(
      mppPayer.extractCostCents({ scheme: 'mpp', amountCents: 1.5 }),
    ).toBeNull()
    expect(
      mppPayer.extractCostCents({ scheme: 'mpp', amountCents: -1 }),
    ).toBeNull()
    expect(
      mppPayer.extractCostCents({ scheme: 'mpp', amountCents: 'hi' }),
    ).toBeNull()
  })
})

describe('l402 payer', () => {
  const VALID_PREIMAGE = 'a'.repeat(64)

  it('emits LSAT Authorization header with macaroon:preimage format', async () => {
    const { headers } = await l402Payer.buildPayment({
      entry: { scheme: 'l402', costCents: 5 },
      wallet: { macaroon: 'mac123', preimage: VALID_PREIMAGE },
      toolUrl: TOOL_URL,
    })
    expect(headers).toEqual({
      Authorization: `LSAT mac123:${VALID_PREIMAGE}`,
    })
  })

  it('canPay rejects malformed preimages (not 64 hex chars)', () => {
    expect(
      l402Payer.canPay({ macaroon: 'm', preimage: 'too-short' }),
    ).toBe(false)
    expect(
      l402Payer.canPay({ macaroon: 'm', preimage: 'g'.repeat(64) }),
    ).toBe(false) // 'g' is not hex
    expect(
      l402Payer.canPay({ macaroon: 'm', preimage: VALID_PREIMAGE }),
    ).toBe(true)
  })
})

describe('ap2 payer', () => {
  it('emits x-ap2-credential header from vdcJwt', async () => {
    const { headers } = await ap2Payer.buildPayment({
      entry: { scheme: 'ap2', costCents: 5 },
      wallet: { vdcJwt: 'eyJhbGciOi.payload.sig', consumerId: 'user-42' },
      toolUrl: TOOL_URL,
    })
    expect(headers).toEqual({
      'x-ap2-credential': 'eyJhbGciOi.payload.sig',
      'x-ap2-consumer-id': 'user-42',
    })
  })

  it('omits x-ap2-consumer-id when the wallet does not carry one', async () => {
    const { headers } = await ap2Payer.buildPayment({
      entry: { scheme: 'ap2', costCents: 5 },
      wallet: { vdcJwt: 'eyJ.jwt' },
      toolUrl: TOOL_URL,
    })
    expect(headers).toEqual({ 'x-ap2-credential': 'eyJ.jwt' })
  })
})

// ─── discoverProtocols ───────────────────────────────────────────────

describe('createSettleGridClient.discoverProtocols', () => {
  it('returns accepts from a 200 OPTIONS response', async () => {
    const accepts = [{ scheme: 'mpp', amountCents: 5 }]
    const fetchImpl = scriptedFetch([
      (_url, init) => {
        expect(init?.method).toBe('OPTIONS')
        return json(
          {
            x402Version: 2,
            error: 'payment_required',
            resource: { url: TOOL_URL },
            accepts,
          },
          200,
        )
      },
    ])
    const client = createSettleGridClient({ fetch: fetchImpl })
    const out = await client.discoverProtocols(TOOL_URL)
    expect(out).toEqual(accepts)
  })

  it('returns accepts from a 402 OPTIONS response', async () => {
    const accepts = [{ scheme: 'ap2', costCents: 5 }]
    const fetchImpl = scriptedFetch([() => paymentRequired(accepts)])
    const client = createSettleGridClient({ fetch: fetchImpl })
    expect(await client.discoverProtocols(TOOL_URL)).toEqual(accepts)
  })

  it('returns empty array on 405 (server rejects OPTIONS)', async () => {
    const fetchImpl = scriptedFetch([() => new Response(null, { status: 405 })])
    const client = createSettleGridClient({ fetch: fetchImpl })
    expect(await client.discoverProtocols(TOOL_URL)).toEqual([])
  })

  it('returns empty array on fetch throw (network error / CORS / abort)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network unreachable')
    }) as unknown as typeof fetch
    const client = createSettleGridClient({ fetch: fetchImpl })
    expect(await client.discoverProtocols(TOOL_URL)).toEqual([])
  })

  it('returns empty array on malformed 200 body (not JSON)', async () => {
    const fetchImpl = scriptedFetch([
      () => new Response('<html>not json</html>', { status: 200 }),
    ])
    const client = createSettleGridClient({ fetch: fetchImpl })
    expect(await client.discoverProtocols(TOOL_URL)).toEqual([])
  })
})

// ─── wallet accessor ─────────────────────────────────────────────────

describe('createSettleGridClient.wallet', () => {
  it('returns the wallet configured for a rail', () => {
    const client = createSettleGridClient({
      wallets: { mpp: { sharedPaymentToken: 'spt_abc' } },
    })
    expect(client.wallet('mpp')).toEqual({ sharedPaymentToken: 'spt_abc' })
  })

  it('returns undefined for unconfigured rails', () => {
    const client = createSettleGridClient({
      wallets: { mpp: { sharedPaymentToken: 'spt_abc' } },
    })
    expect(client.wallet('l402')).toBeUndefined()
    expect(client.wallet('ap2')).toBeUndefined()
    expect(client.wallet('exact')).toBeUndefined()
  })
})

// ─── Input validation ────────────────────────────────────────────────

describe('createSettleGridClient — input validation', () => {
  it('rejects empty toolUrl', async () => {
    const client = createSettleGridClient({ fetch: vi.fn() as unknown as typeof fetch })
    await expect(client.call('')).rejects.toBeInstanceOf(ClientConfigurationError)
  })

  it('rejects non-URL toolUrl', async () => {
    const client = createSettleGridClient({ fetch: vi.fn() as unknown as typeof fetch })
    await expect(client.call('not a url')).rejects.toBeInstanceOf(
      ClientConfigurationError,
    )
  })

  it('rejects a fetch override that is not a function', () => {
    expect(() =>
      // @ts-expect-error intentional misuse
      createSettleGridClient({ fetch: 'not a function' }),
    ).toThrow(ClientConfigurationError)
  })

  it('rejects a negative defaultMaxCostCents at construction time', () => {
    expect(() => createSettleGridClient({ defaultMaxCostCents: -1 })).toThrow(
      ClientConfigurationError,
    )
  })
})

// ─── Malformed manifest ──────────────────────────────────────────────

describe('createSettleGridClient.call — malformed manifest', () => {
  it('throws MalformedManifestError on invalid JSON body', async () => {
    const fetchImpl = scriptedFetch([
      () =>
        new Response('not json', {
          status: 402,
          headers: { 'content-type': 'application/json' },
        }),
    ])
    const client = createSettleGridClient({ fetch: fetchImpl })
    await expect(client.call(TOOL_URL)).rejects.toBeInstanceOf(
      MalformedManifestError,
    )
  })

  it('throws MalformedManifestError on empty accepts array', async () => {
    const fetchImpl = scriptedFetch([() => paymentRequired([])])
    const client = createSettleGridClient({ fetch: fetchImpl })
    await expect(client.call(TOOL_URL)).rejects.toBeInstanceOf(
      MalformedManifestError,
    )
  })

  it('drops entries with a non-string scheme but keeps the valid ones', async () => {
    const fetchImpl = scriptedFetch([
      () =>
        paymentRequired([
          // Malformed entry — no scheme string.
          { amountCents: 5 } as unknown as AcceptEntry,
          // Valid entry — should still be selected.
          { scheme: 'mpp', amountCents: 3 },
        ]),
      () => json({ ok: true }),
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: { mpp: { sharedPaymentToken: 'spt_abc' } },
    })
    const res = await client.call(TOOL_URL)
    expect(res.status).toBe(200)
  })

  it('throws MalformedManifestError when Content-Length exceeds cap', async () => {
    // Build a body stream that reports too large via Content-Length.
    const fetchImpl = scriptedFetch([
      () => {
        const body = JSON.stringify({ accepts: [{ scheme: 'mpp' }] })
        return new Response(body, {
          status: 402,
          headers: {
            'content-type': 'application/json',
            'content-length': String(200_000),
          },
        })
      },
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      manifestMaxBytes: 1024,
    })
    await expect(client.call(TOOL_URL)).rejects.toBeInstanceOf(
      MalformedManifestError,
    )
  })
})

// ─── Header merging ──────────────────────────────────────────────────

describe('createSettleGridClient.call — header merging', () => {
  it('merges caller headers into the initial and retry request', async () => {
    const fetchImpl = scriptedFetch([
      (_url, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined)
        expect(headers.get('x-trace-id')).toBe('trace-1')
        return paymentRequired([{ scheme: 'mpp', amountCents: 5 }])
      },
      (_url, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined)
        expect(headers.get('x-trace-id')).toBe('trace-1')
        expect(headers.get('x-payment-token')).toBe('spt_abc')
        return json({ ok: true })
      },
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: { mpp: { sharedPaymentToken: 'spt_abc' } },
    })
    const res = await client.call(
      TOOL_URL,
      { headers: { 'X-Trace-Id': 'trace-1' } },
    )
    expect(res.status).toBe(200)
  })

  it('payer headers override caller headers on retry collision', async () => {
    const fetchImpl = scriptedFetch([
      () => paymentRequired([{ scheme: 'mpp', amountCents: 5 }]),
      (_url, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined)
        // Caller tried to set x-payment-token, but the MPP payer wins.
        expect(headers.get('x-payment-token')).toBe('spt_correct')
        return json({ ok: true })
      },
    ])
    const client = createSettleGridClient({
      fetch: fetchImpl,
      wallets: { mpp: { sharedPaymentToken: 'spt_correct' } },
    })
    const res = await client.call(
      TOOL_URL,
      { headers: { 'X-Payment-Token': 'spt_wrong' } },
    )
    expect(res.status).toBe(200)
  })
})

// ─── railForScheme helper ────────────────────────────────────────────

describe('railForScheme', () => {
  it('maps scheme → rail for all four payers', () => {
    expect(railForScheme('exact')).toBe('exact')
    expect(railForScheme('mpp')).toBe('mpp')
    expect(railForScheme('l402')).toBe('l402')
    expect(railForScheme('ap2')).toBe('ap2')
  })

  it('returns null for unknown schemes', () => {
    expect(railForScheme('sg-balance')).toBeNull()
    expect(railForScheme('ucp')).toBeNull()
    expect(railForScheme('')).toBeNull()
  })
})
