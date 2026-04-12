/**
 * Direct unit tests for the SDK's HTTP client (`apiCall`).
 *
 * `apiCall` is the only function in the SDK that moves money — every
 * /validate-key, /meter, /credit-balance, etc. call routes through it.
 * Before P1.SDK2 it was covered only indirectly via createMiddleware
 * mocks, leaving the actual fetch behavior, status-to-error mapping,
 * timeout handling, and AbortController cleanup uncovered.
 *
 * This file mocks `globalThis.fetch` with `vi.spyOn` and asserts each
 * status-code branch produces the right typed error.
 *
 * @internal apiCall is exported with `@internal` JSDoc — tsup strips
 *           it from published .d.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiCall } from '../middleware'
import type { NormalizedConfig } from '../config'
import {
  InsufficientCreditsError,
  InvalidKeyError,
  NetworkError,
  RateLimitedError,
  SettleGridUnavailableError,
  TimeoutError,
  ToolDisabledError,
  ToolNotFoundError,
} from '../errors'

const baseConfig: NormalizedConfig = {
  apiUrl: 'https://settlegrid.ai',
  toolSlug: 'unit-tested-tool',
  debug: false,
  cacheTtlMs: 0,
  timeoutMs: 5000,
}

// Helper: build a real `Response` with JSON body, status, and optional headers.
function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(body === null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

// Helper: build a `Response` with raw text body (for empty / malformed cases).
function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  })
}

describe('apiCall — HTTP client error mapping', () => {
  // `fetchSpy` is the vi.spyOn return — let TypeScript infer the type from
  // the assignment in beforeEach. Pre-declaring the type runs into a
  // genericity mismatch with vi.spyOn's overloads vs. fetch's overloads.
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as ReturnType<typeof vi.fn>
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── 1. 200 success → returns parsed JSON body ────────────────────────────
  it('200 success: returns parsed JSON body', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ valid: true, balanceCents: 5000 }))
    const result = await apiCall<{ valid: boolean; balanceCents: number }>(
      baseConfig,
      '/validate-key',
      { apiKey: 'sg_live_test' },
    )
    expect(result).toEqual({ valid: true, balanceCents: 5000 })
  })

  it('200 success: posts to the correct URL with JSON body', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }))
    await apiCall(baseConfig, '/meter', { foo: 'bar' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const call = fetchSpy.mock.calls[0]
    expect(call[0]).toBe('https://settlegrid.ai/api/sdk/meter')
    const init = call[1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
    expect(JSON.parse(init.body as string)).toEqual({ foo: 'bar' })
  })

  // ─── 2. 401 → InvalidKeyError ────────────────────────────────────────────
  it('401: throws InvalidKeyError', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'bad key' }, 401))
    await expect(apiCall(baseConfig, '/validate-key', {})).rejects.toBeInstanceOf(
      InvalidKeyError,
    )
  })

  it('401: error message includes the body error string', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'key revoked' }, 401))
    await expect(apiCall(baseConfig, '/validate-key', {})).rejects.toThrow(
      /key revoked/,
    )
  })

  // ─── 3. 402 → InsufficientCreditsError ────────────────────────────────────
  it('402: throws InsufficientCreditsError with required/available cents', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ requiredCents: 100, availableCents: 25 }, 402),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(InsufficientCreditsError)
    const err = caught as InsufficientCreditsError
    expect(err.requiredCents).toBe(100)
    expect(err.availableCents).toBe(25)
    expect(err.statusCode).toBe(402)
  })

  it('402: defaults required/available to 0 when body has neither', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, 402))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as InsufficientCreditsError
    expect(err).toBeInstanceOf(InsufficientCreditsError)
    expect(err.requiredCents).toBe(0)
    expect(err.availableCents).toBe(0)
  })

  // ─── 4. 404 → ToolNotFoundError ───────────────────────────────────────────
  it('404: throws ToolNotFoundError carrying the toolSlug', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'not found' }, 404))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ToolNotFoundError)
    expect((caught as Error).message).toContain('unit-tested-tool')
    expect((caught as ToolNotFoundError).statusCode).toBe(404)
  })

  // ─── 5. 403 → ToolDisabledError ───────────────────────────────────────────
  it('403: throws ToolDisabledError carrying the toolSlug', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'disabled' }, 403))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ToolDisabledError)
    expect((caught as Error).message).toContain('unit-tested-tool')
    expect((caught as ToolDisabledError).statusCode).toBe(403)
  })

  // ─── 6. 429 → RateLimitedError with retryAfterMs ─────────────────────────
  it('429: throws RateLimitedError with retryAfterMs from Retry-After header', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: 'rate limited' }, 429, { 'retry-after': '30' }),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(RateLimitedError)
    // 30 seconds → 30_000 ms
    expect((caught as RateLimitedError).retryAfterMs).toBe(30_000)
    expect((caught as RateLimitedError).statusCode).toBe(429)
  })

  it('429: defaults retryAfterMs to 60_000 when Retry-After is missing', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, 429))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect((caught as RateLimitedError).retryAfterMs).toBe(60_000)
  })

  it('429: defaults retryAfterMs to 60_000 when Retry-After is unparseable (HTTP-date)', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({}, 429, { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect((caught as RateLimitedError).retryAfterMs).toBe(60_000)
  })

  // ─── 7. 500 → SettleGridUnavailableError ──────────────────────────────────
  it('500: throws SettleGridUnavailableError', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'internal' }, 500))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    expect((caught as Error).message).toMatch(/internal/)
  })

  // ─── 8. 503 → SettleGridUnavailableError ──────────────────────────────────
  it('503: throws SettleGridUnavailableError', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, 503))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    // Default message includes the original status when no body error
    expect((caught as Error).message).toMatch(/503/)
  })

  // ─── 9. AbortError → TimeoutError ─────────────────────────────────────────
  it('AbortError: throws TimeoutError carrying timeoutMs', async () => {
    fetchSpy.mockImplementation(() => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TimeoutError)
    expect((caught as Error).message).toContain('5000')
  })

  // ─── 10. Network error (fetch rejects) → NetworkError ─────────────────────
  it('fetch rejects with non-AbortError: throws NetworkError', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed: connection refused'))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(NetworkError)
    expect((caught as Error).message).toMatch(/connection refused/)
  })

  it('fetch rejects with non-Error value: still throws NetworkError', async () => {
    fetchSpy.mockRejectedValue('something weird')
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(NetworkError)
    expect((caught as Error).message).toMatch(/Unknown network error/)
  })

  // ─── 11. JSON parse failure on 200 body → SettleGridUnavailableError ─────
  it('200 with malformed JSON body: throws SettleGridUnavailableError mentioning the status', async () => {
    fetchSpy.mockResolvedValue(textResponse('{ not valid json', 200))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    expect((caught as Error).message).toMatch(/200/)
    expect((caught as Error).message).toMatch(/not valid JSON/)
  })

  // ─── 12. Successful 200 with empty body → returns null ────────────────────
  it('200 with empty body: returns null', async () => {
    fetchSpy.mockResolvedValue(textResponse('', 200))
    const result = await apiCall(baseConfig, '/meter', {})
    expect(result).toBeNull()
  })

  // ─── Bonus: AbortController cleanup ───────────────────────────────────────
  it('clearTimeout is called even when fetch throws (no leaked timer)', async () => {
    // Spy on clearTimeout to verify it runs in the finally block.
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    fetchSpy.mockRejectedValue(new TypeError('boom'))
    await expect(apiCall(baseConfig, '/x', {})).rejects.toBeInstanceOf(NetworkError)
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('clearTimeout is called on success path too', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    fetchSpy.mockResolvedValue(jsonResponse({ ok: true }))
    await apiCall(baseConfig, '/x', {})
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  // ─── Bonus: error response with non-JSON body still produces typed error ──
  it('error response with non-JSON body still produces a typed error', async () => {
    // 500 with HTML body — `await response.json().catch(() => ({}))` swallows
    // the parse failure so the catch-all default branch still throws.
    fetchSpy.mockResolvedValue(textResponse('<html>500 internal</html>', 500))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/x', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    expect((caught as Error).message).toMatch(/500/)
  })

  // ─── Bonus: Retry-After with negative value falls back to default ─────────
  it('429: negative Retry-After value falls back to 60_000 default', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, 429, { 'retry-after': '-10' }))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect((caught as RateLimitedError).retryAfterMs).toBe(60_000)
  })

  // ─── Bonus: 200 success with array body ───────────────────────────────────
  it('200 success: parses JSON arrays correctly', async () => {
    fetchSpy.mockResolvedValue(jsonResponse([1, 2, 3]))
    const result = await apiCall<number[]>(baseConfig, '/list', {})
    expect(result).toEqual([1, 2, 3])
  })
})
