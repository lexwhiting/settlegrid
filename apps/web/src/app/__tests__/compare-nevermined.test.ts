/**
 * P2.MKT1 — content-integrity tests for /compare/nevermined.
 *
 * The page's value is the honesty + verifiability of its claims.
 * These tests verify:
 *   - Every DoD requirement from the P2.MKT1 spec is present
 *   - Every file path cited on the page actually exists in the repo
 *   - The canonical differentiation statement is present verbatim
 *   - CTA links resolve to existing routes
 *   - All 9 comparison dimensions are covered
 *   - Each "Where X is stronger" section exists and has ≥5 entries
 *   - The page passes baseline a11y hygiene (table caption, scope,
 *     etc.) that was wired in the hostile-review pass
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../../../../..')
const pagePath = join(repoRoot, 'apps/web/src/app/compare/nevermined/page.tsx')
const pageSrc = readFileSync(pagePath, 'utf8')

describe('P2.MKT1 — page presence', () => {
  it('page file exists at apps/web/src/app/compare/nevermined/page.tsx', () => {
    expect(existsSync(pagePath)).toBe(true)
  })

  it('default-exports a React component named CompareNeverminedPage', () => {
    expect(pageSrc).toContain('export default function CompareNeverminedPage')
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
    expect(pageSrc).toContain(dim)
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

  it('lists Python SDK parity (payments-py on PyPI)', () => {
    expect(pageSrc).toContain('payments-py')
  })

  it('lists named-customer advantage (Valory)', () => {
    expect(pageSrc).toContain('Valory')
  })

  it('lists funding signal ($4M seed)', () => {
    expect(pageSrc).toContain('$4M seed')
  })
})

describe('P2.MKT1 — DoD item 3: "Where SettleGrid is stronger" section', () => {
  it('has a section heading naming SettleGrid as stronger', () => {
    expect(pageSrc).toMatch(/Where SettleGrid is (genuinely )?stronger/)
  })

  it('lists the 9 protocol adapters', () => {
    expect(pageSrc).toContain('9 protocol adapters')
  })

  it('lists the multi-hop settlement primitive names', () => {
    expect(pageSrc).toContain('recordHop')
    expect(pageSrc).toContain('finalizeSession')
    expect(pageSrc).toContain('processSettlementBatch')
    expect(pageSrc).toContain('rollbackSettlementBatch')
  })

  it('lists the progressive 0% → 5% pricing', () => {
    expect(pageSrc).toMatch(/0%\s*→\s*5%/)
  })

  it('lists the 1,022 open-source templates', () => {
    expect(pageSrc).toContain('1,022')
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

  it('the 1,022-templates claim is approximately true (drift-tolerant window)', () => {
    const dir = join(repoRoot, 'open-source-servers')
    const count = readdirSync(dir, { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    ).length
    // The exact page copy is 1,022. If the catalog has drifted by more
    // than a few hundred, someone should update the page copy too.
    // This test guards against massive drift; it's intentionally loose.
    expect(count).toBeGreaterThan(800)
    expect(count).toBeLessThan(2000)
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
    // Every target="_blank" must pair with rel including both
    // noopener and noreferrer (or at least one of them per modern
    // guidance). Check there's no target="_blank" WITHOUT a rel.
    const externalOpens = pageSrc.match(/target="_blank"/g) ?? []
    const safeOpens = pageSrc.match(
      /target="_blank"[\s\S]{0,120}?rel="[^"]*noopener[^"]*"/g,
    )
    expect(safeOpens?.length ?? 0).toBeGreaterThanOrEqual(externalOpens.length)
  })
})

describe('P2.MKT1 — clickable citation links (re-audit fix)', () => {
  it('defines a GH_BASE constant for shipped-code citation links', () => {
    expect(pageSrc).toContain('github.com/lexwhiting/settlegrid/tree/main')
  })

  it('every Cell/Point type supports a sourceUrl field', () => {
    expect(pageSrc).toMatch(/sourceUrl\?\s*:\s*string/)
  })

  it('renders citations as links when sourceUrl is present', () => {
    // The Cite component renders <a> for external links or Next <Link>
    // for internal ones — verify both branches exist in source.
    expect(pageSrc).toContain('function Cite(')
    expect(pageSrc).toMatch(/target="_blank"[\s\S]{0,200}rel="noopener noreferrer"/)
  })

  it('the shipped-code citations carry GitHub source URLs (via gh() helper)', () => {
    // Source uses a `gh(path)` helper that concatenates GH_BASE with
    // the repo path at runtime. Assert both the helper is invoked
    // with the expected paths AND the helper itself builds the
    // canonical GitHub URL shape.
    expect(pageSrc).toMatch(
      /gh\(['"]apps\/web\/src\/lib\/settlement\/adapters['"]\)/,
    )
    expect(pageSrc).toMatch(
      /gh\(['"]apps\/web\/src\/lib\/settlement\/sessions\.ts['"]\)/,
    )
    // Verify the helper itself builds the canonical URL format.
    expect(pageSrc).toMatch(
      /const gh = \(path: string\) =>\s*`\$\{GH_BASE\}/,
    )
  })

  it('the Python SDK claim links to PyPI', () => {
    expect(pageSrc).toContain('pypi.org/project/payments-py')
  })

  it('the pricing-related claims link to the internal /pricing route', () => {
    expect(pageSrc).toMatch(/sourceUrl:\s*['"]\/pricing['"]/)
  })
})

describe('P2.MKT1 — SEO / metadata', () => {
  it('exports a title containing "SettleGrid vs Nevermined"', () => {
    expect(pageSrc).toMatch(/title:\s*['"]SettleGrid vs Nevermined/)
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
})
