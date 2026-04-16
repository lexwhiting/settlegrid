import { describe, it, expect } from 'vitest'
import {
  safeValidateTemplateManifest,
  templateManifestSchema,
  validateTemplateManifest,
} from './template-schema'
import type { TemplateManifest } from './template-schema'

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
    // Two failures on purpose: (a) slug regex violation, (b) pricing refine
    // violation (per-call without perCallUsdCents). Verifies both the
    // top-level and the nested dot-path prefix.
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      slug: 'BAD',
      pricing: { model: 'per-call', currency: 'USD' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.startsWith('slug:'))).toBe(true)
      expect(
        result.errors.some((e) => e.startsWith('pricing.perCallUsdCents:')),
      ).toBe(true)
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

// ─── Hostile URL scheme rejection (XSS/SSRF hardening) ─────────────────────
//
// Every URL field in the manifest goes through the internal `httpUrl`
// validator, which rejects `javascript:`, `data:`, `file:`, and every
// other scheme besides `http:` / `https:`. These tests lock that in
// so a future refactor can't regress the XSS/SSRF surface.

describe('templateManifestSchema — XSS/SSRF scheme hardening', () => {
  const hostileSchemes = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://anon@example.com/',
    'vbscript:alert(1)',
  ]

  it('rejects every hostile scheme in repo.url', () => {
    for (const hostile of hostileSchemes) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        repo: { type: 'git', url: hostile },
      })
      expect(result.success, `expected ${hostile} to fail`).toBe(false)
    }
  })

  it('rejects every hostile scheme in author.url', () => {
    for (const hostile of hostileSchemes) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        author: { name: 'x', url: hostile },
      })
      expect(result.success, `expected ${hostile} to fail`).toBe(false)
    }
  })

  it('rejects every hostile scheme in screenshots[].url', () => {
    for (const hostile of hostileSchemes) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        screenshots: [{ url: hostile, alt: 'x' }],
      })
      expect(result.success, `expected ${hostile} to fail`).toBe(false)
    }
  })

  it('rejects every hostile scheme in loomUrl', () => {
    for (const hostile of hostileSchemes) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        loomUrl: hostile,
      })
      expect(result.success, `expected ${hostile} to fail`).toBe(false)
    }
  })

  it('rejects every hostile scheme in deployButton.url', () => {
    for (const hostile of hostileSchemes) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        deployButton: { provider: 'vercel', url: hostile },
      })
      expect(result.success, `expected ${hostile} to fail`).toBe(false)
    }
  })

  it('rejects every hostile scheme in $schema', () => {
    for (const hostile of hostileSchemes) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        $schema: hostile,
      })
      expect(result.success, `expected ${hostile} to fail`).toBe(false)
    }
  })

  it('accepts http:// and https:// URLs in every URL field', () => {
    const ok = safeValidateTemplateManifest({
      ...validMinimal,
      $schema: 'http://settlegrid.ai/schema.json',
      repo: { type: 'git', url: 'https://github.com/a/b' },
      author: { name: 'x', url: 'http://example.com' },
      screenshots: [{ url: 'https://cdn.example.com/shot.png', alt: 'x' }],
      loomUrl: 'https://loom.com/share/abc',
      deployButton: { provider: 'vercel', url: 'https://vercel.com/new' },
    })
    expect(ok.success).toBe(true)
  })

  it('error message names the scheme restriction', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      repo: { type: 'git', url: 'javascript:alert(1)' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.errors.some((e) =>
          e.includes('http or https scheme'),
        ),
      ).toBe(true)
    }
  })
})

// ─── Pricing hardening: Infinity, NaN, fractional cents ────────────────────
//
// `perCallUsdCents` was hardened with `.int().finite()` on top of the
// original `.nonnegative()`. Locks in that Infinity/NaN/0.5 all reject.

describe('templateManifestSchema — pricing hardening', () => {
  it('rejects Infinity perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: {
        model: 'per-call',
        perCallUsdCents: Number.POSITIVE_INFINITY,
        currency: 'USD',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects -Infinity perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: {
        model: 'per-call',
        perCallUsdCents: Number.NEGATIVE_INFINITY,
        currency: 'USD',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects NaN perCallUsdCents', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: {
        model: 'per-call',
        perCallUsdCents: Number.NaN,
        currency: 'USD',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects fractional cents (0.5)', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: {
        model: 'per-call',
        perCallUsdCents: 0.5,
        currency: 'USD',
      },
    })
    expect(result.success).toBe(false)
  })

  it('accepts integer zero per-call (even though semantically odd)', () => {
    // 0 passes .nonnegative() and .int(). Leave as schema-level accept;
    // higher-layer "should free tools use model: free" is a polish
    // concern, not a schema concern.
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      pricing: { model: 'per-call', perCallUsdCents: 0, currency: 'USD' },
    })
    expect(result.success).toBe(true)
  })
})

