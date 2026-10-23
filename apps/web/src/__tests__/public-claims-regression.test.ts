/**
 * Regression tests for public marketing / docs / legal copy that must stay
 * aligned with what the product actually does. Files are read as text so the
 * assertions cover string literals that are not exported.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..')

function repoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), 'utf8')
}

// ─── Smart Proxy snippet uses the header the proxy reads ────────────────────

describe('Smart Proxy homepage snippet', () => {
  const SMART_PROXY_TSX = repoFile(
    'apps/web/src/components/marketing/smart-proxy.tsx',
  )

  it('passes the consumer key in the x-api-key header', () => {
    expect(SMART_PROXY_TSX).toContain('-H "x-api-key: sg_live_..."')
    expect(SMART_PROXY_TSX).toContain('"x-api-key: sg_live_..."')
  })

  it('does not show an Authorization: Bearer sg_ header', () => {
    expect(SMART_PROXY_TSX).not.toMatch(/Authorization:\s*Bearer\s+sg_/)
  })
})
