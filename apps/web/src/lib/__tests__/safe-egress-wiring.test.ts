/**
 * Wiring-completeness guard (DC-16 antidote).
 *
 * `safeFetch` is only a guard if every untrusted-URL sink actually CALLS it.
 * This test pins that every known SSRF sink routes through `@/lib/safe-egress`
 * and that no attacker-controlled-host `fetch(` regressed back in. A forgotten
 * sink = an unguarded sink; this fails the build if one reappears.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..') // apps/web/src

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

/** Files that fetch a developer-/user-supplied HOST and must use safeFetch. */
const GUARDED_SINKS: Array<{ file: string; minCalls: number }> = [
  { file: 'app/api/proxy/[slug]/route.ts', minCalls: 4 }, // api-key, MPP, on-chain, SLA-fallback
  { file: 'lib/webhooks.ts', minCalls: 1 },
  { file: 'app/api/cron/health-checks/route.ts', minCalls: 1 },
  { file: 'app/api/tools/auto-detect/route.ts', minCalls: 3 }, // probe, MCP handshake, OpenAPI
  { file: 'app/api/tools/serve/[slug]/handlers.ts', minCalls: 1 }, // securityHeaders
  { file: 'lib/notifications.ts', minCalls: 2 }, // Slack + Discord
  { file: 'lib/tool-registry.ts', minCalls: 2 }, // scan_headers + check_csp
]

describe('safe-egress wiring completeness', () => {
  it.each(GUARDED_SINKS)('$file routes its untrusted fetches through safeFetch', ({ file, minCalls }) => {
    const src = read(file)
    expect(src).toMatch(/from '@\/lib\/safe-egress'/)
    const calls = (src.match(/safeFetch\(/g) ?? []).length
    expect(calls).toBeGreaterThanOrEqual(minCalls)
  })

  it('the proxy money rail has the pre-capture / pre-settlement sync guard', () => {
    const src = read('app/api/proxy/[slug]/route.ts')
    // lookupToolBySlug (all protocol/on-chain rails) + handleMppProxy (MPP) reject
    // a private/reserved literal BEFORE any irreversible settle/capture.
    const guards = (src.match(/assertSafeUrlSync\(/g) ?? []).length
    expect(guards).toBeGreaterThanOrEqual(2)
  })

  // DC-16 teeth: the count-only checks above pin a LOWER BOUND on guarded calls
  // but cannot detect a forgotten sink that coexists with the counted ones — that
  // is exactly what let the wikipedia `lang`→host raw fetch ship green. For files
  // whose every fetch targets an attacker-influenced host, assert NO raw `fetch(`
  // survives. (`safeFetch(` / `fetchJSON(` do not contain the lowercase substring
  // `fetch(`, so any match is a raw, unguarded fetch.)
  const NO_RAW_FETCH = [
    'app/api/proxy/[slug]/route.ts',
    'lib/webhooks.ts',
    'app/api/cron/health-checks/route.ts',
    'app/api/tools/auto-detect/route.ts',
    'lib/notifications.ts',
    'lib/tool-registry.ts',
  ]
  it.each(NO_RAW_FETCH)('%s has no raw fetch( — every egress goes through safeFetch', (file) => {
    const raw = read(file).match(/fetch\(/g) ?? []
    expect(raw, `raw fetch( bypasses the SSRF guard in ${file}`).toEqual([])
  })

  it('the four divergent string guards now delegate to the shared module', () => {
    // isWebhookUrlSafe + 3× isPrivateUrl → isPublicUrlString
    expect(read('lib/webhooks.ts')).toMatch(/isPublicUrlString\(/)
    expect(read('app/api/tools/auto-detect/route.ts')).toMatch(/isPublicUrlString\(/)
    expect(read('app/api/tools/quick-publish/route.ts')).toMatch(/isPublicUrlString\(/)
    expect(read('app/api/developer/tools/[id]/endpoint/route.ts')).toMatch(/isPublicUrlString\(/)
    // the old string-prefix denylists are gone
    expect(read('lib/webhooks.ts')).not.toMatch(/PRIVATE_IP_PREFIXES/)
  })
})
