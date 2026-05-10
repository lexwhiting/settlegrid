/**
 * P5.K1 — kernel-telemetry unit tests.
 *
 * Coverage:
 *   - Event-name allow-list (KERNEL_EVENT_NAMES + isKernelEventName)
 *   - sanitizeFreeText: PII redaction, control char strip, length cap
 *   - sanitizeEnumLike: refuse special chars, length cap
 *   - sanitizeDevId: UUID-shaped only, null otherwise
 *   - sanitizeNonNegNumber: NaN/Inf/negative → 0
 *   - sanitizeEvent: per-event-shape end-to-end
 *   - createKernelEmitter: never throws on bad input
 *   - memoryKernelEmitter: collects sanitized events
 *   - opt-out: SETTLEGRID_TELEMETRY=0 yields a no-op emitter
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  KERNEL_EVENT_NAMES,
  __setKernelFetchForTests,
  createKernelEmitter,
  isKernelEventName,
  isKernelTelemetryOptedOut,
  memoryKernelEmitter,
  noopKernelEmitter,
  sanitizeDevId,
  sanitizeEnumLike,
  sanitizeEvent,
  sanitizeFreeText,
  sanitizeNonNegNumber,
} from '../kernel-telemetry'

afterEach(() => {
  __setKernelFetchForTests(undefined)
  delete process.env.SETTLEGRID_TELEMETRY
})

describe('KERNEL_EVENT_NAMES', () => {
  it('contains the five P5.K1 event types in fixed order', () => {
    expect(KERNEL_EVENT_NAMES).toEqual([
      'kernel.request_received',
      'kernel.routing_decision',
      'kernel.adapter_latency_ms',
      'kernel.adapter_error',
      'kernel.invocation_settled',
    ])
  })

  it('isKernelEventName accepts the canonical names and rejects others', () => {
    for (const n of KERNEL_EVENT_NAMES) {
      expect(isKernelEventName(n)).toBe(true)
    }
    expect(isKernelEventName('gallery_viewed')).toBe(false)
    expect(isKernelEventName('kernel.unknown')).toBe(false)
    expect(isKernelEventName('')).toBe(false)
  })
})

describe('sanitizeFreeText', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeFreeText(null)).toBe('')
    expect(sanitizeFreeText(undefined)).toBe('')
    expect(sanitizeFreeText(42)).toBe('')
    expect(sanitizeFreeText({})).toBe('')
  })

  it('strips control characters', () => {
    expect(sanitizeFreeText('hello\x00world')).toBe('helloworld')
    expect(sanitizeFreeText('foo\x1fbar')).toBe('foobar')
  })

  it('takes only the first non-blank line (no stack-trace flooding)', () => {
    expect(sanitizeFreeText('first line\nsecond line')).toBe('first line')
    expect(sanitizeFreeText('first\r\nsecond')).toBe('first')
  })

  it('truncates to 200 chars with ellipsis', () => {
    const long = 'a'.repeat(300)
    const out = sanitizeFreeText(long)
    expect(out.length).toBe(200)
    expect(out.endsWith('…')).toBe(true)
  })

  it('redacts PII-shaped content (email, URL, long digit run)', () => {
    expect(sanitizeFreeText('contact alice@example.com')).toBe('[redacted]')
    expect(sanitizeFreeText('see https://example.com/x')).toBe('[redacted]')
    expect(sanitizeFreeText('record id 12345678')).toBe('[redacted]')
  })

  it('passes clean error messages unchanged', () => {
    expect(sanitizeFreeText('insufficient credits')).toBe(
      'insufficient credits',
    )
  })

  it('returns empty string for whitespace-only', () => {
    expect(sanitizeFreeText('   \n  ')).toBe('')
  })
})

describe('sanitizeEnumLike', () => {
  it('accepts kebab-case / dotted identifiers', () => {
    expect(sanitizeEnumLike('mcp')).toBe('mcp')
    expect(sanitizeEnumLike('x402')).toBe('x402')
    expect(sanitizeEnumLike('foo.bar-baz_qux')).toBe('foo.bar-baz_qux')
  })

  it('rejects whitespace, special chars, and SQL-shaped content', () => {
    expect(sanitizeEnumLike('foo bar')).toBe('')
    expect(sanitizeEnumLike("'; DROP TABLE")).toBe('')
    expect(sanitizeEnumLike('foo;bar')).toBe('')
    expect(sanitizeEnumLike('foo\nbar')).toBe('')
  })

  it('rejects empty / overlong / non-string', () => {
    expect(sanitizeEnumLike('')).toBe('')
    expect(sanitizeEnumLike('a'.repeat(65))).toBe('')
    expect(sanitizeEnumLike(null)).toBe('')
    expect(sanitizeEnumLike(42)).toBe('')
  })

  it('rejects strings starting with hyphen / dot', () => {
    expect(sanitizeEnumLike('-foo')).toBe('')
    expect(sanitizeEnumLike('.foo')).toBe('')
  })
})

describe('sanitizeDevId', () => {
  it('accepts UUID-shaped strings (any version)', () => {
    expect(sanitizeDevId('AABBCCDD-1234-5678-9ABC-DEFFEDCBA987')).toBe(
      'aabbccdd-1234-5678-9abc-deffedcba987',
    )
  })

  it('returns null for non-UUID', () => {
    expect(sanitizeDevId('not-a-uuid')).toBe(null)
    expect(sanitizeDevId('alice@example.com')).toBe(null)
    expect(sanitizeDevId(42)).toBe(null)
    expect(sanitizeDevId(null)).toBe(null)
    expect(sanitizeDevId(undefined)).toBe(null)
  })
})

describe('sanitizeNonNegNumber', () => {
  it('passes finite non-negative numbers', () => {
    expect(sanitizeNonNegNumber(0)).toBe(0)
    expect(sanitizeNonNegNumber(42)).toBe(42)
    expect(sanitizeNonNegNumber(0.5)).toBe(0.5)
  })

  it('clamps negative / NaN / Infinity to 0', () => {
    expect(sanitizeNonNegNumber(-1)).toBe(0)
    expect(sanitizeNonNegNumber(Number.NaN)).toBe(0)
    expect(sanitizeNonNegNumber(Number.POSITIVE_INFINITY)).toBe(0)
    expect(sanitizeNonNegNumber(Number.NEGATIVE_INFINITY)).toBe(0)
  })

  it('coerces numeric strings; rejects non-numeric strings', () => {
    expect(sanitizeNonNegNumber('42')).toBe(42)
    expect(sanitizeNonNegNumber('not-a-number')).toBe(0)
    expect(sanitizeNonNegNumber('-5')).toBe(0)
  })
})

describe('sanitizeEvent', () => {
  it('cleans request_received', () => {
    const out = sanitizeEvent({
      name: 'kernel.request_received',
      props: {
        adapter: 'mcp',
        protocol: 'mcp',
        currency: 'USD',
        amount_cents: 5,
        dev_id: '00000000-0000-4000-8000-000000000001',
      },
    })
    expect(out.props).toEqual({
      adapter: 'mcp',
      protocol: 'mcp',
      currency: 'USD',
      amount_cents: 5,
      dev_id: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('redacts PII in adapter_error.error_message', () => {
    const out = sanitizeEvent({
      name: 'kernel.adapter_error',
      props: {
        adapter: 'x402',
        error_class: 'NetworkError',
        error_message: 'failed for user alice@example.com',
      },
    })
    if (out.name !== 'kernel.adapter_error') throw new Error('discriminant')
    expect(out.props.error_message).toBe('[redacted]')
  })

  it('rejects malformed adapter slug', () => {
    const out = sanitizeEvent({
      name: 'kernel.adapter_latency_ms',
      props: {
        adapter: "'; DROP TABLE kernel_telemetry;",
        latency_ms: 100,
        success: true,
      },
    })
    expect(out.props.adapter).toBe('')
  })

  it('coerces NaN-shaped numbers in invocation_settled', () => {
    const out = sanitizeEvent({
      name: 'kernel.invocation_settled',
      props: {
        adapter: 'mcp',
        rail: 'mcp',
        amount_cents: Number.NaN,
        take_cents: -1,
        latency_ms: Number.POSITIVE_INFINITY,
      },
    })
    if (out.name !== 'kernel.invocation_settled') throw new Error('discriminant')
    expect(out.props.amount_cents).toBe(0)
    expect(out.props.take_cents).toBe(0)
    expect(out.props.latency_ms).toBe(0)
  })

  it('drops bad entries from routing_decision.alternatives_considered', () => {
    const out = sanitizeEvent({
      name: 'kernel.routing_decision',
      props: {
        adapter: 'mcp',
        rail: 'mcp',
        reason: 'phase-1 protocol-match routing',
        alternatives_considered: ['mcp', 'x402', 'evil; rm -rf /', '', 42 as unknown as string],
        fee_bps: 0,
      },
    })
    if (out.name !== 'kernel.routing_decision') throw new Error('discriminant')
    expect(out.props.alternatives_considered).toEqual(['mcp', 'x402'])
  })
})

describe('memoryKernelEmitter', () => {
  it('collects sanitized events', () => {
    const m = memoryKernelEmitter()
    m.emit({
      name: 'kernel.request_received',
      props: {
        adapter: 'mcp',
        protocol: 'mcp',
        currency: 'USD',
        amount_cents: 5,
        dev_id: null,
      },
    })
    expect(m.events).toHaveLength(1)
    expect(m.events[0].name).toBe('kernel.request_received')
  })

  it('clear() empties the buffer', () => {
    const m = memoryKernelEmitter()
    m.emit({
      name: 'kernel.adapter_latency_ms',
      props: { adapter: 'mcp', latency_ms: 5, success: true },
    })
    expect(m.events).toHaveLength(1)
    m.clear()
    expect(m.events).toHaveLength(0)
  })

  it('never throws on garbage input', () => {
    const m = memoryKernelEmitter()
    expect(() =>
      m.emit({
        name: 'kernel.adapter_latency_ms',
        // @ts-expect-error — intentionally bad shape
        props: { adapter: null, latency_ms: 'fast', success: 'yes' },
      }),
    ).not.toThrow()
  })
})

describe('createKernelEmitter (HTTP)', () => {
  it('POSTs sanitized event to apiUrl + /api/telemetry/kernel', async () => {
    const calls: { url: string; body: unknown }[] = []
    const fakeFetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) })
      return new Response(null, { status: 200 })
    })
    __setKernelFetchForTests(fakeFetch as unknown as typeof fetch)

    const emitter = createKernelEmitter({ apiUrl: 'https://api.example.com' })
    emitter.emit({
      name: 'kernel.request_received',
      props: {
        adapter: 'mcp',
        protocol: 'mcp',
        currency: 'USD',
        amount_cents: 5,
        dev_id: null,
      },
    })

    // Microtask drain.
    await new Promise((r) => setImmediate(r))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.example.com/api/telemetry/kernel')
    const body = calls[0].body as { name: string; props: Record<string, unknown> }
    expect(body.name).toBe('kernel.request_received')
    expect(body.props.adapter).toBe('mcp')
  })

  it('emit() never throws even when fetch rejects synchronously', () => {
    __setKernelFetchForTests(
      ((): unknown => {
        throw new Error('boom')
      }) as unknown as typeof fetch,
    )
    const emitter = createKernelEmitter({ apiUrl: 'https://api.example.com' })
    expect(() =>
      emitter.emit({
        name: 'kernel.adapter_latency_ms',
        props: { adapter: 'mcp', latency_ms: 5, success: true },
      }),
    ).not.toThrow()
  })

  it('returns no-op emitter when SETTLEGRID_TELEMETRY=0', async () => {
    process.env.SETTLEGRID_TELEMETRY = '0'
    expect(isKernelTelemetryOptedOut()).toBe(true)
    const fakeFetch = vi.fn(async () => new Response(null, { status: 200 }))
    __setKernelFetchForTests(fakeFetch as unknown as typeof fetch)
    const emitter = createKernelEmitter({ apiUrl: 'https://api.example.com' })
    emitter.emit({
      name: 'kernel.adapter_latency_ms',
      props: { adapter: 'mcp', latency_ms: 5, success: true },
    })
    await new Promise((r) => setImmediate(r))
    expect(fakeFetch).not.toHaveBeenCalled()
  })
})

describe('noopKernelEmitter', () => {
  it('returns an emitter that does nothing', () => {
    const e = noopKernelEmitter()
    expect(() =>
      e.emit({
        name: 'kernel.adapter_latency_ms',
        props: { adapter: 'mcp', latency_ms: 5, success: true },
      }),
    ).not.toThrow()
  })
})
