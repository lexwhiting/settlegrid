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
 * `apiCall` is reached via the `__internal__` namespace exported from
 * middleware.ts — that namespace is marked `@internal` so tsup strips
 * it from the published .d.ts, keeping the public SDK surface clean.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __internal__ } from '../middleware'

const { apiCall } = __internal__
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

  // ─── P1.SDK3: InsufficientCreditsError.topUpUrl is populated from body ────
  it('402 with topUpUrl in body: InsufficientCreditsError carries the custom URL', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        {
          requiredCents: 500,
          availableCents: 200,
          topUpUrl: 'https://settlegrid.ai/top-up?tool=unit-tested-tool',
        },
        402,
      ),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as InsufficientCreditsError
    expect(err).toBeInstanceOf(InsufficientCreditsError)
    expect(err.requiredCents).toBe(500)
    expect(err.availableCents).toBe(200)
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up?tool=unit-tested-tool')
    // Message must include the custom URL (not the hardcoded fallback)
    expect(err.message).toContain('unit-tested-tool')
  })

  it('402 without topUpUrl in body: InsufficientCreditsError uses the default URL', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ requiredCents: 100, availableCents: 25 }, 402),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as InsufficientCreditsError
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up')
  })

  // ─── 4. 404 with code: 'TOOL_NOT_FOUND' → ToolNotFoundError ──────────────
  it('404 with code: TOOL_NOT_FOUND: throws ToolNotFoundError carrying the slug', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: 'not found', code: 'TOOL_NOT_FOUND' }, 404),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ToolNotFoundError)
    expect((caught as Error).message).toContain('unit-tested-tool')
    expect((caught as ToolNotFoundError).statusCode).toBe(404)
    expect((caught as ToolNotFoundError).code).toBe('TOOL_NOT_FOUND')
  })

  it('404 WITHOUT the TOOL_NOT_FOUND code: falls through to SettleGridUnavailableError', async () => {
    // A 404 without an explicit `code` could mean anything (wrong path,
    // deleted resource, reverse proxy 404). Don't mis-label it as a
    // tool-not-found error.
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'gone' }, 404))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeInstanceOf(ToolNotFoundError)
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    expect((caught as Error).message).toContain('gone')
  })

  it('404 with a DIFFERENT code: falls through to SettleGridUnavailableError', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: 'path missing', code: 'RESOURCE_MISSING' }, 404),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeInstanceOf(ToolNotFoundError)
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
  })

  // ─── 5. 403 with code: 'TOOL_DISABLED' → ToolDisabledError ────────────────
  it('403 with code: TOOL_DISABLED: throws ToolDisabledError carrying the slug', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: 'disabled', code: 'TOOL_DISABLED' }, 403),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ToolDisabledError)
    expect((caught as Error).message).toContain('unit-tested-tool')
    expect((caught as ToolDisabledError).statusCode).toBe(403)
    expect((caught as ToolDisabledError).code).toBe('TOOL_DISABLED')
  })

  it('403 WITHOUT the TOOL_DISABLED code: falls through to SettleGridUnavailableError', async () => {
    // A 403 could be IP blocking, CSRF, WAF, etc. Don't claim it's a
    // tool-disabled error unless the server says so.
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeInstanceOf(ToolDisabledError)
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    expect((caught as Error).message).toContain('forbidden')
  })

  it('403 with a DIFFERENT code: falls through to SettleGridUnavailableError', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: 'ip blocked', code: 'IP_BLOCKED' }, 403),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeInstanceOf(ToolDisabledError)
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
  })

  // ─── 6. 429 → RateLimitedError with retryAfterMs ─────────────────────────
  it('429: throws RateLimitedError with retryAfterMs + retryAfterSeconds from Retry-After header', async () => {
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
    const err = caught as RateLimitedError
    expect(err.retryAfterMs).toBe(30_000)
    // P1.SDK3: retryAfterSeconds accessor matches the header value
    expect(err.retryAfterSeconds).toBe(30)
    expect(err.statusCode).toBe(429)
  })

  it('429 with retryAfterSeconds in body (no Retry-After header): falls back to body value', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ retryAfterSeconds: 45 }, 429))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as RateLimitedError
    expect(err).toBeInstanceOf(RateLimitedError)
    expect(err.retryAfterMs).toBe(45_000)
    expect(err.retryAfterSeconds).toBe(45)
  })

  it('429: header takes precedence over body retryAfterSeconds', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ retryAfterSeconds: 999 }, 429, { 'retry-after': '10' }),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as RateLimitedError
    // Header wins — body value ignored
    expect(err.retryAfterSeconds).toBe(10)
  })

  // ─── Coverage close-out: body.retryAfterSeconds validation branches ───────
  // The 429 fallback chain validates body.retryAfterSeconds before using it:
  //   typeof === 'number' && Number.isFinite && >= 0
  // Previously only the "valid finite positive number" path was tested
  // directly. Exercise each rejection path so a future regression (e.g.
  // accepting NaN or negative values) surfaces immediately.

  it('429 with body.retryAfterSeconds = 0: uses 0 (valid zero, not fallback)', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ retryAfterSeconds: 0 }, 429))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as RateLimitedError
    // Zero is a valid "retry immediately" hint — NOT treated as falsy
    expect(err.retryAfterSeconds).toBe(0)
    expect(err.retryAfterMs).toBe(0)
  })

  it('429 with body.retryAfterSeconds = NaN: falls back to 60s default', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ retryAfterSeconds: Number.NaN }, 429))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as RateLimitedError
    expect(err.retryAfterSeconds).toBe(60)
  })

  it('429 with body.retryAfterSeconds = negative: falls back to 60s default', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ retryAfterSeconds: -10 }, 429))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as RateLimitedError
    expect(err.retryAfterSeconds).toBe(60)
  })

  it('429 with body.retryAfterSeconds = non-number: falls back to 60s default', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ retryAfterSeconds: '30' }, 429),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as RateLimitedError
    // String '30' looks numeric but fails the strict typeof === 'number'
    // check — falls back to default rather than silently coercing.
    expect(err.retryAfterSeconds).toBe(60)
  })

  it('429 with body.retryAfterSeconds = Infinity: falls back to 60s default', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ retryAfterSeconds: Number.POSITIVE_INFINITY }, 429),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as RateLimitedError
    expect(err.retryAfterSeconds).toBe(60)
  })

  it('RateLimitedError.fromSeconds static factory converts seconds → ms', () => {
    // Direct smoke test of the factory introduced in P1.SDK3 spec-diff
    // fix — verifies the middleware's use site is backed by a clean
    // conversion semantic. 45 seconds → 45_000 ms, getter round-trips.
    const err = RateLimitedError.fromSeconds(45)
    expect(err).toBeInstanceOf(RateLimitedError)
    expect(err.retryAfterMs).toBe(45_000)
    expect(err.retryAfterSeconds).toBe(45)
    expect(err.statusCode).toBe(429)
    expect(err.code).toBe('RATE_LIMITED')
  })

  it('RateLimitedError.fromSeconds handles zero and fractional seconds (round-trip safe)', () => {
    expect(RateLimitedError.fromSeconds(0).retryAfterMs).toBe(0)
    expect(RateLimitedError.fromSeconds(0).retryAfterSeconds).toBe(0)
    // Fractional inputs are FLOORED in the factory (hostile-review fix)
    // so the round-trip through the getter is lossless:
    //   fromSeconds(1.5) → Math.floor(1.5) * 1000 = 1000ms → getter = 1
    // Matches RFC 7231's integer-seconds Retry-After convention.
    const frac = RateLimitedError.fromSeconds(1.5)
    expect(frac.retryAfterMs).toBe(1000)
    expect(frac.retryAfterSeconds).toBe(1)
    // Consistency: what goes in (floored) comes out.
    expect(RateLimitedError.fromSeconds(2.99).retryAfterSeconds).toBe(2)
  })

  // ─── Hostile-review fix tests (P1.SDK3 hostile pass) ──────────────────────

  it('RateLimitedError.fromSeconds rejects negative seconds', () => {
    expect(() => RateLimitedError.fromSeconds(-1)).toThrow(TypeError)
    expect(() => RateLimitedError.fromSeconds(-1)).toThrow(/non-negative/)
  })

  it('RateLimitedError.fromSeconds rejects NaN', () => {
    expect(() => RateLimitedError.fromSeconds(NaN)).toThrow(TypeError)
    expect(() => RateLimitedError.fromSeconds(NaN)).toThrow(/finite/)
  })

  it('RateLimitedError.fromSeconds rejects Infinity and -Infinity', () => {
    expect(() => RateLimitedError.fromSeconds(Infinity)).toThrow(TypeError)
    expect(() => RateLimitedError.fromSeconds(-Infinity)).toThrow(TypeError)
  })

  it('RateLimitedError.fromSeconds rejects non-number input (runtime bypass of TS)', () => {
    expect(() =>
      RateLimitedError.fromSeconds('30' as unknown as number),
    ).toThrow(TypeError)
  })

  it('InsufficientCreditsError with explicit null topUpUrl: falls back to default URL', async () => {
    // Server returning { topUpUrl: null } used to leak "Top up at null"
    // into the error message because JS default-parameter syntax only
    // triggers on undefined, not null.
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { requiredCents: 100, availableCents: 25, topUpUrl: null },
        402,
      ),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as InsufficientCreditsError
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up')
    expect(err.message).not.toContain('null')
  })

  it('InsufficientCreditsError with explicit empty-string topUpUrl: falls back to default URL', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { requiredCents: 100, availableCents: 25, topUpUrl: '' },
        402,
      ),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as InsufficientCreditsError
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up')
  })

  it('InsufficientCreditsError with non-string topUpUrl (number): falls back to default URL', async () => {
    // Server returning `{ topUpUrl: 42 }` (typed as string at TS level
    // but any JSON value at runtime) must not leak into the message.
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { requiredCents: 100, availableCents: 25, topUpUrl: 42 },
        402,
      ),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as InsufficientCreditsError
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up')
    expect(err.message).not.toContain('42 cents')  // not mistaken for amount
    expect(err.message).toContain('https://settlegrid.ai/top-up')
  })

  it('InsufficientCreditsError with non-string topUpUrl (array): falls back to default URL', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(
        { requiredCents: 100, availableCents: 25, topUpUrl: ['not', 'a', 'url'] },
        402,
      ),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    const err = caught as InsufficientCreditsError
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up')
  })

  it('InsufficientCreditsError direct construction with null (bypasses middleware)', () => {
    // Defense-in-depth: even if some future caller bypasses the middleware
    // and calls the constructor directly with null, the default URL is used.
    const err = new InsufficientCreditsError(
      100,
      25,
      null as unknown as string,
    )
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up')
    expect(err.message).not.toContain('null')
  })

  it('InsufficientCreditsError direct construction with empty string (bypasses middleware)', () => {
    const err = new InsufficientCreditsError(100, 25, '')
    expect(err.topUpUrl).toBe('https://settlegrid.ai/top-up')
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

  // ─── 7. 500 → SettleGridUnavailableError (field-level assertions) ────────
  it('500: throws SettleGridUnavailableError with statusCode + code + message fields', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'internal' }, 500))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    const err = caught as SettleGridUnavailableError
    // SettleGridUnavailableError always maps to 503 as its SDK statusCode,
    // regardless of the upstream status (500, 502, 503, etc.) — that's
    // the class's fixed contract.
    expect(err.statusCode).toBe(503)
    expect(err.code).toBe('SERVER_ERROR')
    expect(err.message).toMatch(/internal/)
  })

  // ─── 8. 503 → SettleGridUnavailableError (field-level assertions) ────────
  it('503: throws SettleGridUnavailableError with statusCode + code + message fields', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, 503))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    const err = caught as SettleGridUnavailableError
    expect(err.statusCode).toBe(503)
    expect(err.code).toBe('SERVER_ERROR')
    // Default message includes the original upstream status when no body error
    expect(err.message).toMatch(/503/)
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

  // ─── Hostile-review fix tests: defensive `data` normalization ─────────────
  // Before the fix, a 4xx response with body `null` (or any non-object JSON)
  // would crash apiCall with a TypeError ("Cannot read properties of null"),
  // which the outer catch then wrapped in NetworkError — masking the real
  // status code from the consumer.

  it('401 with literal `null` body still throws InvalidKeyError (not NetworkError)', async () => {
    // Build a Response whose body parses to JSON null
    fetchSpy.mockResolvedValue(
      new Response('null', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(apiCall(baseConfig, '/validate-key', {})).rejects.toBeInstanceOf(
      InvalidKeyError,
    )
  })

  it('402 with literal `null` body still throws InsufficientCreditsError', async () => {
    fetchSpy.mockResolvedValue(
      new Response('null', {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(InsufficientCreditsError)
    expect((caught as InsufficientCreditsError).requiredCents).toBe(0)
    expect((caught as InsufficientCreditsError).availableCents).toBe(0)
  })

  it('500 with literal `null` body still throws SettleGridUnavailableError', async () => {
    fetchSpy.mockResolvedValue(
      new Response('null', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(apiCall(baseConfig, '/meter', {})).rejects.toBeInstanceOf(
      SettleGridUnavailableError,
    )
  })

  it('402 with array body normalizes to {} and uses defaults', async () => {
    fetchSpy.mockResolvedValue(jsonResponse([1, 2, 3], 402))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(InsufficientCreditsError)
    expect((caught as InsufficientCreditsError).requiredCents).toBe(0)
    expect((caught as InsufficientCreditsError).availableCents).toBe(0)
  })

  it('401 with primitive number body normalizes to {} and uses default message', async () => {
    fetchSpy.mockResolvedValue(
      new Response('42', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(apiCall(baseConfig, '/validate-key', {})).rejects.toBeInstanceOf(
      InvalidKeyError,
    )
  })

  it('500 with primitive string body normalizes to {} and falls back to status message', async () => {
    fetchSpy.mockResolvedValue(
      new Response('"server exploded"', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    let caught: unknown
    try {
      await apiCall(baseConfig, '/meter', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    // Falls back to "API returned 500" — primitive body has no `error` field
    expect((caught as Error).message).toMatch(/500/)
  })

  // ─── Hostile-review fix test: parse error message preservation ────────────
  // Before the fix, the inner `catch {}` discarded the SyntaxError without
  // binding it, so the underlying parse failure was invisible during
  // debugging. Now the original message is appended to the typed error.
  it('200 with malformed JSON: error message includes the underlying parse failure', async () => {
    fetchSpy.mockResolvedValue(textResponse('{ broken: not_json }', 200))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/x', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(SettleGridUnavailableError)
    const message = (caught as Error).message
    expect(message).toMatch(/200/)
    expect(message).toMatch(/not valid JSON/)
    // The colon-prefixed underlying SyntaxError text is appended (e.g.
    // "...not valid JSON: Unexpected token b in JSON at position 2").
    expect(message).toContain(':')
  })

  // ─── Coverage close-out: success-path JSON value variants ────────────────
  // The success path has two distinct null routes:
  //   1. Empty body  → caught by `text.length === 0` shortcut (covered)
  //   2. Body 'null' → flows through JSON.parse('null') → returns null
  // Both produce the same end result but exercise different code paths.
  it('200 with literal JSON `null` body: returns null via JSON.parse path', async () => {
    fetchSpy.mockResolvedValue(textResponse('null', 200))
    const result = await apiCall(baseConfig, '/x', {})
    expect(result).toBeNull()
  })

  it('200 with primitive JSON number body: returns the number', async () => {
    // JSON primitives are valid responses per RFC 8259. apiCall returns
    // them as-is; callers must know whether to expect an object.
    fetchSpy.mockResolvedValue(textResponse('42', 200))
    const result = await apiCall<number>(baseConfig, '/count', {})
    expect(result).toBe(42)
  })

  it('200 with primitive JSON boolean body: returns the boolean', async () => {
    fetchSpy.mockResolvedValue(textResponse('true', 200))
    const result = await apiCall<boolean>(baseConfig, '/healthcheck', {})
    expect(result).toBe(true)
  })

  // ─── Coverage close-out: empty error-string field on 4xx ──────────────────
  // Documents that `{ error: '' }` is passed straight to the error class
  // constructor, producing an error with empty message. This is the
  // current behavior — distinct from `{ error: undefined }` which would
  // cause the constructor's default-value parameter to kick in.
  it('401 with `{ error: "" }` empty-string body: passes empty string to constructor', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ error: '' }, 401))
    let caught: unknown
    try {
      await apiCall(baseConfig, '/validate-key', {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(InvalidKeyError)
    // Empty string is "truthy enough" to override the default-message
    // parameter, so the error message is the empty string.
    expect((caught as Error).message).toBe('')
  })
})
