/**
 * Unit tests for `safeJsonLd` (launch-gate G2-1) — the single source of truth
 * for serializing JSON-LD into a `<script type="application/ld+json">` tag.
 *
 * Two load-bearing properties, both required:
 *   1. SECURITY — the output can never close the host `<script>` tag, even when
 *      a value contains a literal `</script>` breakout. (A no-op `.replace(/</g,
 *      '<')` helper would leave a literal `</script` and fail this.)
 *   2. ROUND-TRIP — the output is still valid JSON that `JSON.parse` decodes
 *      back to the original object, with NO manual un-escaping. (An `&lt;`
 *      "helper" would corrupt the JSON and fail this.)
 */
import { describe, it, expect } from 'vitest'
import { safeJsonLd } from '@/lib/json-ld'

describe('safeJsonLd', () => {
  it('neutralizes a `</script>` breakout (security property)', () => {
    const out = safeJsonLd({ x: '</script><script>alert(1)</script>' })
    // No literal `</script` survives to end the host script tag.
    expect(out).not.toMatch(/<\/script/i)
    // Every `<` is escaped to its unicode form.
    expect(out).not.toContain('<')
    expect(out).toContain('\\u003c')
  })

  it('round-trips through a DIRECT JSON.parse (no manual un-escape)', () => {
    const input = { x: '</script><script>alert(1)</script>', n: 42, nested: { a: ['<b>', 'c'] } }
    expect(JSON.parse(safeJsonLd(input))).toEqual(input)
  })

  it('is a no-op for `<`-free payloads (matches JSON.stringify output)', () => {
    const input = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'SettleGrid' }
    expect(safeJsonLd(input)).toBe(JSON.stringify(input))
  })

  it('escapes EVERY `<`, not just the first', () => {
    const out = safeJsonLd({ a: '<', b: '<<<' })
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual({ a: '<', b: '<<<' })
  })
})
