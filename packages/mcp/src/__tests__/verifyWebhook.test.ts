/**
 * P3.K4 — verifyWebhook + tool-secret + ledger + pricing unit tests.
 *
 * Covers the three K4 deliverables:
 *   - Tool-secret sign/verify + rotation grace window (≤60s per the
 *     card's hostile requirement c).
 *   - verifyWebhook HTTP-level integration (header parsing, body
 *     capping, timestamp tolerance, signature mismatch).
 *   - recordLedgerEntry field validation + fingerprint stability.
 *   - resolveRailFee tier selection + currency surcharge.
 *
 * Tests are pure unit — the LedgerWriter is a mock that captures
 * entries into an array. No DB touched.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  // Tool secret
  generateToolSecret,
  isValidToolSecretShape,
  signPayload,
  verifyPayloadSignature,
  rotateToolSecret,
  verifyWithRotation,
  TOOL_SECRET_HEX_LENGTH,
  ROTATION_GRACE_SEC,
  // Webhook
  verifyWebhook,
  SETTLEGRID_SIGNATURE_HEADER,
  // Ledger
  recordLedgerEntry,
  fingerprintLedgerEntry,
  LEDGER_ENTRY_METADATA_MAX_BYTES,
  type LedgerEntry,
  // Pricing
  resolveRailFee,
  buildPricingResponseHeaders,
  type RailPricingRateCard,
  type ResolvedRailFee,
} from '../index'

// ─── Tool secret: generate + shape + sign + verify ──────────────────

describe('tool-secret — generate + shape', () => {
  it('generateToolSecret returns a 64-char lowercase hex string', () => {
    const s = generateToolSecret()
    expect(s).toHaveLength(TOOL_SECRET_HEX_LENGTH)
    expect(s).toMatch(/^[0-9a-f]+$/)
  })

  it('isValidToolSecretShape accepts a generated secret and rejects noise', () => {
    expect(isValidToolSecretShape(generateToolSecret())).toBe(true)
    expect(isValidToolSecretShape('too-short')).toBe(false)
    expect(isValidToolSecretShape('G'.repeat(TOOL_SECRET_HEX_LENGTH))).toBe(false) // non-hex
    expect(isValidToolSecretShape('a'.repeat(TOOL_SECRET_HEX_LENGTH + 1))).toBe(false)
    expect(isValidToolSecretShape(123 as unknown as string)).toBe(false)
    expect(isValidToolSecretShape(null)).toBe(false)
  })

  it('two generated secrets differ (entropy smoke test)', () => {
    expect(generateToolSecret()).not.toBe(generateToolSecret())
  })
})

describe('tool-secret — signPayload + verifyPayloadSignature', () => {
  const SECRET = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
  const PAYLOAD = '{"event":"topup.succeeded","amountCents":500}'

  it('signPayload produces a t=<int>,v1=<hex> header', () => {
    const { header, timestamp, signature } = signPayload(PAYLOAD, SECRET, {
      timestamp: 1_700_000_000,
    })
    expect(header).toBe(`t=1700000000,v1=${signature}`)
    expect(signature).toMatch(/^[0-9a-f]{64}$/)
    expect(timestamp).toBe(1_700_000_000)
  })

  it('roundtrips: a freshly-signed header verifies with the same secret', () => {
    const { header, timestamp } = signPayload(PAYLOAD, SECRET)
    expect(
      verifyPayloadSignature(PAYLOAD, header, SECRET, {
        clock: () => timestamp,
      }),
    ).toBe(true)
  })

  it('rejects a signature generated with a different secret', () => {
    const { header, timestamp } = signPayload(PAYLOAD, SECRET)
    const otherSecret = 'b'.repeat(TOOL_SECRET_HEX_LENGTH)
    expect(
      verifyPayloadSignature(PAYLOAD, header, otherSecret, {
        clock: () => timestamp,
      }),
    ).toBe(false)
  })

  it('rejects when the payload bytes changed (signature tampered)', () => {
    const { header, timestamp } = signPayload(PAYLOAD, SECRET)
    expect(
      verifyPayloadSignature(PAYLOAD + 'tampered', header, SECRET, {
        clock: () => timestamp,
      }),
    ).toBe(false)
  })

  it('rejects a replay: timestamp outside the tolerance window (5-min default)', () => {
    const { header } = signPayload(PAYLOAD, SECRET, { timestamp: 1_700_000_000 })
    // 6 minutes later — outside the default 5-minute window.
    expect(
      verifyPayloadSignature(PAYLOAD, header, SECRET, {
        clock: () => 1_700_000_000 + 6 * 60,
      }),
    ).toBe(false)
  })

  it('accepts a signature fresh within the tolerance window', () => {
    const { header } = signPayload(PAYLOAD, SECRET, { timestamp: 1_700_000_000 })
    // 60 seconds later — well within 5 min.
    expect(
      verifyPayloadSignature(PAYLOAD, header, SECRET, {
        clock: () => 1_700_000_000 + 60,
      }),
    ).toBe(true)
  })

  it('rejects malformed signature headers (missing parts, wrong version)', () => {
    const clock = () => 1_700_000_000
    expect(verifyPayloadSignature(PAYLOAD, null, SECRET, { clock })).toBe(false)
    expect(verifyPayloadSignature(PAYLOAD, '', SECRET, { clock })).toBe(false)
    expect(verifyPayloadSignature(PAYLOAD, 'not-a-header', SECRET, { clock })).toBe(false)
    expect(verifyPayloadSignature(PAYLOAD, 't=123', SECRET, { clock })).toBe(false)
    // Wrong version tag (v2) — strict parser rejects.
    expect(verifyPayloadSignature(PAYLOAD, 't=1700000000,v2=abc', SECRET, { clock })).toBe(false)
    // Non-integer timestamp.
    expect(verifyPayloadSignature(PAYLOAD, 't=abc,v1=abc', SECRET, { clock })).toBe(false)
  })

  it('rejects headers exceeding the parse-cap length', () => {
    const longHeader = `t=1700000000,v1=${'a'.repeat(1000)}`
    expect(
      verifyPayloadSignature(PAYLOAD, longHeader, SECRET, {
        clock: () => 1_700_000_000,
      }),
    ).toBe(false)
  })

  it('rejects a secret with the wrong shape (not 64 hex)', () => {
    const { header, timestamp } = signPayload(PAYLOAD, SECRET)
    expect(
      verifyPayloadSignature(PAYLOAD, header, 'short-secret', {
        clock: () => timestamp,
      }),
    ).toBe(false)
  })
})

// ─── Rotation + grace window ────────────────────────────────────────

describe('tool-secret — rotation with ≤60s grace window (hostile req c)', () => {
  it('first rotation produces a state with only current', () => {
    const clock = () => 1_700_000_000
    const state = rotateToolSecret(undefined, clock)
    expect(state.current).toMatch(/^[0-9a-f]{64}$/)
    expect(state.previous).toBeUndefined()
    expect(state.rotatedAt).toBe(1_700_000_000)
  })

  it('second rotation moves old current to previous', () => {
    const clockBefore = () => 1_700_000_000
    const first = rotateToolSecret(undefined, clockBefore)
    const clockAfter = () => 1_700_000_100
    const second = rotateToolSecret(first, clockAfter)
    expect(second.current).not.toBe(first.current)
    expect(second.previous).toBe(first.current)
    expect(second.rotatedAt).toBe(1_700_000_100)
  })

  it('verifyWithRotation accepts signatures from the current secret', () => {
    const clock = () => 1_700_000_000
    const state = rotateToolSecret(undefined, clock)
    const { header } = signPayload('payload', state.current, {
      timestamp: 1_700_000_000,
    })
    expect(
      verifyWithRotation(state, 'payload', header, { clock: () => 1_700_000_000 }),
    ).toBe(true)
  })

  it('accepts old-secret signatures WITHIN the 60-second grace window', () => {
    // Sign with the old secret at t=1000000000. Rotate at t=1000000030.
    // Verify at t=1000000050 (within 60s since rotation).
    const oldSecret = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
    const { header } = signPayload('payload', oldSecret, { timestamp: 1_000_000_000 })
    const rotated = rotateToolSecret({ current: oldSecret }, () => 1_000_000_030)
    expect(
      verifyWithRotation(rotated, 'payload', header, {
        clock: () => 1_000_000_050,
        // Widen the payload-timestamp tolerance so the 50-second-old
        // signature passes the freshness check independently of the
        // rotation grace.
        toleranceSec: 300,
      }),
    ).toBe(true)
  })

  it('REJECTS old-secret signatures after the 60-second grace elapsed', () => {
    const oldSecret = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
    const { header } = signPayload('payload', oldSecret, { timestamp: 1_000_000_000 })
    const rotated = rotateToolSecret({ current: oldSecret }, () => 1_000_000_030)
    // 61 seconds after rotation — past the grace window.
    expect(
      verifyWithRotation(rotated, 'payload', header, {
        clock: () => 1_000_000_030 + ROTATION_GRACE_SEC + 1,
        toleranceSec: 600,
      }),
    ).toBe(false)
  })

  it('verifyWithRotation rejects malformed state objects', () => {
    expect(
      verifyWithRotation(
        null as unknown as Parameters<typeof verifyWithRotation>[0],
        'p',
        't=1,v1=abc',
      ),
    ).toBe(false)
    expect(
      verifyWithRotation(
        { current: 123 as unknown as string } as never,
        'p',
        't=1,v1=abc',
      ),
    ).toBe(false)
  })
})

// ─── verifyWebhook (HTTP-level integration) ─────────────────────────

function buildSignedRequest(
  payload: string,
  secret: string,
  opts: { timestamp?: number; headerName?: string } = {},
): Request {
  const { header, timestamp } = signPayload(payload, secret, {
    timestamp: opts.timestamp,
  })
  const headers = new Headers({ 'content-type': 'application/json' })
  headers.set(opts.headerName ?? SETTLEGRID_SIGNATURE_HEADER, header)
  return new Request('https://dev-app.example/webhook', {
    method: 'POST',
    body: payload,
    headers,
  })
}

describe('verifyWebhook', () => {
  const SECRET = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)

  it('returns ok=true for a valid signed request', async () => {
    const payload = JSON.stringify({ event: 'payout.succeeded', cents: 100 })
    const req = buildSignedRequest(payload, SECRET, { timestamp: 1_700_000_000 })
    const result = await verifyWebhook(req, SECRET, {
      clock: () => 1_700_000_000,
    })
    expect(result.ok).toBe(true)
    expect(result.payload).toBe(payload)
  })

  it('returns reason=missing_header when the signature header is absent', async () => {
    const req = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    })
    const result = await verifyWebhook(req, SECRET)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('missing_header')
    expect(result.payload).toBe('{}')
  })

  it('returns reason=signature_mismatch on a tampered body', async () => {
    const req = buildSignedRequest('{"cents":100}', SECRET, {
      timestamp: 1_700_000_000,
    })
    // Clone with a different body but the same signature — produces
    // a mismatch at verify time.
    const tamperedReq = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: '{"cents":999}',
      headers: req.headers,
    })
    const result = await verifyWebhook(tamperedReq, SECRET, {
      clock: () => 1_700_000_000,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('signature_mismatch')
    expect(result.payload).toBe('{"cents":999}')
  })

  it('returns reason=body_too_large when Content-Length exceeds the cap', async () => {
    const payload = 'x'.repeat(200_000)
    // Use signed headers so the signature check would pass otherwise.
    const { header } = signPayload(payload, SECRET, { timestamp: 1_700_000_000 })
    const req = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: payload,
      headers: {
        'content-length': String(200_000),
        [SETTLEGRID_SIGNATURE_HEADER]: header,
      },
    })
    const result = await verifyWebhook(req, SECRET, {
      maxBytes: 1024,
      clock: () => 1_700_000_000,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('body_too_large')
    expect(result.payload).toBeNull()
  })

  it('honors a custom signature header name', async () => {
    const payload = '{"ok":1}'
    const req = buildSignedRequest(payload, SECRET, {
      timestamp: 1_700_000_000,
      headerName: 'x-custom-sig',
    })
    const result = await verifyWebhook(req, SECRET, {
      signatureHeader: 'x-custom-sig',
      clock: () => 1_700_000_000,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects when the timestamp is outside tolerance (replay)', async () => {
    const req = buildSignedRequest('{}', SECRET, { timestamp: 1_000_000_000 })
    // Verify far in the future — outside the default 5-min window.
    const result = await verifyWebhook(req, SECRET, {
      clock: () => 2_000_000_000,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('signature_mismatch')
  })

  it('rejects maxBytes <= 0 via TypeError (boundary guard)', async () => {
    const req = buildSignedRequest('{}', SECRET)
    await expect(verifyWebhook(req, SECRET, { maxBytes: 0 })).rejects.toThrow(
      TypeError,
    )
  })

  it('returns reason=body_read_failed when the body stream throws', async () => {
    // Construct a ReadableStream that errors on first read. The
    // verifyWebhook helper must catch, return a clean result rather
    // than bubbling the transport error.
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('transport reset'))
      },
    })
    const { header } = signPayload('{}', SECRET, { timestamp: 1_700_000_000 })
    const req = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: broken,
      headers: { [SETTLEGRID_SIGNATURE_HEADER]: header },
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    const result = await verifyWebhook(req, SECRET, {
      clock: () => 1_700_000_000,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('body_read_failed')
    expect(result.payload).toBeNull()
  })

  it('accepts a signature exactly at the tolerance boundary', async () => {
    const { header } = signPayload('{}', SECRET, { timestamp: 1_700_000_000 })
    const req = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: '{}',
      headers: { [SETTLEGRID_SIGNATURE_HEADER]: header },
    })
    // Exactly 60 seconds later with a 60-second tolerance — inside
    // the inclusive window.
    const result = await verifyWebhook(req, SECRET, {
      toleranceSec: 60,
      clock: () => 1_700_000_000 + 60,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects one second past the tolerance boundary', async () => {
    const { header } = signPayload('{}', SECRET, { timestamp: 1_700_000_000 })
    const req = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: '{}',
      headers: { [SETTLEGRID_SIGNATURE_HEADER]: header },
    })
    const result = await verifyWebhook(req, SECRET, {
      toleranceSec: 60,
      clock: () => 1_700_000_000 + 61,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('signature_mismatch')
  })
})

// ─── buildPricingResponseHeaders (F2) ───────────────────────────────

describe('buildPricingResponseHeaders', () => {
  const baseFee: ResolvedRailFee = {
    percentBps: 290,
    flatCents: 30,
    sourceTier: 'base',
  }

  it('emits rail-fee headers only when platformTake is omitted', () => {
    const h = buildPricingResponseHeaders(baseFee)
    expect(h['x-settlegrid-rail-fee-bps']).toBe('290')
    expect(h['x-settlegrid-rail-fee-cents']).toBe('30')
    expect(h['x-settlegrid-rail-fee-tier']).toBe('base')
    expect('x-settlegrid-platform-take-bps' in h).toBe(false)
    expect('x-settlegrid-platform-take-cents' in h).toBe(false)
  })

  it('emits platform-take headers when provided', () => {
    const h = buildPricingResponseHeaders(baseFee, {
      percentBps: 100,
      flatCents: 5,
    })
    expect(h['x-settlegrid-platform-take-bps']).toBe('100')
    expect(h['x-settlegrid-platform-take-cents']).toBe('5')
  })

  it('platform-take flatCents defaults to 0 when omitted', () => {
    const h = buildPricingResponseHeaders(baseFee, { percentBps: 100 })
    expect(h['x-settlegrid-platform-take-cents']).toBe('0')
  })

  it('surfaces volume-tier tier label', () => {
    const h = buildPricingResponseHeaders({
      percentBps: 250,
      flatCents: 30,
      sourceTier: 'volume-tier',
    })
    expect(h['x-settlegrid-rail-fee-tier']).toBe('volume-tier')
  })

  it('throws TypeError on a malformed fee object', () => {
    expect(() =>
      buildPricingResponseHeaders(
        null as unknown as ResolvedRailFee,
      ),
    ).toThrow(TypeError)
    expect(() =>
      buildPricingResponseHeaders({ ...baseFee, percentBps: -1 }),
    ).toThrow(TypeError)
    expect(() =>
      buildPricingResponseHeaders({ ...baseFee, flatCents: -5 }),
    ).toThrow(TypeError)
  })

  it('throws TypeError on malformed platformTake', () => {
    expect(() =>
      buildPricingResponseHeaders(baseFee, {
        percentBps: 20000, // > 10000
      }),
    ).toThrow(TypeError)
    expect(() =>
      buildPricingResponseHeaders(baseFee, {
        percentBps: 100,
        flatCents: -1,
      }),
    ).toThrow(TypeError)
  })

  it('round-trips via fetch Headers (canonical lowercased keys)', () => {
    const h = buildPricingResponseHeaders(baseFee, { percentBps: 100 })
    const headers = new Headers(h)
    expect(headers.get('X-SettleGrid-Rail-Fee-Bps')).toBe('290')
    expect(headers.get('x-settlegrid-platform-take-bps')).toBe('100')
  })
})

// ─── recordLedgerEntry + fingerprint ────────────────────────────────

describe('recordLedgerEntry', () => {
  const baseInput = {
    invocationId: 'inv-123',
    rail: 'stripe-connect',
    protocol: 'mpp',
    amountCents: 500,
    currency: 'USD',
    takeBps: 500, // 5%
  } as const

  it('writes a canonical entry, auto-fills id/createdAt/takeCents/status', async () => {
    const captured: LedgerEntry[] = []
    const writer = async (e: LedgerEntry) => {
      captured.push(e)
    }
    const entry = await recordLedgerEntry({ ...baseInput }, writer)
    expect(captured).toHaveLength(1)
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/i) // uuid
    expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(entry.takeCents).toBe(25) // 500 × 500 / 10000
    expect(entry.status).toBe('pending')
    expect(entry.currency).toBe('usd') // lowercased
  })

  it('rejects takeCents > amountCents with a RangeError', async () => {
    const writer = vi.fn(async () => undefined) as unknown as Parameters<
      typeof recordLedgerEntry
    >[1]
    await expect(
      recordLedgerEntry(
        { ...baseInput, takeCents: 600, amountCents: 500 },
        writer,
      ),
    ).rejects.toThrow(/takeCents.*cannot exceed.*amountCents/)
  })

  it('rejects status=settled without a settledAt (TypeError/RangeError)', async () => {
    const writer = vi.fn(async () => undefined) as unknown as Parameters<
      typeof recordLedgerEntry
    >[1]
    await expect(
      recordLedgerEntry({ ...baseInput, status: 'settled' }, writer),
    ).rejects.toThrow(/settledAt/)
  })

  it('rejects settledAt when status is not settled', async () => {
    const writer = vi.fn(async () => undefined) as unknown as Parameters<
      typeof recordLedgerEntry
    >[1]
    await expect(
      recordLedgerEntry(
        {
          ...baseInput,
          status: 'pending',
          settledAt: '2026-04-23T00:00:00.000Z',
        },
        writer,
      ),
    ).rejects.toThrow(/settledAt.*only allowed on status=settled/)
  })

  it('rejects rail/protocol/currency containing CR/LF/NUL', async () => {
    const writer = vi.fn(async () => undefined) as unknown as Parameters<
      typeof recordLedgerEntry
    >[1]
    await expect(
      recordLedgerEntry({ ...baseInput, rail: 'bad\r\nrail' }, writer),
    ).rejects.toThrow(/control characters/)
  })

  it('rejects metadata that serializes beyond the cap', async () => {
    const writer = vi.fn(async () => undefined) as unknown as Parameters<
      typeof recordLedgerEntry
    >[1]
    const oversize = { blob: 'x'.repeat(LEDGER_ENTRY_METADATA_MAX_BYTES) }
    await expect(
      recordLedgerEntry({ ...baseInput, metadata: oversize }, writer),
    ).rejects.toThrow(/exceeds.*byte cap/)
  })

  it('rejects non-JSON-serializable metadata (circular / bigint)', async () => {
    const writer = vi.fn(async () => undefined) as unknown as Parameters<
      typeof recordLedgerEntry
    >[1]
    const circular: { self?: unknown } = {}
    circular.self = circular
    await expect(
      recordLedgerEntry({ ...baseInput, metadata: circular }, writer),
    ).rejects.toThrow(/JSON-serializable/)
  })

  it('fingerprint is stable across id/createdAt variation (reconciliation use)', async () => {
    const mk = (id: string, createdAt: string): LedgerEntry => ({
      id,
      invocationId: 'inv-123',
      sessionId: 'sess-1',
      rail: 'stripe-connect',
      protocol: 'mpp',
      amountCents: 500,
      currency: 'usd',
      takeBps: 500,
      takeCents: 25,
      status: 'settled',
      createdAt,
      settledAt: '2026-04-23T12:00:00.000Z',
      externalRef: 'pi_abc',
      metadata: { origin: 'test' },
    })
    const a = mk('uuid-1', '2026-04-23T00:00:00.000Z')
    const b = mk('uuid-2', '2026-04-23T00:00:01.000Z')
    expect(fingerprintLedgerEntry(a)).toBe(fingerprintLedgerEntry(b))
  })

  it('fingerprint differs when a semantic field changes', async () => {
    const base: LedgerEntry = {
      id: 'id',
      invocationId: 'inv-1',
      sessionId: null,
      rail: 'stripe-connect',
      protocol: 'mpp',
      amountCents: 500,
      currency: 'usd',
      takeBps: 500,
      takeCents: 25,
      status: 'pending',
      createdAt: '2026-04-23T00:00:00.000Z',
      settledAt: null,
      externalRef: null,
      metadata: null,
    }
    const different: LedgerEntry = { ...base, amountCents: 501 }
    expect(fingerprintLedgerEntry(base)).not.toBe(fingerprintLedgerEntry(different))
  })
})

// ─── Pricing resolution ─────────────────────────────────────────────

describe('resolveRailFee', () => {
  const stripeCard: RailPricingRateCard = {
    basePercentBps: 290,
    baseFlatCents: 30,
    volumeTiers: [
      { minMonthlyCents: 5_000_000, percentBps: 270, flatCents: 30 },
      { minMonthlyCents: 25_000_000, percentBps: 250, flatCents: 30 },
    ],
    currencySurcharges: {
      GBP: { percentBps: 100 },
      EUR: { percentBps: 100, flatCents: 10 },
    },
    percentBps: 290,
    flatCents: 30,
  }

  it('returns base rate when no context is provided', () => {
    const r = resolveRailFee(stripeCard)
    expect(r.percentBps).toBe(290)
    expect(r.flatCents).toBe(30)
    expect(r.sourceTier).toBe('base')
    expect(r.appliedTier).toBeUndefined()
    expect(r.currencySurcharge).toBeUndefined()
  })

  it('applies the highest-qualifying volume tier (not first)', () => {
    // $50k/month volume qualifies only for the 5M tier, not the 25M.
    expect(resolveRailFee(stripeCard, { monthlyVolumeCents: 5_000_000 })).toMatchObject({
      percentBps: 270,
      flatCents: 30,
      sourceTier: 'volume-tier',
    })
    // $300k/month qualifies for BOTH tiers; resolver picks the
    // HIGHER threshold (25M).
    expect(resolveRailFee(stripeCard, { monthlyVolumeCents: 30_000_000 })).toMatchObject({
      percentBps: 250,
      flatCents: 30,
      sourceTier: 'volume-tier',
    })
  })

  it('falls back to base when no tier threshold is met', () => {
    expect(resolveRailFee(stripeCard, { monthlyVolumeCents: 1_000_000 })).toMatchObject({
      percentBps: 290,
      sourceTier: 'base',
    })
  })

  it('adds currency surcharge to the resolved rate', () => {
    const r = resolveRailFee(stripeCard, { currency: 'GBP' })
    expect(r.percentBps).toBe(390) // 290 + 100
    expect(r.flatCents).toBe(30)
    expect(r.currencySurcharge).toEqual({ percentBps: 100 })
  })

  it('adds surcharge flat cents when the surcharge defines it', () => {
    const r = resolveRailFee(stripeCard, { currency: 'EUR' })
    expect(r.percentBps).toBe(390)
    expect(r.flatCents).toBe(40) // 30 + 10
  })

  it('surcharge currency match is case-insensitive', () => {
    const r = resolveRailFee(stripeCard, { currency: 'gbp' })
    expect(r.percentBps).toBe(390)
  })

  it('no surcharge applied for a currency absent from the map', () => {
    const r = resolveRailFee(stripeCard, { currency: 'USD' })
    expect(r.percentBps).toBe(290)
    expect(r.currencySurcharge).toBeUndefined()
  })

  it('combines tier + surcharge when both apply', () => {
    const r = resolveRailFee(stripeCard, {
      monthlyVolumeCents: 30_000_000,
      currency: 'GBP',
    })
    // Tier → 250 bps, + 100 bps surcharge = 350 bps.
    expect(r.percentBps).toBe(350)
    expect(r.flatCents).toBe(30)
    expect(r.sourceTier).toBe('volume-tier')
    expect(r.currencySurcharge).toEqual({ percentBps: 100 })
  })

  it('throws TypeError on a malformed card (negative bps)', () => {
    expect(() =>
      resolveRailFee(
        { ...stripeCard, basePercentBps: -1 } as unknown as RailPricingRateCard,
      ),
    ).toThrow(TypeError)
  })

  it('throws TypeError on a malformed tier (bps > 10000)', () => {
    expect(() =>
      resolveRailFee(
        {
          ...stripeCard,
          volumeTiers: [
            { minMonthlyCents: 1000, percentBps: 20000, flatCents: 0 },
          ],
        },
      ),
    ).toThrow(TypeError)
  })

  it('ignores tier declaration order (resolver sorts by threshold)', () => {
    const reordered: RailPricingRateCard = {
      ...stripeCard,
      volumeTiers: [
        { minMonthlyCents: 25_000_000, percentBps: 250, flatCents: 30 },
        { minMonthlyCents: 5_000_000, percentBps: 270, flatCents: 30 },
      ],
    }
    expect(resolveRailFee(reordered, { monthlyVolumeCents: 30_000_000 })).toMatchObject({
      percentBps: 250,
    })
  })
})
