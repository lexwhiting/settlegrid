/**
 * P4.1 — Unit tests for the canonical event registry + client-side
 * capture helper. These cover events 1-3 of the funnel by exercising
 * the helper the three emitter components use.
 *
 * The proxy-side tests live next to the route at
 * `apps/web/src/app/api/telemetry/capture/__tests__/route.test.ts`.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  EVENT_NAMES,
  isCanonicalEventName,
  captureCanonicalEvent,
  forwardToPostHog,
  DEFAULT_POSTHOG_HOST,
} from '../posthog'

describe('EVENT_NAMES allow-list', () => {
  it('contains all 8 canonical events', () => {
    expect(EVENT_NAMES).toEqual([
      'gallery_viewed',
      'template_detail_viewed',
      'shadow_directory_viewed',
      'cli_install_started',
      'scaffold_success',
      'scaffold_failed',
      'sdk_first_init',
      'first_billed_call',
    ])
  })

  it('is frozen — caller cannot mutate the allow-list', () => {
    expect(Object.isFrozen(EVENT_NAMES)).toBe(true)
    // Attempt to push at runtime; in strict mode this throws,
    // outside strict it silently no-ops. Either way, length is
    // unchanged. Cast away `readonly` to suppress the TS error
    // since we WANT to confirm the runtime guard.
    const before = EVENT_NAMES.length
    expect(() =>
      (EVENT_NAMES as unknown as string[]).push('malicious_event'),
    ).toThrow(TypeError)
    expect(EVENT_NAMES.length).toBe(before)
  })

  it('isCanonicalEventName narrows correctly', () => {
    expect(isCanonicalEventName('gallery_viewed')).toBe(true)
    expect(isCanonicalEventName('first_billed_call')).toBe(true)
    expect(isCanonicalEventName('not_a_real_event')).toBe(false)
    expect(isCanonicalEventName('')).toBe(false)
  })
})

describe('captureCanonicalEvent', () => {
  it('calls posthog.capture with the event name + properties', () => {
    const capture = vi.fn()
    const posthog = { capture } as unknown as Parameters<
      typeof captureCanonicalEvent
    >[0]
    captureCanonicalEvent(posthog, 'template_detail_viewed', {
      slug: 'neon-mcp',
      category: 'database',
    })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith('template_detail_viewed', {
      slug: 'neon-mcp',
      category: 'database',
    })
  })

  it('no-ops when posthog is null (provider not mounted yet)', () => {
    // Cast to bypass the typed `EventName` constraint — we want to
    // assert the runtime allow-list guard, not the TS one.
    expect(() =>
      captureCanonicalEvent(null, 'gallery_viewed', {}),
    ).not.toThrow()
    expect(() =>
      captureCanonicalEvent(undefined, 'gallery_viewed', {}),
    ).not.toThrow()
  })

  it('no-ops on a non-canonical event name (defense in depth)', () => {
    const capture = vi.fn()
    const posthog = { capture } as unknown as Parameters<
      typeof captureCanonicalEvent
    >[0]
    captureCanonicalEvent(
      posthog,
      // @ts-expect-error — exercising the runtime allow-list
      'malicious_event',
      {},
    )
    expect(capture).not.toHaveBeenCalled()
  })

  it('swallows posthog.capture throwing — never throws into product code', () => {
    const posthog = {
      capture: vi.fn(() => {
        throw new Error('CSP violation')
      }),
    } as unknown as Parameters<typeof captureCanonicalEvent>[0]
    expect(() =>
      captureCanonicalEvent(posthog, 'gallery_viewed', {}),
    ).not.toThrow()
  })
})

describe('forwardToPostHog', () => {
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

  it('skips the fetch and reports telemetry_disabled when apiKey absent', async () => {
    const fetchImpl = vi.fn()
    const result = await forwardToPostHog({
      event: 'gallery_viewed',
      properties: {},
      distinctId: 'd-1',
      apiKey: undefined,
      host: DEFAULT_POSTHOG_HOST,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({
      ok: false,
      status: 0,
      attempted: false,
      reason: 'telemetry_disabled',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('posts the documented body shape (api_key, event, distinct_id, properties, timestamp)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    const result = await forwardToPostHog({
      event: 'sdk_first_init',
      properties: { sdk_version: '0.2.0', org_id_hash: 'abc' },
      distinctId: 'abc',
      apiKey: 'phc_xyz',
      host: 'https://posthog.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: true, status: 200, attempted: true })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://posthog.test/i/v0/e/')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).redirect).toBe('error')
    expect((init as RequestInit).headers).toEqual({
      'Content-Type': 'application/json',
    })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(Object.keys(body).sort()).toEqual([
      'api_key',
      'distinct_id',
      'event',
      'properties',
      'timestamp',
    ])
    expect(body.api_key).toBe('phc_xyz')
    expect(body.event).toBe('sdk_first_init')
    expect(body.distinct_id).toBe('abc')
    expect(body.properties).toEqual({
      sdk_version: '0.2.0',
      org_id_hash: 'abc',
    })
    expect(body.timestamp).toMatch(ISO_RE)
  })

  it('strips a single trailing slash from the host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    await forwardToPostHog({
      event: 'gallery_viewed',
      properties: {},
      distinctId: 'd-1',
      apiKey: 'phc_x',
      host: 'https://posthog.test/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://posthog.test/i/v0/e/')
  })

  it('reports ok:false with the upstream status on non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('PostHog leak: tenant=abc', { status: 502 }),
    )
    const result = await forwardToPostHog({
      event: 'gallery_viewed',
      properties: {},
      distinctId: 'd-1',
      apiKey: 'phc_x',
      host: DEFAULT_POSTHOG_HOST,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, status: 502, attempted: true })
  })

  it('reports ok:false reason:AbortError on timeout (no throw)', async () => {
    // fetch that never resolves until aborted
    const fetchImpl = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    })
    const result = await forwardToPostHog({
      event: 'gallery_viewed',
      properties: {},
      distinctId: 'd-1',
      apiKey: 'phc_x',
      host: DEFAULT_POSTHOG_HOST,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      // 1 ms — abort fires almost immediately, the test stays fast
      timeoutMs: 1,
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
    expect(result.attempted).toBe(true)
    expect(result.reason).toBe('AbortError')
  })

  it('reports ok:false reason:forward_error on a non-Error rejection', async () => {
    const fetchImpl = vi.fn().mockRejectedValue('string-thrown-not-error')
    const result = await forwardToPostHog({
      event: 'gallery_viewed',
      properties: {},
      distinctId: 'd-1',
      apiKey: 'phc_x',
      host: DEFAULT_POSTHOG_HOST,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.ok).toBe(false)
    expect(result.attempted).toBe(true)
    expect(result.reason).toBe('forward_error')
  })

  it('honors a custom timeoutMs', async () => {
    let abortObserved = false
    const fetchImpl = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal
        if (signal) {
          signal.addEventListener('abort', () => {
            abortObserved = true
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      })
    })
    const before = Date.now()
    const result = await forwardToPostHog({
      event: 'gallery_viewed',
      properties: {},
      distinctId: 'd-1',
      apiKey: 'phc_x',
      host: DEFAULT_POSTHOG_HOST,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 50,
    })
    const elapsed = Date.now() - before
    expect(abortObserved).toBe(true)
    expect(result.ok).toBe(false)
    // Generous upper bound for CI; the assertion is "didn't wait
    // for the default 5s timeout" not "fired in exactly 50ms."
    expect(elapsed).toBeLessThan(2000)
  })
})
