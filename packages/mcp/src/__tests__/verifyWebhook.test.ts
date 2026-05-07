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
  const { header } = signPayload(payload, secret, {
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

  it('throws on unknown sourceTier (hostile H26 — header-injection guard)', () => {
    expect(() =>
      buildPricingResponseHeaders({
        percentBps: 290,
        flatCents: 30,
        sourceTier: 'admin\r\nX-Injected: evil' as unknown as 'base',
      }),
    ).toThrow(TypeError)
  })
})

// ─── Hostile-round guards (new in the hostile commit) ──────────────

describe('hostile H5 — amountCents overflow cap', () => {
  const writer = async () => undefined
  it('rejects amountCents above the cap', async () => {
    const BEYOND_CAP = 2_000_000_000_000 // $20B — above the 10B cap
    await expect(
      recordLedgerEntry(
        {
          invocationId: 'inv-1',
          rail: 'stripe-connect',
          protocol: 'mpp',
          amountCents: BEYOND_CAP,
          currency: 'USD',
          takeBps: 500,
        },
        writer,
      ),
    ).rejects.toThrow(/exceeds.*cap/)
  })

  it('computes takeCents correctly for an amount near the cap (no overflow)', async () => {
    // 999_999_999_999 cents × 500 bps / 10000 = 49_999_999_999 cents
    // (well under Number.MAX_SAFE_INTEGER = ~9e15).
    const captured: LedgerEntry[] = []
    const entry = await recordLedgerEntry(
      {
        invocationId: 'inv-1',
        rail: 'stripe-connect',
        protocol: 'mpp',
        amountCents: 999_999_999_999,
        currency: 'USD',
        takeBps: 500,
      },
      async (e) => {
        captured.push(e)
      },
    )
    expect(entry.takeCents).toBe(49_999_999_999)
  })
})

describe('hostile H6 — amountCents must be positive', () => {
  const writer = async () => undefined
  it('rejects amountCents = 0 (aligns with DB ledger_entries_amount_positive constraint)', async () => {
    await expect(
      recordLedgerEntry(
        {
          invocationId: 'inv-1',
          rail: 'stripe-connect',
          protocol: 'mpp',
          amountCents: 0,
          currency: 'USD',
          takeBps: 500,
        },
        writer,
      ),
    ).rejects.toThrow(/must be positive/)
  })
})

describe('hostile H1/H3 — CRLF/NUL in invocationId / sessionId', () => {
  const writer = async () => undefined
  it('rejects CRLF in invocationId', async () => {
    await expect(
      recordLedgerEntry(
        {
          invocationId: 'inv\r\nevil',
          rail: 'stripe-connect',
          protocol: 'mpp',
          amountCents: 500,
          currency: 'USD',
          takeBps: 500,
        },
        writer,
      ),
    ).rejects.toThrow(/control characters/)
  })

  it('rejects NUL in sessionId', async () => {
    await expect(
      recordLedgerEntry(
        {
          invocationId: 'inv-1',
          sessionId: 'sess\x00evil',
          rail: 'stripe-connect',
          protocol: 'mpp',
          amountCents: 500,
          currency: 'USD',
          takeBps: 500,
        },
        writer,
      ),
    ).rejects.toThrow(/control characters/)
  })
})

