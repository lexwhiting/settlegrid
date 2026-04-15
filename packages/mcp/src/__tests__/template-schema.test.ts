import { describe, it, expect } from 'vitest'
import {
  safeValidateTemplateManifest,
  templateManifestSchema,
  validateTemplateManifest,
} from '../template-schema'
import type { TemplateManifest } from '../template-schema'

// ─── Fixtures ───────────────────────────────────────────────────────────────

const validMinimal: TemplateManifest = {
  slug: 'mcp-search',
  name: 'MCP Search Tool',
  description: 'Minimal search template for MCP servers.',
  version: '1.0.0',
  category: 'ai',
  tags: ['search', 'mcp'],
  author: { name: 'Alice Example' },
  repo: {
    type: 'git',
    url: 'https://github.com/example/mcp-search',
  },
  runtime: 'node',
  languages: ['ts'],
  entry: 'src/index.ts',
  pricing: { model: 'free', currency: 'USD' },
  quality: { tests: true },
  capabilities: ['web-search'],
  featured: false,
}

const validFull: TemplateManifest = {
  $schema:
    'https://settlegrid.ai/schemas/template.schema.json',
  slug: 'ai-code-reviewer',
  name: 'AI Code Reviewer',
  description:
    'Reviews pull requests with an LLM and posts inline comments.',
  version: '2.3.1',
  category: 'devtools',
  tags: ['review', 'pr', 'llm', 'github'],
  author: {
    name: 'Bob Maintainer',
    url: 'https://bob.example',
    github: 'bobmaint',
  },
  repo: {
    type: 'git',
    url: 'https://github.com/bobmaint/ai-code-reviewer',
    directory: 'packages/server',
  },
  runtime: 'node',
  languages: ['ts', 'js'],
  entry: 'src/server.ts',
  pricing: {
    model: 'per-call',
    perCallUsdCents: 5,
    currency: 'USD',
  },
  quality: {
    tests: true,
    ciPassing: true,
    lastVerifiedAt: '2026-04-15T12:00:00.000Z',
  },
  capabilities: ['pr-review', 'comment-bot', 'llm-inference'],
  screenshots: [
    {
      url: 'https://example.com/shot.png',
      alt: 'Inline PR comment',
    },
  ],
  loomUrl: 'https://loom.com/share/abc',
  deployButton: {
    provider: 'vercel',
    url: 'https://vercel.com/new',
  },
  featured: true,
  trendingRank: 3,
}

// ─── Happy paths ────────────────────────────────────────────────────────────

describe('templateManifestSchema — happy paths', () => {
  it('parses a fully-populated manifest', () => {
    const result = validateTemplateManifest(validFull)
    expect(result.slug).toBe('ai-code-reviewer')
    expect(result.pricing.model).toBe('per-call')
    expect(result.pricing.perCallUsdCents).toBe(5)
    expect(result.featured).toBe(true)
  })

  it('parses a minimal manifest and applies defaults', () => {
    const result = validateTemplateManifest(validMinimal)
    // `featured` defaults to false, `currency` defaults to 'USD'
    expect(result.featured).toBe(false)
    expect(result.pricing.currency).toBe('USD')
  })

  it('round-trips: parse → stringify → parse produces an equivalent manifest', () => {
    const parsed = validateTemplateManifest(validFull)
    const serialized = JSON.stringify(parsed)
    const reparsed = validateTemplateManifest(JSON.parse(serialized))
    expect(reparsed).toEqual(parsed)
  })
})

// ─── Required field coverage ────────────────────────────────────────────────

describe('templateManifestSchema — required field coverage', () => {
  const required: Array<keyof TemplateManifest> = [
    'slug',
    'name',
    'description',
    'version',
    'category',
    'tags',
    'author',
    'repo',
    'runtime',
    'languages',
    'entry',
    'pricing',
    'quality',
    'capabilities',
  ]

  for (const field of required) {
    it(`rejects a manifest missing the required \`${field}\` field`, () => {
      const broken = { ...validMinimal }
      delete (broken as Record<string, unknown>)[field]
      expect(() => validateTemplateManifest(broken)).toThrow()
    })
  }
})

// ─── Individual constraint violations ──────────────────────────────────────

describe('templateManifestSchema — field constraint violations', () => {
  it('rejects an invalid slug (uppercase / spaces / special chars)', () => {
    for (const badSlug of ['Has-Uppercase', 'has spaces', 'has_underscore', 'has!']) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        slug: badSlug,
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.some((e) => e.startsWith('slug:'))).toBe(true)
      }
    }
  })

  it('rejects a non-semver version', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      version: '1.0',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown category enum value', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      category: 'not-a-category',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown runtime enum value', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      runtime: 'php',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown language enum value in languages[]', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      languages: ['ts', 'rust'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 tags', () => {
    const elevenTags = Array.from({ length: 11 }, (_, i) => `tag-${i}`)
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      tags: elevenTags,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a tag longer than 30 characters', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      tags: ['x'.repeat(31)],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a name longer than 80 characters', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      name: 'x'.repeat(81),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a description longer than 400 characters', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      description: 'x'.repeat(401),
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 30 capabilities', () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => `cap-${i}`)
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      capabilities: tooMany,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty languages array', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      languages: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-URL author.url', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      author: { name: 'x', url: 'not a url' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-URL repo.url', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      repo: { type: 'git', url: 'definitely/not/a/url' },
    })
    expect(result.success).toBe(false)
  })
})

// ─── Pricing refinement (per-call requires an amount) ──────────────────────

describe('templateManifestSchema — pricing refinement', () => {
  it('rejects pricing.model=per-call without perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: { model: 'per-call', currency: 'USD' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.errors.some((e) =>
          e.includes('perCallUsdCents is required'),
        ),
      ).toBe(true)
    }
  })

  it('accepts pricing.model=per-call WITH perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: { model: 'per-call', perCallUsdCents: 5, currency: 'USD' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts pricing.model=free without perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: { model: 'free', currency: 'USD' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts pricing.model=subscription without perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: { model: 'subscription', currency: 'USD' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a negative perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: { model: 'per-call', perCallUsdCents: -1, currency: 'USD' },
    })
    expect(result.success).toBe(false)
  })
})

// ─── safeValidateTemplateManifest contract ─────────────────────────────────

describe('safeValidateTemplateManifest — discriminated return', () => {
  it('returns { success: true, data } on a valid manifest', () => {
    const result = safeValidateTemplateManifest(validMinimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.slug).toBe(validMinimal.slug)
    }
  })

  it('returns { success: false, errors[] } with dot-path prefixes on invalid input', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      slug: 'BAD',
      author: { name: '' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      // At least one error names the slug field, at least one names author.
      expect(result.errors.some((e) => e.startsWith('slug:'))).toBe(true)
      expect(result.errors.some((e) => e.startsWith('author.name:'))).toBe(true)
    }
  })

  it('never throws even for completely malformed input', () => {
    expect(() =>
      safeValidateTemplateManifest('this is not an object'),
    ).not.toThrow()
    expect(() => safeValidateTemplateManifest(null)).not.toThrow()
    expect(() => safeValidateTemplateManifest(42)).not.toThrow()
  })
})

// ─── Schema surface check ──────────────────────────────────────────────────

describe('templateManifestSchema — surface', () => {
  it('is exported as a Zod object schema and has a .parse method', () => {
    expect(typeof templateManifestSchema.parse).toBe('function')
    expect(typeof templateManifestSchema.safeParse).toBe('function')
  })
})
