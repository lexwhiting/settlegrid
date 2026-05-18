import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  safeValidateTemplateManifest,
  type TemplateManifest,
} from '@settlegrid/mcp'
import {
  mapCategory,
  TEMPLATER_TO_GALLERY_CATEGORY,
} from '../lib/templater-categories.mjs'
import { buildRegistry } from '../build-registry'
import { applyPricingToManifest } from '../sync-template-pricing'
import { extractServerPricing as extractServerPricingTs } from '../lib/template-pricing'

// ──────────────────────────────────────────────────────────────────────────
// Dynamic import of the .mjs generator — variable path so TS doesn't try
// to resolve the module type, mirroring the runtime pattern Phase 1's
// Templater uses at agents/templater/tools.ts#generateTemplateFiles.
// ──────────────────────────────────────────────────────────────────────────

let generateFromSpec: (s: unknown) => Record<string, string>
let generateManifest: (s: unknown) => Record<string, unknown>
let extractServerPricing: (
  src: string,
) => { defaultCostCents: number; methods?: Record<string, { costCents: number; displayName?: string; unitType?: string }> }
let gen: (s: unknown) => void

beforeAll(async () => {
  const genPath = '/Users/lex/settlegrid/scripts/gen/core.mjs'
  const mod = (await import(genPath)) as {
    generateFromSpec: typeof generateFromSpec
    generateManifest: typeof generateManifest
    extractServerPricing: typeof extractServerPricing
    gen: typeof gen
  }
  generateFromSpec = mod.generateFromSpec
  generateManifest = mod.generateManifest
  extractServerPricing = mod.extractServerPricing
  gen = mod.gen
})

// ──────────────────────────────────────────────────────────────────────────
// Fixture
// ──────────────────────────────────────────────────────────────────────────

const FIXTURE_SERVER_TS = `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'cat-facts',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_fact: { costCents: 2, displayName: 'Get a random cat fact' },
      list_breeds: { costCents: 3, displayName: 'List breeds' },
    },
  },
})

export const getFact = sg.wrap(async () => ({ fact: 'meow' }), {
  method: 'get_fact',
})
export const listBreeds = sg.wrap(async () => ({ breeds: [] }), {
  method: 'list_breeds',
})
`

