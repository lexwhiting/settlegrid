/**
 * tool-registry SSRF guard (G2-2) — the shared `fetchJSON` helper must route
 * through `safeFetch`, because the wikipedia handlers interpolate the
 * attacker-controlled `lang` arg into the request HOST
 * (`https://${lang}.wikipedia.org/...`). `lang="127.0.0.1/"` ⇒ host 127.0.0.1.
 * This endpoint is PUBLIC + UNAUTHENTICATED (/api/tools/[slug]/call), so an
 * unguarded fetchJSON is a live read/blind SSRF. Regression guard for that miss.
 */
import { describe, it, expect } from 'vitest'
import { TOOL_REGISTRY } from '@/lib/tool-registry'

const wiki = TOOL_REGISTRY['wikipedia'].methods

/** True iff the error (or its cause chain) is an egress/SSRF block, NOT a plain
 *  network failure — distinguishes "the guard fired" from "connect refused". */
function isSsrfBlock(e: unknown): boolean {
  const a = e as { name?: string; message?: string; cause?: { name?: string; message?: string } }
  const blob = `${a?.name}|${a?.message}|${a?.cause?.name}|${a?.cause?.message}`
  return /SsrfBlockedError|SSRF guard|literal:|resolved:|:loopback|:link-local|:private|:unspecified/.test(blob)
}

const PRIVATE_LANGS = ['127.0.0.1/', '169.254.169.254/', '[::1]/', '192.168.0.1/', '2130706433/']

describe('tool-registry fetchJSON SSRF guard — wikipedia lang→host injection', () => {
  for (const method of ['get_summary', 'search', 'get_random'] as const) {
    it.each(PRIVATE_LANGS)(`wikipedia.${method} blocks lang=%s at the egress guard`, async (lang) => {
      const args = method === 'search' ? { query: 'x', lang } : { title: 'x', lang }
      let err: unknown
      try {
        await wiki[method].handler(args)
      } catch (e) {
        err = e
      }
      expect(err, 'handler must reject for a private lang host').toBeDefined()
      expect(isSsrfBlock(err), `must be an SSRF block, got: ${String((err as Error)?.message)}`).toBe(true)
    })
  }

  it('does NOT block a normal public lang at the guard layer (no over-block)', async () => {
    // 'en' → en.wikipedia.org (public). A network failure in CI is fine; an
    // SSRF block is NOT (that would be a false positive breaking the tool).
    try {
      await wiki.get_summary.handler({ title: 'Test', lang: 'en' })
    } catch (e) {
      expect(isSsrfBlock(e)).toBe(false)
    }
  })
})
