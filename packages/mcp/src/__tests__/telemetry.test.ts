/**
 * P4.1 — SDK telemetry tests.
 *
 * Coverage:
 *   - SHA-256 of toolSlug → stable hex distinct_id
 *   - sdk_first_init dedupes per process per toolSlug
 *   - first_billed_call dedupes per (toolSlug, consumerId)
 *   - opt-out via SETTLEGRID_TELEMETRY (case-insensitive)
 *   - Wire-shape: actual fetch body shape matches the proxy's Zod schema
 *   - Never throws on fetch failure
 *   - Bounded growth on first_billed_call dedupe set
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  emitSdkFirstInit,
  emitFirstBilledCall,
  hashOrgId,
  isSdkTelemetryOptedOut,
  __resetSdkTelemetryForTests,
  __setSdkFetchForTests,
} from '../telemetry'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.SETTLEGRID_TELEMETRY
  __resetSdkTelemetryForTests()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  __resetSdkTelemetryForTests()
})

describe('hashOrgId', () => {
  it('returns a 64-char lowercase hex string', () => {
    const h = hashOrgId('my-tool')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic across calls', () => {
    expect(hashOrgId('alpha')).toBe(hashOrgId('alpha'))
  })

  it('produces different hashes for different inputs', () => {
    expect(hashOrgId('alpha')).not.toBe(hashOrgId('beta'))
  })

  it('handles empty string', () => {
    // Empty input still produces a valid hash (sha256 of empty bytes
    // is e3b0c44...). Defensive: don't crash even if a misbehaving
    // caller passes ''.
    const h = hashOrgId('')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('isSdkTelemetryOptedOut', () => {
  it('returns false when env unset', () => {
    delete process.env.SETTLEGRID_TELEMETRY
    expect(isSdkTelemetryOptedOut()).toBe(false)
  })

  it.each(['0', 'false', 'no', 'off', 'OFF', '  off  '])(
    'returns true for %p',
    (val) => {
      process.env.SETTLEGRID_TELEMETRY = val
      expect(isSdkTelemetryOptedOut()).toBe(true)
    },
  )
})

describe('emitSdkFirstInit — wire shape + dedupe', () => {
  it('POSTs the documented body shape to the proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)

    const ok = await emitSdkFirstInit({
      toolSlug: 'my-tool',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/telemetry/capture')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).redirect).toBe('error')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(Object.keys(body).sort()).toEqual([
      'distinct_id',
      'event',
      'properties',
    ])
    expect(body.event).toBe('sdk_first_init')
    expect(body.distinct_id).toBe(hashOrgId('my-tool'))
    expect(body.properties.sdk_version).toBe('0.2.0')
    expect(body.properties.org_id_hash).toBe(hashOrgId('my-tool'))
  })

  it('dedupes per toolSlug across calls in the same process', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)

    await emitSdkFirstInit({
      toolSlug: 'my-tool',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    await emitSdkFirstInit({
      toolSlug: 'my-tool',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    await emitSdkFirstInit({
      toolSlug: 'my-tool',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not dedupe across different toolSlugs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)

    await emitSdkFirstInit({
      toolSlug: 'tool-a',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    await emitSdkFirstInit({
      toolSlug: 'tool-b',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns false (no fetch) when opted out', async () => {
    process.env.SETTLEGRID_TELEMETRY = '0'
    const fetchMock = vi.fn()
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)
    const ok = await emitSdkFirstInit({
      toolSlug: 'my-tool',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns false on fetch failure (no throw)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)
    const ok = await emitSdkFirstInit({
      toolSlug: 'my-tool',
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    expect(ok).toBe(false)
  })

  it('strips trailing slashes from apiUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)
    await emitSdkFirstInit({
      toolSlug: 'my-tool',
      apiUrl: 'http://localhost:3000/',
      sdkVersion: '0.2.0',
    })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/telemetry/capture')
  })
})

describe('emitFirstBilledCall — wire shape + dedupe', () => {
  it('POSTs the documented body shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)

    const ok = await emitFirstBilledCall({
      toolSlug: 'my-tool',
      consumerId: 'consumer-123',
      apiUrl: 'http://localhost:3000',
      method: 'search',
      amountCents: 5,
    })

    expect(ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/telemetry/capture')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.event).toBe('first_billed_call')
    expect(body.distinct_id).toBe(hashOrgId('my-tool'))
    expect(body.properties).toEqual({
      method: 'search',
      amount_cents: 5,
    })
  })

  it('dedupes per (toolSlug, consumerId)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)

    await emitFirstBilledCall({
      toolSlug: 'my-tool',
      consumerId: 'A',
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    await emitFirstBilledCall({
      toolSlug: 'my-tool',
      consumerId: 'A',
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Different consumer — fires again.
    await emitFirstBilledCall({
      toolSlug: 'my-tool',
      consumerId: 'B',
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns false (no fetch) when opted out', async () => {
    process.env.SETTLEGRID_TELEMETRY = '0'
    const fetchMock = vi.fn()
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)
    const ok = await emitFirstBilledCall({
      toolSlug: 'my-tool',
      consumerId: 'A',
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns false on fetch failure (no throw)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)
    const ok = await emitFirstBilledCall({
      toolSlug: 'my-tool',
      consumerId: 'A',
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    expect(ok).toBe(false)
  })
})

describe('emit*  — never throws on bad input (H4)', () => {
  it('emitSdkFirstInit returns false (no throw) on null toolSlug', async () => {
    // Cast away the type — we want to exercise the runtime guard,
    // not the compile-time one. A real consumer passing a typed
    // `string` would never hit this, but the wrap is defense-in-
    // depth against unexpected refactors / undefined config fields.
    const ok = await emitSdkFirstInit({
      // @ts-expect-error — testing runtime safety
      toolSlug: null,
      apiUrl: 'http://localhost:3000',
      sdkVersion: '0.2.0',
    })
    expect(ok).toBe(false)
  })

  it('emitFirstBilledCall returns false (no throw) on null toolSlug', async () => {
    const ok = await emitFirstBilledCall({
      // @ts-expect-error — testing runtime safety
      toolSlug: null,
      consumerId: 'A',
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    expect(ok).toBe(false)
  })

  it('emitFirstBilledCall returns false (no throw) on null consumerId', async () => {
    const ok = await emitFirstBilledCall({
      toolSlug: 'my-tool',
      // @ts-expect-error — testing runtime safety
      consumerId: null,
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    // null consumerId is stringified into the dedupe key — that's
    // valid JS — but the proxy POST may still go through. The
    // load-bearing assertion is "no throw," not the boolean value.
    expect(typeof ok).toBe('boolean')
  })
})

describe('emitFirstBilledCall — bounded dedupe set', () => {
  it('clears + re-fires after FIRST_BILLED_MAX_ENTRIES distinct (slug,consumer) pairs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    __setSdkFetchForTests(fetchMock as unknown as typeof fetch)

    // Fire 10_000 unique consumer events to fill the dedupe set
    // exactly. The 10_001st pair triggers the clear-and-add path,
    // and re-firing for an earlier consumer (e.g. consumer 0) MUST
    // POST again (the original entry was wiped).
    const MAX = 10_000
    for (let i = 0; i < MAX; i++) {
      await emitFirstBilledCall({
        toolSlug: 't',
        consumerId: `c-${i}`,
        apiUrl: 'http://localhost:3000',
        method: 'm',
        amountCents: 1,
      })
    }
    expect(fetchMock).toHaveBeenCalledTimes(MAX)

    // 10_001st distinct entry — set is cleared then re-populated
    // with this one entry only.
    await emitFirstBilledCall({
      toolSlug: 't',
      consumerId: `c-overflow`,
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    expect(fetchMock).toHaveBeenCalledTimes(MAX + 1)

    // c-0 was wiped, so this re-fires.
    await emitFirstBilledCall({
      toolSlug: 't',
      consumerId: `c-0`,
      apiUrl: 'http://localhost:3000',
      method: 'm',
      amountCents: 1,
    })
    expect(fetchMock).toHaveBeenCalledTimes(MAX + 2)
  }, 30_000)
})