describe('hostile H10/H12 — id + createdAt overrides validated', () => {
  const writer = async () => undefined
  const base = {
    invocationId: 'inv-1',
    rail: 'stripe-connect',
    protocol: 'mpp',
    amountCents: 500,
    currency: 'USD',
    takeBps: 500,
  } as const

  it('rejects non-UUID id override', async () => {
    await expect(
      recordLedgerEntry({ ...base, id: 'not-a-uuid' }, writer),
    ).rejects.toThrow(/must be a UUID/)
  })

  it('accepts a valid UUID id override', async () => {
    const captured: LedgerEntry[] = []
    await recordLedgerEntry(
      { ...base, id: '00000000-0000-4000-8000-000000000000' },
      async (e) => {
        captured.push(e)
      },
    )
    expect(captured[0].id).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('rejects malformed createdAt override', async () => {
    await expect(
      recordLedgerEntry({ ...base, createdAt: '2026-04-23' }, writer),
    ).rejects.toThrow(/ISO-8601 timestamp/)
  })
})

describe('hostile H11 — fingerprint doesn\'t collide on pipe-containing fields', () => {
  const mk = (overrides: Partial<LedgerEntry>): LedgerEntry => ({
    id: 'x',
    invocationId: 'inv-1',
    sessionId: null,
    rail: 'r',
    protocol: 'p',
    amountCents: 500,
    currency: 'usd',
    takeBps: 0,
    takeCents: 0,
    status: 'pending',
    createdAt: '2026-04-23T00:00:00.000Z',
    settledAt: null,
    externalRef: null,
    metadata: null,
    ...overrides,
  })

  it('different rail+protocol combinations with "|" chars produce different fingerprints', () => {
    // Under the OLD `|`-joined fingerprint, these two entries would
    // collide (both produce "inv-1||a|b|c|..."). The JSON-based
    // fingerprint disambiguates.
    const a = fingerprintLedgerEntry(mk({ rail: 'a|b', protocol: 'c' }))
    const b = fingerprintLedgerEntry(mk({ rail: 'a', protocol: 'b|c' }))
    expect(a).not.toBe(b)
  })
})

describe('hostile H15 — rotateToolSecret rejects malformed prior', () => {
  it('clears previous when the caller passes a bad-shape current secret', () => {
    const malformed = { current: 'too-short' }
    const out = rotateToolSecret(malformed, () => 1_700_000_000)
    // previous is NOT set — the malformed secret was refused.
    expect(out.previous).toBeUndefined()
    expect(out.rotatedAt).toBe(1_700_000_000)
    expect(out.current).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('hostile H16 — verifyWithRotation rejects future rotatedAt', () => {
  const oldSecret = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
  it('rejects previous secret when rotatedAt is AFTER now', () => {
    const { header } = signPayload('p', oldSecret, { timestamp: 1_000_000_000 })
    // State claims rotation happened in the "future" relative to
    // the verify clock. An attacker controlling rotatedAt would
    // otherwise keep previous valid indefinitely.
    const state = {
      current: 'b'.repeat(TOOL_SECRET_HEX_LENGTH),
      previous: oldSecret,
      rotatedAt: 2_000_000_000, // after now
    }
    expect(
      verifyWithRotation(state, 'p', header, {
        clock: () => 1_000_000_100,
        toleranceSec: 600,
      }),
    ).toBe(false)
  })
})

describe('hostile H18 — future timestamp beyond skew rejected', () => {
  const SECRET = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
  it('rejects a signature whose timestamp is 10 seconds in the future (> 5s skew)', () => {
    const { header } = signPayload('p', SECRET, { timestamp: 1_700_000_010 })
    expect(
      verifyPayloadSignature('p', header, SECRET, {
        clock: () => 1_700_000_000,
        toleranceSec: 300,
      }),
    ).toBe(false)
  })

  it('accepts a signature within the 5-second future skew', () => {
    const { header } = signPayload('p', SECRET, { timestamp: 1_700_000_005 })
    expect(
      verifyPayloadSignature('p', header, SECRET, {
        clock: () => 1_700_000_000,
        toleranceSec: 300,
      }),
    ).toBe(true)
  })
})

describe('hostile H25 — verifyWebhook rejects empty signatureHeader override', () => {
  it('throws TypeError on signatureHeader=""', async () => {
    const req = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: '{}',
    })
    await expect(
      verifyWebhook(req, 'a'.repeat(TOOL_SECRET_HEX_LENGTH), {
        signatureHeader: '',
      }),
    ).rejects.toThrow(TypeError)
  })
})

// ─── Coverage-round boundary tests ──────────────────────────────────
//
// Scaffold-discipline: these are boundary/negative/regression
// assertions, NOT new functional behavior. They close the gaps
// identified by v8 coverage on the P3.K4 source files.

describe('coverage — tool-secret signPayload invalid-secret path', () => {
  it('throws TypeError when secret is not a valid shape', () => {
    // signPayload goes through requireSecret → isValidToolSecretShape.
    // The error-path return covers lines ~336-340.
    expect(() => signPayload('payload', 'bad-secret', { timestamp: 1 })).toThrow(
      TypeError,
    )
    expect(() =>
      signPayload(
        'payload',
        'G'.repeat(TOOL_SECRET_HEX_LENGTH),
        { timestamp: 1 },
      ),
    ).toThrow(TypeError)
  })

  it('signPayload throws on non-string payload', () => {
    const SECRET = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
    expect(() =>
      signPayload(123 as unknown as string, SECRET, { timestamp: 1 }),
    ).toThrow(/payload/)
  })

  it('signPayload throws on negative timestamp', () => {
    const SECRET = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
    expect(() => signPayload('payload', SECRET, { timestamp: -1 })).toThrow(
      RangeError,
    )
  })
})

describe('coverage — verifyWithRotation shape rejections', () => {
  const CURRENT = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)
  const OLD = 'b'.repeat(TOOL_SECRET_HEX_LENGTH)

  it('returns false when state.previous is missing (current-only state)', () => {
    // Valid state with no previous. verifyWithRotation should try
    // current; if that fails, there's no previous to fall back to.
    const wrongSecret = 'c'.repeat(TOOL_SECRET_HEX_LENGTH)
    const { header, timestamp } = signPayload('p', wrongSecret)
    const state = { current: CURRENT, rotatedAt: timestamp }
    expect(
      verifyWithRotation(state, 'p', header, { clock: () => timestamp }),
    ).toBe(false)
  })

  it('returns false when state.previous is not a string', () => {
    const { header, timestamp } = signPayload('p', OLD)
    const state = {
      current: CURRENT,
      previous: 12345 as unknown as string,
      rotatedAt: timestamp,
    }
    expect(
      verifyWithRotation(state, 'p', header, { clock: () => timestamp }),
    ).toBe(false)
  })

  it('returns false when state.rotatedAt is not a number', () => {
    const { header, timestamp } = signPayload('p', OLD)
    const state = {
      current: CURRENT,
      previous: OLD,
      rotatedAt: 'not-a-number' as unknown as number,
    }
    expect(
      verifyWithRotation(state, 'p', header, { clock: () => timestamp }),
    ).toBe(false)
  })
})

describe('coverage — verifyPayloadSignature edge cases', () => {
  const SECRET = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)

  it('returns false when payload is not a string', () => {
    expect(
      verifyPayloadSignature(
        123 as unknown as string,
        't=1,v1=abc',
        SECRET,
      ),
    ).toBe(false)
  })

  it('returns false when toleranceSec is negative', () => {
    const { header, timestamp } = signPayload('p', SECRET)
    expect(
      verifyPayloadSignature('p', header, SECRET, {
        clock: () => timestamp,
        toleranceSec: -1,
      }),
    ).toBe(false)
  })

  it('returns false when toleranceSec is a non-integer', () => {
    const { header, timestamp } = signPayload('p', SECRET)
    expect(
      verifyPayloadSignature('p', header, SECRET, {
        clock: () => timestamp,
        toleranceSec: 0.5,
      }),
    ).toBe(false)
  })

  it('returns false when the hex-signature length differs from expected', () => {
    // Produces a header with a too-short (but syntactically valid)
    // signature. The timingSafeHexEqual helper short-circuits false
    // on length mismatch.
    const { timestamp } = signPayload('p', SECRET)
    expect(
      verifyPayloadSignature(
        'p',
        `t=${timestamp},v1=${'a'.repeat(62)}`, // 62 != 64 hex chars
        SECRET,
        { clock: () => timestamp },
      ),
    ).toBe(false)
  })
})

describe('coverage — verifyWebhook body-stream cap + finalizer', () => {
  const SECRET = 'a'.repeat(TOOL_SECRET_HEX_LENGTH)

  it('returns body_too_large when a streamed body exceeds maxBytes', async () => {
    // Custom ReadableStream: two 600-byte chunks, no Content-Length
    // so the fast-path check is skipped. The cap is enforced inside
    // the read loop → BodyTooLargeError → mapped to body_too_large.
    const { header, timestamp } = signPayload('p', SECRET, {
      timestamp: 1_700_000_000,
    })
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode('x'.repeat(600)))
        controller.enqueue(enc.encode('x'.repeat(600)))
        controller.close()
      },
    })
    const req = new Request('https://dev-app.example/webhook', {
      method: 'POST',
      body: stream,
      headers: { [SETTLEGRID_SIGNATURE_HEADER]: header },
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    const result = await verifyWebhook(req, SECRET, {
      maxBytes: 1024,
      clock: () => timestamp,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('body_too_large')
  })
})

describe('coverage — resolveRailFee surcharge + card edge cases', () => {
  it('throws on a non-object currencySurcharges value', () => {
    expect(() =>
      resolveRailFee(
        {
          basePercentBps: 290,
          baseFlatCents: 30,
          percentBps: 290,
          flatCents: 30,
          currencySurcharges: {
            GBP: null as unknown as { percentBps: number },
          },
        },
        { currency: 'GBP' },
      ),
    ).toThrow(TypeError)
  })

  it('throws on a non-object volume tier', () => {
    expect(() =>
      resolveRailFee(
        {
          basePercentBps: 290,
          baseFlatCents: 30,
          percentBps: 290,
          flatCents: 30,
          volumeTiers: [
            null as unknown as {
              minMonthlyCents: number
              percentBps: number
              flatCents: number
            },
          ],
        },
        { monthlyVolumeCents: 1_000_000 },
      ),
    ).toThrow(TypeError)
  })

  it('treats non-string currency as absent (no surcharge)', () => {
    const r = resolveRailFee(
      {
        basePercentBps: 290,
        baseFlatCents: 30,
        percentBps: 290,
        flatCents: 30,
        currencySurcharges: { GBP: { percentBps: 100 } },
      },
      { currency: 123 as unknown as string },
    )
    expect(r.percentBps).toBe(290)
    expect(r.currencySurcharge).toBeUndefined()
  })

  it('treats empty-string currency as absent', () => {
    const r = resolveRailFee(
      {
        basePercentBps: 290,
        baseFlatCents: 30,
        percentBps: 290,
        flatCents: 30,
        currencySurcharges: { GBP: { percentBps: 100 } },
      },
      { currency: '' },
    )
    expect(r.percentBps).toBe(290)
  })

  it('treats non-number monthlyVolumeCents as zero (falls back to base)', () => {
    const r = resolveRailFee(
      {
        basePercentBps: 290,
        baseFlatCents: 30,
        percentBps: 290,
        flatCents: 30,
        volumeTiers: [
          { minMonthlyCents: 1_000_000, percentBps: 270, flatCents: 30 },
        ],
      },
      { monthlyVolumeCents: 'huge' as unknown as number },
    )
    expect(r.sourceTier).toBe('base')
  })
})

describe('coverage — buildPricingResponseHeaders edge cases', () => {
  const baseFee: ResolvedRailFee = {
    percentBps: 290,
    flatCents: 30,
    sourceTier: 'base',
  }

  it('throws on non-object platformTake', () => {
    expect(() =>
      buildPricingResponseHeaders(
        baseFee,
        'not-an-object' as unknown as { percentBps: number },
      ),
    ).toThrow(TypeError)
    expect(() =>
      buildPricingResponseHeaders(
        baseFee,
        null as unknown as { percentBps: number },
      ),
    ).toThrow(TypeError)
  })
})

describe('coverage — recordLedgerEntry input-validation edges', () => {
  const writer = async () => undefined
  const base = {
    invocationId: 'inv-1',
    rail: 'stripe-connect',
    protocol: 'mpp',
    amountCents: 500,
    currency: 'USD',
    takeBps: 500,
  } as const

  it('throws TypeError when input is null', async () => {
    await expect(
      recordLedgerEntry(
        null as unknown as Parameters<typeof recordLedgerEntry>[0],
        writer,
      ),
    ).rejects.toThrow(/non-null object/)
  })

  it('throws TypeError when writer is not a function', async () => {
    await expect(
      recordLedgerEntry(
        base,
        'not-a-function' as unknown as Parameters<typeof recordLedgerEntry>[1],
      ),
    ).rejects.toThrow(/must be a function/)
  })

  it('rejects non-string rail/protocol/currency', async () => {
    await expect(
      recordLedgerEntry(
        { ...base, rail: 123 as unknown as string },
        writer,
      ),
    ).rejects.toThrow(/must be a non-empty string/)
  })

  it('rejects non-integer amountCents (float)', async () => {
    await expect(
      recordLedgerEntry({ ...base, amountCents: 1.5 }, writer),
    ).rejects.toThrow(/non-negative integer/)
  })

  it('rejects takeBps out of [0, 10000]', async () => {
    await expect(
      recordLedgerEntry({ ...base, takeBps: 15000 }, writer),
    ).rejects.toThrow(/basis points/)
  })

  it('rejects non-string sessionId type', async () => {
    await expect(
      recordLedgerEntry(
        {
          ...base,
          sessionId: 42 as unknown as string,
        },
        writer,
      ),
    ).rejects.toThrow(/sessionId/)
  })

  it('rejects non-string externalRef', async () => {
    await expect(
      recordLedgerEntry(
        {
          ...base,
          externalRef: 42 as unknown as string,
        },
        writer,
      ),
    ).rejects.toThrow(/externalRef/)
  })

  it('rejects metadata that is an array (must be a plain object)', async () => {
    await expect(
      recordLedgerEntry(
        {
          ...base,
          metadata: ['a', 'b'] as unknown as Record<string, unknown>,
        },
        writer,
      ),
    ).rejects.toThrow(/non-null non-array object/)
  })

  it('accepts explicit takeCents (does not recompute from takeBps)', async () => {
    const captured: LedgerEntry[] = []
    await recordLedgerEntry(
      { ...base, takeBps: 0, takeCents: 3 },
      async (e) => {
        captured.push(e)
      },
    )
    // Explicit takeCents wins even though takeBps=0 would compute 0.
    expect(captured[0].takeCents).toBe(3)
  })

  it('preserves metadata when it is a valid small object', async () => {
    const captured: LedgerEntry[] = []
    await recordLedgerEntry(
      { ...base, metadata: { origin: 'test', nested: { n: 1 } } },
      async (e) => {
        captured.push(e)
      },
    )
    expect(captured[0].metadata).toEqual({ origin: 'test', nested: { n: 1 } })
  })

  it('leaves metadata null when omitted', async () => {
    const captured: LedgerEntry[] = []
    await recordLedgerEntry(base, async (e) => {
      captured.push(e)
    })
    expect(captured[0].metadata).toBeNull()
  })

  it('lowercases currency consistently (case-insensitive adapter outputs)', async () => {
    const captured: LedgerEntry[] = []
    await recordLedgerEntry(
      { ...base, currency: 'EUR' },
      async (e) => {
        captured.push(e)
      },
    )
    expect(captured[0].currency).toBe('eur')
  })
})

describe('coverage — recordLedgerEntry status=settled + settledAt combinations', () => {
  const writer = async () => undefined
  const base = {
    invocationId: 'inv-1',
    rail: 'stripe-connect',
    protocol: 'mpp',
    amountCents: 500,
    currency: 'USD',
    takeBps: 500,
  } as const

  it('accepts settled status with a valid settledAt timestamp', async () => {
    const captured: LedgerEntry[] = []
    await recordLedgerEntry(
      {
        ...base,
        status: 'settled',
        settledAt: '2026-04-23T12:00:00.000Z',
      },
      async (e) => {
        captured.push(e)
      },
    )
    expect(captured[0].status).toBe('settled')
    expect(captured[0].settledAt).toBe('2026-04-23T12:00:00.000Z')
  })

  it('rejects settledAt that fails ISO regex', async () => {
    await expect(
      recordLedgerEntry(
        {
          ...base,
          status: 'settled',
          // Missing 'T' separator → fails regex.
          settledAt: '2026-04-23 12:00:00Z',
        },
        writer,
      ),
    ).rejects.toThrow(/ISO-8601 timestamp/)
  })

  it('rejects CRLF in externalRef (header-injection guard)', async () => {
    await expect(
      recordLedgerEntry(
        {
          ...base,
          externalRef: 'pi_abc\r\nX-Injected: evil',
        },
        writer,
      ),
    ).rejects.toThrow(/control characters/)
  })

  it('rejects status value outside the closed enum', async () => {
    await expect(
      recordLedgerEntry(
        {
          ...base,
          status: 'in-limbo' as unknown as 'pending',
        },
        writer,
      ),
    ).rejects.toThrow(/pending\/settled\/voided\/failed\/reversed/)
  })
})

describe('coverage — resolveRailFee null + malformed-tier paths', () => {
  it('throws on null card', () => {
    expect(() =>
      resolveRailFee(null as unknown as RailPricingRateCard),
    ).toThrow(/non-null object/)
  })

  it('throws on tier with non-integer minMonthlyCents', () => {
    expect(() =>
      resolveRailFee(
        {
          basePercentBps: 290,
          baseFlatCents: 30,
          percentBps: 290,
          flatCents: 30,
          volumeTiers: [
            {
              minMonthlyCents: 1.5,
              percentBps: 250,
              flatCents: 30,
            },
          ],
        },
        { monthlyVolumeCents: 1000 },
      ),
    ).toThrow(/non-negative integer/)
  })

  it('throws on tier with negative minMonthlyCents', () => {
    expect(() =>
      resolveRailFee(
        {
          basePercentBps: 290,
          baseFlatCents: 30,
          percentBps: 290,
          flatCents: 30,
          volumeTiers: [
            {
              minMonthlyCents: -1,
              percentBps: 250,
              flatCents: 30,
            },
          ],
        },
        { monthlyVolumeCents: 1000 },
      ),
    ).toThrow(/non-negative integer/)
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
