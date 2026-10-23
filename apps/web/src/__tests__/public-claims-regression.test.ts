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

// ─── Docs API reference lists only routes that exist ────────────────────────

describe('Docs API reference', () => {
  const DOCS_PAGE_TSX = repoFile('apps/web/src/app/docs/page.tsx')

  it('does not list developer register/login REST endpoints', () => {
    expect(DOCS_PAGE_TSX).not.toContain('/api/auth/developer/register')
    expect(DOCS_PAGE_TSX).not.toContain('/api/auth/developer/login')
  })
})

// ─── No test-key / sandbox-mode claims ──────────────────────────────────────

// Consumer keys are always issued with the sg_live_ prefix; there is no way
// to create an sg_test_ key, so public copy must not offer one.
const PUBLIC_COPY_FILES = [
  'README.md',
  'apps/web/public/llms.txt',
  'apps/web/public/llms-full.txt',
  'apps/web/public/.well-known/mcp.json',
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/about/page.tsx',
  'apps/web/src/app/docs/page.tsx',
  'apps/web/src/app/faq/page.tsx',
  'apps/web/src/app/pricing/page.tsx',
  'apps/web/src/app/terms/page.tsx',
  'apps/web/src/app/learn/handbook/page.tsx',
  'apps/web/src/app/api/chat/route.ts',
  'apps/web/src/components/marketing/pricing-section.tsx',
  'apps/web/src/lib/blog-posts.ts',
  'apps/web/src/lib/blog-bodies/mcp-server-free-tier-usage-limits.md',
  'apps/web/src/lib/blog-bodies/mcp-server-payment-retry-logic.md',
  'apps/web/src/lib/blog-bodies/mcp-billing-comparison-2026.md',
  'apps/web/src/lib/blog-bodies/erc-8004-trustless-agent-identity.md',
].map((rel) => ({ name: rel, text: repoFile(rel) }))

describe('no test-key or sandbox-mode claims', () => {
  it.each(PUBLIC_COPY_FILES)("'$name' does not mention sg_test_ keys", ({ text }) => {
    expect(text).not.toContain('sg_test_')
  })

  it.each(PUBLIC_COPY_FILES)("'$name' does not offer a sandbox/test mode", ({ text }) => {
    expect(text).not.toMatch(/sandbox[- ]mode/i)
    expect(text).not.toMatch(/test[- ]mode transactions/i)
  })
})

// ─── No auto-refill claims ──────────────────────────────────────────────────

// Auto-refill is not reachable by consumers, so public copy and the
// low-balance email must not offer it.
const AUTO_REFILL_FILES = [
  'README.md',
  'apps/web/public/llms.txt',
  'apps/web/public/llms-full.txt',
  'apps/web/src/app/docs/page.tsx',
  'apps/web/src/app/faq/page.tsx',
  'apps/web/src/app/terms/page.tsx',
  'apps/web/src/app/learn/handbook/page.tsx',
  'apps/web/src/app/api/chat/route.ts',
].map((rel) => ({ name: rel, text: repoFile(rel) }))

describe('no auto-refill claims', () => {
  it.each(AUTO_REFILL_FILES)("'$name' does not mention auto-refill", ({ text }) => {
    expect(text).not.toMatch(/auto[- ]?refill/i)
  })
})

// ─── Small public text items ────────────────────────────────────────────────

describe('auth page titles', () => {
  it('register has its own title; the group default stays Sign In', () => {
    expect(repoFile('apps/web/src/app/(auth)/register/layout.tsx')).toContain(
      "title: 'Create Account | SettleGrid'",
    )
    expect(repoFile('apps/web/src/app/(auth)/layout.tsx')).toContain(
      "title: 'Sign In | SettleGrid'",
    )
  })
})

describe('pricing plan price', () => {
  it('renders a real space between the price and the period', () => {
    expect(repoFile('apps/web/src/app/pricing/page.tsx')).toContain(
      "{plan.price}</span>{' '}",
    )
  })
})

describe('academic page', () => {
  it('makes no fixed tool-count claim', () => {
    expect(repoFile('apps/web/src/app/academic/page.tsx')).not.toMatch(
      /\d[\d,]*\+\s*(monetized\s+)?AI tools/i,
    )
  })
})

// ─── No consumer referral promise ───────────────────────────────────────────

describe('pricing plan features', () => {
  it('does not list a consumer referral program', () => {
    expect(repoFile('apps/web/src/app/pricing/page.tsx')).not.toMatch(
      /consumer referral/i,
    )
  })
})

// ─── /status reads its redirect target at request time ──────────────────────

describe('status page', () => {
  it('is rendered per request so the status URL env takes effect without a rebuild', () => {
    expect(repoFile('apps/web/src/app/status/page.tsx')).toContain(
      "export const dynamic = 'force-dynamic'",
    )
  })
})
