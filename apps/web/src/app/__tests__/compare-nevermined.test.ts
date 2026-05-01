/**
 * P2.MKT1 / P4.MKT3 — content-integrity tests for /compare/nevermined.
 *
 * The page's value is the honesty + verifiability of its claims.
 * These tests verify:
 *   - Every DoD requirement from the P2.MKT1 / P4.MKT3 specs is present
 *   - Every file path cited on the page actually exists in the repo
 *   - The canonical differentiation statement is present verbatim
 *   - CTA links resolve to existing routes
 *   - All 9 comparison dimensions are covered
 *   - Each "Where X is stronger" section exists and has ≥5 entries
 *   - The page passes baseline a11y hygiene (table caption, scope, etc.)
 *
 * P4.MKT3 split: dimensions, neverminedStronger, settlegridStronger live
 * in `./data.ts` as the single source of truth. Tests that target
 * data-driven content read `dataSrc`; tests that target rendering or
 * page-level structure read `pageSrc`. Tests that don't care which file
 * the content lives in use `allSrc`.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  dimensions,
  neverminedStronger,
  settlegridStronger,
  SHIPPED_ADAPTERS,
  TEMPLATE_COUNT,
} from '../compare/nevermined/data'

const repoRoot = resolve(__dirname, '../../../../..')
const pagePath = join(repoRoot, 'apps/web/src/app/compare/nevermined/page.tsx')
const dataPath = join(repoRoot, 'apps/web/src/app/compare/nevermined/data.ts')
const pageSrc = readFileSync(pagePath, 'utf8')
const dataSrc = readFileSync(dataPath, 'utf8')
const allSrc = `${pageSrc}\n---DATA---\n${dataSrc}`

describe('P2.MKT1 — page presence', () => {
  it('page file exists at apps/web/src/app/compare/nevermined/page.tsx', () => {
    expect(existsSync(pagePath)).toBe(true)
  })

  it('default-exports a React component named CompareNeverminedPage', () => {
    expect(pageSrc).toContain('export default function CompareNeverminedPage')
  })

  it('data module exists at apps/web/src/app/compare/nevermined/data.ts', () => {
    expect(existsSync(dataPath)).toBe(true)
  })
})

describe('P2.MKT1 — DoD item 1: side-by-side table covering 9 dimensions', () => {
  const requiredDimensions = [
    'Protocol breadth',
    'Default rail',
    'Take rate',
    'SDK languages',
    'Named customers',
    'Multi-hop settlement primitives',
    'Framework distribution',
    'Geographic coverage',
    'Compliance posture',
  ]

  it.each(requiredDimensions)('includes "%s" dimension', (dim) => {
    // Dimension labels live in data.ts and are rendered by page.tsx.
    expect(dataSrc).toContain(dim)
  })

  it('uses a <table> element on desktop breakpoints', () => {
    expect(pageSrc).toMatch(/<table[\s>]/)
  })

  it('has a stacked-cards fallback for mobile (hidden md:block / md:hidden)', () => {
    expect(pageSrc).toContain('hidden md:block')
    expect(pageSrc).toContain('md:hidden')
  })
})

describe('P2.MKT1 — DoD item 2: "Where Nevermined is stronger" section', () => {
  it('has a section heading naming Nevermined as stronger', () => {
    expect(pageSrc).toMatch(/Where Nevermined is (genuinely )?stronger/)
  })

  it('lists Python SDK on PyPI (payments-py)', () => {
    expect(dataSrc).toContain('payments-py')
  })

  it('lists named-customer advantage (Valory)', () => {
    expect(dataSrc).toContain('Valory')
  })

  it('lists funding signal ($4M seed)', () => {
    expect(dataSrc).toContain('$4M seed')
  })
})

describe('P2.MKT1 — DoD item 3: "Where SettleGrid is stronger" section', () => {
  it('has a section heading naming SettleGrid as stronger', () => {
    expect(pageSrc).toMatch(/Where SettleGrid is (genuinely )?stronger/)
  })

  it('lists protocol adapters via SHIPPED_ADAPTERS (length-driven)', () => {
    // P4.MKT3 final: claim is now dynamic — `${SHIPPED_ADAPTERS.length}
    // protocol adapters shipped in production code`. This test reads the
    // resolved claim at runtime so it survives count changes.
    expect(SHIPPED_ADAPTERS.length).toBeGreaterThanOrEqual(9)
    expect(settlegridStronger[0].claim).toBe(
      `${SHIPPED_ADAPTERS.length} protocol adapters shipped in production code`,
    )
  })

  it('lists the multi-hop settlement primitive names', () => {
    expect(dataSrc).toContain('recordHop')
    expect(dataSrc).toContain('finalizeSession')
    expect(dataSrc).toContain('processSettlementBatch')
    expect(dataSrc).toContain('rollbackSettlementBatch')
  })

  it('lists the progressive 0% → 5% pricing', () => {
    expect(dataSrc).toMatch(/0%\s*→\s*5%/)
  })

  it('lists the open-source-server template count (computed at module load)', () => {
    // P4.MKT3 final: TEMPLATE_COUNT is computed from readdirSync at
    // module load — never goes stale silently. Assert the runtime
    // value is reasonable + the claim interpolates it.
    expect(TEMPLATE_COUNT).toBeGreaterThan(800)
    expect(TEMPLATE_COUNT).toBeLessThan(2000)
    expect(settlegridStronger[3].claim).toBe(
      `${TEMPLATE_COUNT} pre-wired open-source MCP server templates`,
    )
  })
})

describe('P2.MKT1 — DoD item 4: differentiation statement', () => {
  // The canonical phrase is wrapped across JSX lines in the source.
  // Normalize whitespace before matching so the test survives
  // reformatting and Prettier-driven line breaks.
  const normalized = pageSrc.replace(/\s+/g, ' ')

  it('includes the canonical "rail-neutral, protocol-neutral settlement layer for the long tail of AI tools" phrase', () => {
    expect(normalized).toContain(
      'rail-neutral, protocol-neutral settlement layer for the long tail of AI tools',
    )
  })

  it('places the positioning statement in the hero section (before the table)', () => {
    const phraseIdx = normalized.indexOf(
      'rail-neutral, protocol-neutral settlement layer for the long tail of AI tools',
    )
    const tableIdx = normalized.indexOf('<table')
    expect(phraseIdx).toBeGreaterThan(-1)
    expect(tableIdx).toBeGreaterThan(-1)
    expect(phraseIdx).toBeLessThan(tableIdx)
  })

  it('includes the full canonical paragraph (multi-hop + progressive pricing phrasing)', () => {
    expect(normalized).toContain(
      'Settlement sessions support multi-hop atomic workflows',
    )
    expect(normalized).toContain(
      'Progressive pricing means developers keep 100% of revenue under $1,000 per month',
    )
  })
})

describe('P2.MKT1 — DoD item 5: CTA → developer signup', () => {
  it('has a "Start with SettleGrid" CTA link', () => {
    expect(pageSrc).toContain('Start with SettleGrid')
  })

  it('CTA points at /register', () => {
    expect(pageSrc).toMatch(/href="\/register"[^>]*>\s*Start with SettleGrid/)
  })

  it('/register route exists in the app', () => {
    const registerPath = join(repoRoot, 'apps/web/src/app/(auth)/register')
    expect(existsSync(registerPath)).toBe(true)
  })
})

describe('P2.MKT1 — DoD item 6: mobile responsive', () => {
  it('table is hidden below md breakpoint (hidden md:block)', () => {
    expect(pageSrc).toContain('hidden md:block')
  })

  it('stacked cards are shown below md breakpoint (md:hidden)', () => {
    expect(pageSrc).toContain('md:hidden')
  })

  it('uses responsive typography (md:text-5xl)', () => {
    expect(pageSrc).toMatch(/text-4xl md:text-5xl/)
  })

  it('CTA button row stacks on mobile (flex-col sm:flex-row)', () => {
    expect(pageSrc).toContain('flex-col sm:flex-row')
  })
})

describe('P2.MKT1 — claim verifiability: every cited path exists', () => {
  const citedPaths = [
    'apps/web/src/lib/settlement/adapters/',
    'apps/web/src/lib/settlement/sessions.ts',
    'apps/web/src/app/pricing/page.tsx',
    'apps/web/src/lib/fraud.ts',
    'apps/web/src/lib/settlement/compliance.ts',
    'apps/web/src/lib/settlement/identity.ts',
    'apps/web/src/lib/settlement/currency.ts',
    'packages/mcp/src/adapters/',
    'open-source-servers/',
    'apps/web/src/lib/alipay-proxy.ts',
  ]

  it.each(citedPaths)('cited path "%s" exists in the repo', (p) => {
    expect(existsSync(join(repoRoot, p))).toBe(true)
  })

  it('the 9-adapter claim is true — settlement/adapters/ contains 9 adapter files', () => {
    const dir = join(repoRoot, 'apps/web/src/lib/settlement/adapters/')
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'),
    )
    expect(files).toHaveLength(9)
  })

  it('the multi-hop primitives are all exported from sessions.ts', () => {
    const src = readFileSync(
      join(repoRoot, 'apps/web/src/lib/settlement/sessions.ts'),
      'utf8',
    )
    expect(src).toMatch(/export\s+(async\s+)?function\s+recordHop/)
    expect(src).toMatch(/export\s+(async\s+)?function\s+finalizeSession/)
    expect(src).toMatch(/export\s+(async\s+)?function\s+processSettlementBatch/)
    expect(src).toMatch(/export\s+(async\s+)?function\s+rollbackSettlementBatch/)
  })

  it('TEMPLATE_COUNT matches the actual filesystem count exactly', () => {
    const dir = join(repoRoot, 'open-source-servers')
    const actual = readdirSync(dir, { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    ).length
    // P4.MKT3 final: dynamic computation means claim and reality
    // can never silently diverge. If they drift, fix data.ts (or
    // this test, if the path resolution changed).
    expect(TEMPLATE_COUNT).toBe(actual)
  })

  it('SHIPPED_ADAPTERS.length matches the actual adapter file count', () => {
    const dir = join(repoRoot, 'apps/web/src/lib/settlement/adapters/')
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'),
    )
    expect(SHIPPED_ADAPTERS.length).toBe(files.length)
  })
})

describe('P2.MKT1 — a11y hygiene (hostile-review follow-through)', () => {
  it('<table> has aria-label', () => {
    expect(pageSrc).toMatch(/<table[^>]+aria-label=/)
  })

  it('<table> has a sr-only <caption>', () => {
    expect(pageSrc).toMatch(/<caption className="sr-only">/)
  })

  it('column headers use scope="col"', () => {
    // At least one scope="col" exists for each header column.
    const matches = pageSrc.match(/scope="col"/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(3)
  })

  it('row header column uses scope="row"', () => {
    expect(pageSrc).toContain('scope="row"')
  })

  it('external links carry rel="noopener noreferrer"', () => {
    // Every target="_blank" must pair with rel including noopener.
    const externalOpens = pageSrc.match(/target="_blank"/g) ?? []
    const safeOpens = pageSrc.match(
      /target="_blank"[\s\S]{0,120}?rel="[^"]*noopener[^"]*"/g,
    )
    expect(safeOpens?.length ?? 0).toBeGreaterThanOrEqual(externalOpens.length)
  })
})

describe('P2.MKT1 — URL-safety wiring in the page', () => {
  // The helpers themselves are unit-tested in
  // compare-nevermined-helpers.test.ts. This suite asserts that page.tsx
  // and data.ts use them rather than rolling their own classifiers.
  it('page.tsx imports isSafeSourceUrl from ./helpers (P4.MKT3: gh moved to data.ts)', () => {
    expect(pageSrc).toMatch(/import\s*\{[^}]*\bisSafeSourceUrl\b[^}]*\}\s*from\s*['"]\.\/helpers['"]/)
  })

  it('data.ts imports gh from ./helpers (P4.MKT3 split)', () => {
    expect(dataSrc).toMatch(/import\s*\{[^}]*\bgh\b[^}]*\}\s*from\s*['"]\.\/helpers['"]/)
  })

  it('does NOT redefine the helpers inline (they live in ./helpers.ts)', () => {
    expect(pageSrc).not.toMatch(/^function isSafeSourceUrl/m)
    expect(pageSrc).not.toMatch(/^const gh = /m)
    expect(dataSrc).not.toMatch(/^function isSafeSourceUrl/m)
    expect(dataSrc).not.toMatch(/^function gh\(/m)
  })

  it('uses isSafeSourceUrl() rather than raw startsWith for link branching', () => {
    // Protect against a refactor that reverts to the buggy
    // startsWith('/') classification.
    expect(pageSrc).toContain('isSafeSourceUrl(')
  })

  it("uses Nevermined's canonical .ai domain (positioning doc source of truth)", () => {
    expect(allSrc).not.toContain('nevermined.io')
    expect(allSrc).toContain('nevermined.ai')
  })

  it('/pricing internal route exists (target of two claims\' sourceUrl)', () => {
    const pricingPage = join(repoRoot, 'apps/web/src/app/pricing/page.tsx')
    expect(existsSync(pricingPage)).toBe(true)
  })
})

describe('P2.MKT1 — clickable citation links (re-audit fix)', () => {
  it('uses GitHub as the shipped-code citation target (via gh() helper)', () => {
    // GH_REPO_BASE now lives in helpers.ts — verify it through the
    // helpers file directly.
    const helpersPath = join(
      repoRoot,
      'apps/web/src/app/compare/nevermined/helpers.ts',
    )
    expect(existsSync(helpersPath)).toBe(true)
    const helpersSrc = readFileSync(helpersPath, 'utf8')
    expect(helpersSrc).toContain('GH_REPO_BASE')
    expect(helpersSrc).toContain('github.com/lexwhiting/settlegrid')
  })

  it('every Cell/Point type supports a sourceUrl field (defined in data.ts)', () => {
    expect(dataSrc).toMatch(/sourceUrl\?\s*:\s*string/)
  })

  it('renders citations as links when sourceUrl is present', () => {
    // The Cite component renders <a> for external links or Next <Link>
    // for internal ones — verify both branches exist in source.
    expect(pageSrc).toContain('function Cite(')
    expect(pageSrc).toMatch(/target="_blank"[\s\S]{0,200}rel="noopener noreferrer"/)
  })

  it('the shipped-code citations invoke gh() with the expected paths (in data.ts)', () => {
    expect(dataSrc).toMatch(
      /gh\(['"]apps\/web\/src\/lib\/settlement\/adapters['"]\)/,
    )
    expect(dataSrc).toMatch(
      /gh\(['"]apps\/web\/src\/lib\/settlement\/sessions\.ts['"]\)/,
    )
  })

  it('the Python SDK claim links to PyPI (payments-py specifically)', () => {
    expect(dataSrc).toContain('pypi.org/project/payments-py')
    // P4.MKT3 sharpened the GitHub URL too.
    expect(dataSrc).toContain('github.com/nevermined-io/payments-py')
  })

  it('the pricing-related claims link to the internal /pricing route', () => {
    expect(dataSrc).toMatch(/sourceUrl:\s*['"]\/pricing['"]/)
  })
})

describe('P2.MKT1 / P4.MKT3 — SEO / metadata', () => {
  it('exports a title containing "SettleGrid vs. Nevermined" (P4.MKT3 spec wording)', () => {
    // Spec wording: "SettleGrid vs. Nevermined: Honest Comparison"
    expect(pageSrc).toMatch(/title:\s*['"]SettleGrid vs\.? Nevermined/)
  })

  it('exports a canonical URL pointing at /compare/nevermined', () => {
    expect(pageSrc).toContain('https://settlegrid.ai/compare/nevermined')
  })

  it('emits JSON-LD BreadcrumbList structured data', () => {
    expect(pageSrc).toContain('BreadcrumbList')
  })

  it('declares OpenGraph metadata (title + type)', () => {
    expect(pageSrc).toMatch(/openGraph:\s*{/)
    expect(pageSrc).toMatch(/type:\s*['"]article['"]/)
  })

  it('has an opengraph-image route (Next.js auto-detection)', () => {
    const ogImagePath = join(
      repoRoot,
      'apps/web/src/app/compare/nevermined/opengraph-image.tsx',
    )
    expect(existsSync(ogImagePath)).toBe(true)
  })
})

describe('P4.MKT3 — anti-regression on staleness fixes', () => {
  it('"Public x402 facilitator as a network service" is no longer a Nevermined-stronger claim', () => {
    // P4.MKT2 shipped facilitator.settlegrid.ai on 2026-04-29. Both
    // projects now operate a public facilitator; this is no longer a
    // Nevermined-only differentiator. The phrase may still appear in
    // an explanatory comment in data.ts, so anchor on the structural
    // pattern `claim: '...'` to guard against the live claim re-entering.
    expect(dataSrc).not.toMatch(
      /claim:\s*['"]Public x402 facilitator/,
    )
  })

  it('Asia-Pacific rail stubs cite the real file path, not the stale settlement/adapters/ one', () => {
    // The strategy doc said adapters/, but the actual files live at
    // apps/web/src/lib/*-proxy.ts. The exact stale cite text was
    // "apps/web/src/lib/settlement/adapters/ (experimental" — if it
    // returns, this test catches it. The new cite ends with
    // "apps/web/src/lib/ (experimental status documented per file)".
    expect(dataSrc).not.toContain(
      'apps/web/src/lib/settlement/adapters/ (experimental',
    )
    expect(dataSrc).toContain('apps/web/src/lib/alipay-proxy.ts')
  })

  it('Python SDK claim acknowledges packages/sdk-python (not just "no Python SDK yet")', () => {
    // Honest framing: SettleGrid has Python SDK in monorepo at v0.1.0
    // but not yet published to PyPI. payments-py IS on PyPI.
    expect(dataSrc).toContain('packages/sdk-python')
    expect(dataSrc).toContain('not yet published')
  })

  it('Take rate cite matches the live /pricing tiers (2.5% in $10K-$50K bracket)', () => {
    // Hostile round caught compare page citing 3% in the middle
    // bracket while /pricing ships 2.5%. Guard against re-divergence.
    expect(dataSrc).toContain('2.5% $10K–$50K')
    expect(dataSrc).not.toMatch(/3% \$10K[^$]*\$50K/)
  })

  it('data.ts has a Citation policy block', () => {
    // Future reviewers need to know the rules for sharpening Nevermined
    // URLs and refreshing counts. Block lives in the file header.
    expect(dataSrc).toContain('Citation policy')
  })

  it('Last reviewed date in page.tsx is after the strategy doc snapshot (2026-04-17)', () => {
    // If someone refreshes data.ts content but forgets to bump the
    // reviewed date, this test surfaces the staleness.
    const match = pageSrc.match(/Last reviewed:\s*(\d{4}-\d{2}-\d{2})/)
    expect(match).not.toBeNull()
    const reviewedDate = match![1]
    expect(reviewedDate >= '2026-04-30').toBe(true)
  })

  it('"PayPal for AI narrative" is no longer a neverminedStronger claim (was an inference, spec §1 forbids)', () => {
    // P4.MKT3 final: removed because the spec disallows inferences,
    // and "PayPal for AI" framing was SettleGrid's interpretation of
    // Nevermined's positioning, not a fact Nevermined publishes.
    expect(neverminedStronger.find((p) => p.claim.includes('PayPal for AI'))).toBeUndefined()
  })

  it('every neverminedStronger item has a sourceUrl (no unsourced bullets)', () => {
    // Spec implementation step 2: "replace any unsourced bullet with
    // a citation or remove it". P4.MKT3 final pass added permalinks
    // for funding + virtual cards; "PayPal for AI" was removed.
    for (const point of neverminedStronger) {
      expect(point.sourceUrl, `Missing sourceUrl for: ${point.claim}`).toBeTruthy()
    }
  })

  it('Public funding signal links to a real funding-news permalink', () => {
    const funding = neverminedStronger.find((p) =>
      p.claim.includes('Public funding signal'),
    )
    expect(funding).toBeDefined()
    expect(funding!.sourceUrl).toMatch(/^https:\/\//)
    expect(funding!.sourceUrl).not.toBe('https://nevermined.ai')
  })

  it('Live virtual card issuance links to the specific Nevermined blog post (not the homepage)', () => {
    const cards = neverminedStronger.find((p) =>
      p.claim.includes('Live virtual card issuance'),
    )
    expect(cards).toBeDefined()
    expect(cards!.sourceUrl).toContain('nevermined.ai/blog/')
  })
})

describe('P4.MKT3 — sitemap + cross-link integration', () => {
  it('sitemap.ts includes the /compare/nevermined entry', () => {
    const sitemapSrc = readFileSync(
      join(repoRoot, 'apps/web/src/app/sitemap.ts'),
      'utf8',
    )
    expect(sitemapSrc).toContain('/compare/nevermined')
  })

  it('homepage hero has a Compare-to-Nevermined link', () => {
    const heroSrc = readFileSync(
      join(repoRoot, 'apps/web/src/components/marketing/hero.tsx'),
      'utf8',
    )
    expect(heroSrc).toMatch(/href="\/compare\/nevermined"/)
  })

  it('x402-facilitator-launch blog post cross-links the comparison page', () => {
    const launchSrc = readFileSync(
      join(repoRoot, 'apps/web/src/lib/blog-bodies/x402-facilitator-launch.md'),
      'utf8',
    )
    expect(launchSrc).toContain('settlegrid.ai/compare/nevermined')
  })

  it('Show HN response kit cross-links the comparison page', () => {
    const kitSrc = readFileSync(
      join(repoRoot, 'docs/launch/show-hn-response-kit.md'),
      'utf8',
    )
    expect(kitSrc).toContain('settlegrid.ai/compare/nevermined')
  })
})