// ─── Bounds / cardinality tests ────────────────────────────────────────────
//
// Fills gaps in the original field-constraint suite: screenshots max(6),
// trendingRank zero/negative/fractional, $schema URL shape.

describe('templateManifestSchema — bounds and cardinality', () => {
  it('rejects more than 6 screenshots', () => {
    const sevenShots = Array.from({ length: 7 }, (_, i) => ({
      url: `https://cdn.example.com/shot-${i}.png`,
      alt: `screenshot ${i}`,
    }))
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      screenshots: sevenShots,
    })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 6 screenshots (boundary)', () => {
    const sixShots = Array.from({ length: 6 }, (_, i) => ({
      url: `https://cdn.example.com/shot-${i}.png`,
      alt: `screenshot ${i}`,
    }))
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      screenshots: sixShots,
    })
    expect(result.success).toBe(true)
  })

  it('rejects trendingRank of 0', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      trendingRank: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative trendingRank', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      trendingRank: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects fractional trendingRank', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      trendingRank: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts trendingRank of 1 (boundary)', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      trendingRank: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed $schema URL', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      $schema: 'not a url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown deployButton.provider', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      deployButton: {
        provider: 'heroku',
        url: 'https://heroku.com/deploy',
      },
    })
    expect(result.success).toBe(false)
  })
})

// ─── Zod default behavior lock-in ──────────────────────────────────────────
//
// Documents and locks in zod's default behaviors so a future refactor
// that e.g. adds `.strict()` would have to explicitly update a test.

describe('templateManifestSchema — zod default behaviors (lock-in)', () => {
  it('strips unknown top-level keys silently (default z.object behavior)', () => {
    const result = templateManifestSchema.safeParse({
      ...validMinimal,
      tagss: ['typo-field'], // typo of `tags`
      unknownField: { ignored: true },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>).tagss).toBeUndefined()
      expect(
        (result.data as Record<string, unknown>).unknownField,
      ).toBeUndefined()
    }
  })

  it('does not leak prototype pollution from __proto__ keys', () => {
    // Parsing a manifest that contains a __proto__ key must not pollute
    // Object.prototype. JSON.parse creates a __proto__ own property (not
    // the prototype chain) when using the literal source, but after zod
    // picks its known fields, the polluted key should vanish and no
    // global side effect should land.
    const polluted = JSON.parse(
      JSON.stringify({
        ...validMinimal,
      }).replace('{', '{"__proto__":{"polluted":true},'),
    )
    const result = templateManifestSchema.safeParse(polluted)
    expect(result.success).toBe(true)
    // Prototype chain is clean — no pollution leaked.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('permissive slug regex: leading/trailing/consecutive hyphens (documented)', () => {
    // These slugs pass the regex `/^[a-z0-9-]+$/`. The registry builder
    // (P2.7) and canonical polish script (P2.8) are responsible for
    // rejecting cosmetically-ugly slugs; the schema just gates basic
    // URL-safety. Locked in here so a future stricter regex would
    // require updating this test intentionally.
    for (const ugly of ['-foo', 'foo-', 'foo--bar', '---']) {
      const result = safeValidateTemplateManifest({
        ...validMinimal,
        slug: ugly,
      })
      expect(result.success, `slug ${ugly} should currently pass`).toBe(true)
    }
  })

  it('permissive version regex: leading zeros pass (documented)', () => {
    // `/^\d+\.\d+\.\d+$/` accepts `01.02.03`. Strict semver forbids
    // leading zeros — downstream semver comparators will catch it but
    // the schema does not. Locked in intentionally.
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      version: '01.02.03',
    })
    expect(result.success).toBe(true)
  })
})

// ─── Dot-path error prefixes on nested + array paths ───────────────────────

describe('safeValidateTemplateManifest — array-index dot-paths', () => {
  it('produces `screenshots.0.url:` style prefixes for nested array errors', () => {
    const result = safeValidateTemplateManifest({
      ...validMinimal,
      screenshots: [
        { url: 'javascript:alert(1)', alt: 'first shot' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.errors.some((e) => e.startsWith('screenshots.0.url:')),
      ).toBe(true)
    }
  })
})
