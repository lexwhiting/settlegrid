/**
 * Regression test for the embed.js stored XSS (launch-gate G2-1c).
 *
 * `GET /api/badge/embed.js?tool=<slug>` serves JavaScript that assigns an HTML
 * string built from tool `name`/`description`/`price`/`calls`/`slug` to
 * `c.innerHTML`, with `Access-Control-Allow-Origin: *` so any site can embed it
 * cross-origin via `<script src>`. The values are consumed as HTML, so they
 * must be HTML-escaped — a tool named `<img src=x onerror=…>` must appear as
 * `&lt;img …`, never as a raw `<img` that would execute in every embedding site.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockLimit } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: mockLimit,
  },
}))

vi.mock('@/lib/db/schema', () => ({
  tools: { name: 'name', slug: 'slug', description: 'description', pricingConfig: 'pricing_config', status: 'status', totalInvocations: 'total_invocations' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// trackEmbedImpression is fire-and-forget through tryRedis — make it a no-op.
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
  tryRedis: vi.fn().mockResolvedValue(undefined),
}))

const { GET } = await import('@/app/api/badge/embed.js/route')

function makeReq(tool: string): NextRequest {
  return new NextRequest(`https://settlegrid.ai/api/badge/embed.js?tool=${encodeURIComponent(tool)}`)
}

const ACTIVE = (over: Record<string, unknown> = {}) => [
  {
    name: 'Weather API',
    slug: 'weather-api',
    description: 'Forecasts',
    pricingConfig: { defaultCostCents: 50 },
    status: 'active',
    totalInvocations: 1234,
    ...over,
  },
]

beforeEach(() => {
  mockLimit.mockReset()
})

describe('badge embed.js — stored XSS escaping', () => {
  it('HTML-escapes a malicious tool name landing in innerHTML', async () => {
    mockLimit.mockResolvedValue(ACTIVE({ name: '<img src=x onerror=alert(1)>' }))
    const res = await GET(makeReq('weather-api'))
    const js = await res.text()
    expect(js).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(js).not.toContain('<img src=x onerror=alert(1)>')
    // The raw breakout `<` must not appear anywhere in the served markup.
    expect(js).not.toMatch(/<img/i)
  })

  it('HTML-escapes a malicious tool description', async () => {
    mockLimit.mockResolvedValue(ACTIVE({ description: '</span><svg onload=alert(1)>' }))
    const res = await GET(makeReq('weather-api'))
    const js = await res.text()
    expect(js).not.toMatch(/<svg/i)
    expect(js).toContain('&lt;svg onload=alert(1)&gt;')
  })

  it('HTML-escapes a quote in the slug used in the element id / JS string', async () => {
    mockLimit.mockResolvedValue(ACTIVE({ slug: "weather-api" }))
    // The element-id sites interpolate the request `?tool=` param directly.
    const res = await GET(makeReq("a'oops"))
    const js = await res.text()
    // No raw single quote can break out of the `getElementById('…')` JS string.
    expect(js).toContain('&#39;')
    expect(js).not.toContain("sg-badge-a'oops")
  })

  it('cannot break out of the not-found JS comment via `*/`', async () => {
    mockLimit.mockResolvedValue([]) // no tool → not-found comment path
    const res = await GET(makeReq('*/alert(document.domain)/*'))
    const js = await res.text()
    expect(js).not.toContain('*/alert')
    expect(js).not.toContain('alert(document.domain)')
    // Charset-stripped echo survives, harmlessly.
    expect(js).toContain('alertdocumentdomain')
  })

  it('serves a clean tool unchanged (no over-escaping of benign data)', async () => {
    mockLimit.mockResolvedValue(ACTIVE())
    const res = await GET(makeReq('weather-api'))
    const js = await res.text()
    expect(js).toContain('Weather API')
    expect(js).toContain('https://settlegrid.ai/tools/weather-api')
  })

  it('escapes newline / backslash so the served script still parses (availability-regression guard)', async () => {
    // A raw newline in a tool name/description lands inside the single-quoted
    // innerHTML JS string literal — if not escaped it is a SyntaxError and the
    // badge silently fails to render on every embedding site. (`new Function`
    // compiles the body for a syntax check; it does not execute it.)
    mockLimit.mockResolvedValue(ACTIVE({ name: 'Line1\nLine2', description: 'a\\b\rc' }))
    const res = await GET(makeReq('weather-api'))
    const js = await res.text()
    expect(() => new Function(js)).not.toThrow()
    expect(js).toContain('Line1\\nLine2') // newline escaped, not a raw break
  })
})