const BASE_SPEC = {
  slug: 'cat-facts',
  title: 'Cat Facts',
  desc: 'Get random cat facts from the Cat Facts API.',
  api: { base: 'https://catfact.ninja', name: 'Cat Facts', docs: 'https://catfact.ninja/docs' },
  key: null,
  keywords: ['cats', 'facts', 'animals', 'feline'],
  methods: [
    {
      name: 'get_fact',
      display: 'Get a random cat fact',
      cost: 2,
      params: 'limit?: number',
      inputs: [
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'list_breeds',
      display: 'List breeds',
      cost: 3,
      params: '',
      inputs: [],
    },
  ],
  serverTs: FIXTURE_SERVER_TS,
} as const

// ──────────────────────────────────────────────────────────────────────────
// generateFromSpec — file map shape
// ──────────────────────────────────────────────────────────────────────────

describe('generateFromSpec', () => {
  it('emits 10 files including template.json (was 9 pre-fix)', () => {
    const files = generateFromSpec({ ...BASE_SPEC, category: 'rag' })
    const keys = Object.keys(files).sort()
    expect(keys).toEqual(
      [
        '.env.example',
        '.gitignore',
        'Dockerfile',
        'LICENSE',
        'README.md',
        'package.json',
        'src/server.ts',
        'template.json',
        'tsconfig.json',
        'vercel.json',
      ].sort(),
    )
  })

  it('preserves the legacy 9 files unchanged (no regressions in non-manifest output)', () => {
    const files = generateFromSpec({ ...BASE_SPEC, category: 'rag' })
    // Just-touch a handful of the existing assertions from
    // agents/templater/__tests__/templater.test.ts's `generateTemplateFiles`
    // describe so a regression in the legacy paths surfaces here too.
    const pkg = JSON.parse(files['package.json']) as { name: string; dependencies: Record<string, string> }
    expect(pkg.name).toBe('settlegrid-cat-facts')
    expect(pkg.dependencies).toHaveProperty('@settlegrid/mcp')
    expect(files['Dockerfile']).toContain('EXPOSE 3000')
    expect(files['src/server.ts']).toBe(FIXTURE_SERVER_TS)
    expect(files['README.md']).toContain('settlegrid-cat-facts')
  })
})

// ──────────────────────────────────────────────────────────────────────────
// template.json — the manifest emission (the point of this task)
// ──────────────────────────────────────────────────────────────────────────

describe('template.json emission', () => {
  it('produces a manifest that validates against templateManifestSchema', () => {
    const files = generateFromSpec({ ...BASE_SPEC, category: 'rag' })
    const manifest = JSON.parse(files['template.json']) as unknown
    const result = safeValidateTemplateManifest(manifest)
    expect(result.success).toBe(true)
    if (!result.success) {
      throw new Error(`Manifest invalid: ${result.errors.join('; ')}`)
    }
  })

  it('maps a Templater slug to its gallery enum (rag → ai)', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.category).toBe('ai')
    expect(mapCategory('rag')).toBe('ai')
  })

  it('defaults manifest.category to "other" when spec has no category', () => {
    const m = generateManifest(BASE_SPEC) as TemplateManifest
    expect(m.category).toBe('other')
  })

  it('defaults manifest.category to "other" for unrecognised Templater slugs', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'totally-made-up' }) as TemplateManifest
    expect(m.category).toBe('other')
  })

  it('prepends the Templater slug as the first tag (matches backfill convention)', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'observability' }) as TemplateManifest
    expect(m.tags[0]).toBe('observability')
    expect(m.tags).toContain('cats')
    expect(m.tags).toContain('feline')
  })

  it('drops settlegrid/mcp/ai boilerplate from tags', () => {
    const m = generateManifest({
      ...BASE_SPEC,
      keywords: ['settlegrid', 'mcp', 'ai', 'cats', 'facts'],
      category: 'rag',
    }) as TemplateManifest
    expect(m.tags).not.toContain('settlegrid')
    expect(m.tags).not.toContain('mcp')
    expect(m.tags).not.toContain('ai')
    expect(m.tags).toContain('cats')
    expect(m.tags).toContain('facts')
  })

  it('caps tags at 10 and dedupes', () => {
    const m = generateManifest({
      ...BASE_SPEC,
      keywords: ['cats', 'cats', 'facts', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
      category: 'rag',
    }) as TemplateManifest
    expect(m.tags.length).toBeLessThanOrEqual(10)
    // Dedupes 'cats'
    expect(m.tags.filter((t: string) => t === 'cats').length).toBe(1)
  })

  it('builds capabilities from spec.methods (snake_case method names)', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.capabilities).toEqual(['get_fact', 'list_breeds'])
  })

  it('emits per-method pricing.methods extracted from serverTs', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.pricing.methods).toBeDefined()
    expect(m.pricing.methods).toEqual({
      get_fact: { costCents: 2, displayName: 'Get a random cat fact' },
      list_breeds: { costCents: 3, displayName: 'List breeds' },
    })
  })

  it('pricing.perCallUsdCents equals defaultCostCents from serverTs (byte-identical to SDK metering)', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.pricing.perCallUsdCents).toBe(2)
    // Cross-check: same value the .mjs parser sees in the same serverTs.
    expect(extractServerPricing(FIXTURE_SERVER_TS).defaultCostCents).toBe(2)
  })

  it('falls back to spec.methods for pricing.methods when serverTs has no pricing block', () => {
    const m = generateManifest({
      ...BASE_SPEC,
      serverTs: 'export const placeholder = 1\n'.padEnd(100, ' '),
      category: 'rag',
    }) as TemplateManifest
    // perCallUsdCents falls back to defaultCostCents=1 (extractServerPricing
    // default when no pricing block found).
    expect(m.pricing.perCallUsdCents).toBe(1)
    // methods fall back to spec.methods.
    expect(m.pricing.methods).toEqual({
      get_fact: { costCents: 2, displayName: 'Get a random cat fact' },
      list_breeds: { costCents: 3, displayName: 'List breeds' },
    })
  })

  it('repo.url uses the canonical settlegrid- prefix', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.repo.url).toBe('https://github.com/settlegrid/settlegrid-cat-facts')
  })

  it('author block is the canonical Alerterra/SettleGrid author', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.author).toEqual({
      name: 'Alerterra, LLC',
      url: 'https://settlegrid.ai',
      github: 'settlegrid',
    })
  })

  it('manifest version is 1.0.0 (single canonical initial version)', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.version).toBe('1.0.0')
  })

  it('runtime/languages/entry/quality match the template scaffold', () => {
    const m = generateManifest({ ...BASE_SPEC, category: 'rag' }) as TemplateManifest
    expect(m.runtime).toBe('node')
    expect(m.languages).toEqual(['ts'])
    expect(m.entry).toBe('src/server.ts')
    expect(m.quality).toEqual({ tests: false })
    expect(m.featured).toBe(false)
  })

  it('every Templater category in the shared map maps to a valid gallery enum', () => {
    // The freshly-generated manifest must validate for any Templater slug
    // we'd hit in production. Probe one fixture per known slug.
    for (const slug of Object.keys(TEMPLATER_TO_GALLERY_CATEGORY)) {
      const m = generateManifest({ ...BASE_SPEC, category: slug }) as TemplateManifest
      const result = safeValidateTemplateManifest(m)
      expect(
        result.success,
        result.success ? '' : `Slug "${slug}" produced invalid manifest: ${result.errors.join('; ')}`,
      ).toBe(true)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// extractServerPricing — parity tests with scripts/lib/template-pricing.ts
// ──────────────────────────────────────────────────────────────────────────

describe('extractServerPricing (.mjs port)', () => {
  it('matches the canonical multi-method shape (parity with TS port)', () => {
    const src = `pricing: {
  defaultCostCents: 2,
  methods: {
    search_movies: { costCents: 2, displayName: 'Search Movies' },
    get_movie: { costCents: 2, displayName: 'Get Movie' },
  },
}`
    const p = extractServerPricing(src)
    expect(p.defaultCostCents).toBe(2)
    expect(p.methods).toEqual({
      search_movies: { costCents: 2, displayName: 'Search Movies' },
      get_movie: { costCents: 2, displayName: 'Get Movie' },
    })
  })

  it('preserves method source order', () => {
    const src = `pricing: {
  defaultCostCents: 1,
  methods: {
    zebra: { costCents: 1 },
    alpha: { costCents: 1 },
    mike: { costCents: 1 },
  },
}`
    expect(Object.keys(extractServerPricing(src).methods ?? {})).toEqual([
      'zebra',
      'alpha',
      'mike',
    ])
  })

  it('handles per-method cost variation', () => {
    const src = `pricing: {
  defaultCostCents: 3,
  methods: {
    take_screenshot: { costCents: 5, displayName: "Take Screenshot" },
    get_page_content: { costCents: 3, displayName: "Get Page Content" },
  },
}`
    const p = extractServerPricing(src)
    expect(p.methods?.take_screenshot.costCents).toBe(5)
    expect(p.methods?.get_page_content.displayName).toBe('Get Page Content')
  })

  it('captures the optional unitType field', () => {
    const src = `pricing: {
  defaultCostCents: 1,
  methods: { stream: { costCents: 1, displayName: 'Stream', unitType: 'second' } },
}`
    expect(extractServerPricing(src).methods?.stream.unitType).toBe('second')
  })

  it('returns just defaultCostCents when no methods block', () => {
    expect(extractServerPricing('pricing: { defaultCostCents: 4 }')).toEqual({
      defaultCostCents: 4,
    })
  })

  it('falls back to defaultCostCents 1 when no pricing block', () => {
    expect(extractServerPricing('const x = 1')).toEqual({ defaultCostCents: 1 })
  })

  it('is not confused by a brace inside a displayName string', () => {
    const src = `pricing: {
  defaultCostCents: 1,
  methods: { weird: { costCents: 2, displayName: 'Has a } brace' } },
}`
    const p = extractServerPricing(src)
    expect(p.methods?.weird).toEqual({
      costCents: 2,
      displayName: 'Has a } brace',
    })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// End-to-end acceptance gates (from the handoff Task 4)
// ──────────────────────────────────────────────────────────────────────────

describe('end-to-end acceptance', () => {
  it('build:registry --strict accepts a freshly-generated manifest with zero backfill', async () => {
    const files = generateFromSpec({ ...BASE_SPEC, category: 'rag' })
    const tmpRoot = await mkdtemp(join(tmpdir(), 'sg-gen-e2e-roots-'))
    const tmpOut = await mkdtemp(join(tmpdir(), 'sg-gen-e2e-out-'))
    try {
      const templateDir = join(tmpRoot, 'settlegrid-cat-facts')
      await mkdir(templateDir, { recursive: true })
      await writeFile(
        join(templateDir, 'template.json'),
        files['template.json'],
        'utf-8',
      )
      const result = await buildRegistry({
        templateRoots: [tmpRoot],
        outputDir: tmpOut,
        strict: true,
      })
      expect(result.skipped).toEqual([])
      expect(result.registry.totalTemplates).toBe(1)
      expect(result.registry.templates[0].slug).toBe('cat-facts')
      // The decisive bit: a Templater-generated manifest is gallery-ready
      // without a backfill pass (which is what this task closes the loop
      // on; pre-fix, this assertion would fail because template.json
      // wasn't emitted at all).
    } finally {
      await rm(tmpRoot, { recursive: true, force: true })
      await rm(tmpOut, { recursive: true, force: true })
    }
  })

  it('sync-template-pricing is a no-op on a freshly-generated manifest', () => {
    // Mirrors sync-template-pricing.ts#syncAll's diff check exactly:
    //   updatedRaw = JSON.stringify(applyPricingToManifest(manifest,
    //                                                      extractServerPricing(serverTs)),
    //                               null, 2) + '\n'
    //   if (updatedRaw !== manifestRaw) → manifest was stale, needs update.
    // If our emission already matches what sync would write, the
    // historical backfill stopgap (`sync-template-pricing.ts`) has
    // nothing to do for new templates. This is the acceptance criterion
    // called out in the handoff's Task 4.
    const files = generateFromSpec({ ...BASE_SPEC, category: 'rag' })
    const manifestRaw = files['template.json']
    const manifest = JSON.parse(manifestRaw) as Record<string, unknown>
    const serverPricing = extractServerPricingTs(files['src/server.ts'])
    const updated = applyPricingToManifest(manifest, serverPricing)
    const updatedRaw = JSON.stringify(updated, null, 2) + '\n'
    expect(updatedRaw).toBe(manifestRaw)
  })

  it('sync-template-pricing is a no-op across every known Templater category', () => {
    // Sweep the full mapping table — a per-category quirk (e.g. a slug
    // that triggers an ordering / key-emission asymmetry) would surface
    // here and not in the single-fixture case.
    for (const slug of Object.keys(TEMPLATER_TO_GALLERY_CATEGORY)) {
      const files = generateFromSpec({ ...BASE_SPEC, category: slug })
      const manifestRaw = files['template.json']
      const manifest = JSON.parse(manifestRaw) as Record<string, unknown>
      const serverPricing = extractServerPricingTs(files['src/server.ts'])
      const updated = applyPricingToManifest(manifest, serverPricing)
      const updatedRaw = JSON.stringify(updated, null, 2) + '\n'
      expect(updatedRaw, `sync would update slug "${slug}"`).toBe(manifestRaw)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────
// gen() — disk-writing twin
// ──────────────────────────────────────────────────────────────────────────

describe('gen (disk-writing entry)', () => {
  let originalBase: string | undefined
  let tmpRoot: string

  beforeAll(async () => {
    // gen() hardcodes BASE = /Users/lex/settlegrid/open-source-servers.
    // We don't want the test to write into the real gallery, so we
    // override via a sibling slug pattern: pass a `slug` containing a
    // unique prefix that won't collide, then sweep on cleanup. This
    // mirrors how the real batch3 scripts have always been run.
    originalBase = undefined
    tmpRoot = await mkdtemp(join(tmpdir(), 'sg-gen-test-'))
  })

  afterAll(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
  })

  it('writes a 10th file (template.json) alongside the legacy 9', async () => {
    // Use a unique slug so the cleanup is targeted.
    const slug = `gen-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ossRoot = '/Users/lex/settlegrid/open-source-servers'
    const targetDir = join(ossRoot, `settlegrid-${slug}`)
    try {
      gen({ ...BASE_SPEC, slug, category: 'rag' })
      const manifestRaw = await readFile(
        join(targetDir, 'template.json'),
        'utf-8',
      )
      const manifest = JSON.parse(manifestRaw) as unknown
      const result = safeValidateTemplateManifest(manifest)
      expect(result.success).toBe(true)
    } finally {
      await rm(targetDir, { recursive: true, force: true })
    }
  })
})
