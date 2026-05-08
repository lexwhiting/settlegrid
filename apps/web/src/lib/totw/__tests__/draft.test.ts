/**
 * P5.4 — draft.ts unit tests.
 *
 * Spec checks:
 *   - slug regex prevents path-traversal / invalid file names
 *   - paths are deterministic across timezones (UTC formatting)
 *   - word count uses the same algorithm as wordCountFromMarkdown in
 *     blog-posts.ts so JSON-LD wordCount stays consistent
 *   - validator catches: empty, under-band, over-band, no code block
 *   - prompt builder emits voice rules + selection signal
 */
import { describe, it, expect } from 'vitest'
import {
  TARGET_WORDS_MAX,
  TARGET_WORDS_MIN,
  assertSafeSlug,
  buildDraftPrompt,
  countWords,
  formatDateUtc,
  makeDraftPaths,
  validateDraft,
} from '../draft'

describe('assertSafeSlug', () => {
  it('accepts kebab-case slugs', () => {
    expect(() => assertSafeSlug('stripe')).not.toThrow()
    expect(() => assertSafeSlug('open-ai')).not.toThrow()
    expect(() => assertSafeSlug('a1-b2-c3')).not.toThrow()
  })

  it('rejects empty / single char', () => {
    expect(() => assertSafeSlug('')).toThrow()
    expect(() => assertSafeSlug('a')).toThrow()
  })

  it('rejects path-traversal attempts', () => {
    expect(() => assertSafeSlug('../etc/passwd')).toThrow()
    expect(() => assertSafeSlug('foo/bar')).toThrow()
    expect(() => assertSafeSlug('foo\\bar')).toThrow()
  })

  it('rejects uppercase, spaces, special chars', () => {
    expect(() => assertSafeSlug('Stripe')).toThrow()
    expect(() => assertSafeSlug('open ai')).toThrow()
    expect(() => assertSafeSlug('foo_bar')).toThrow()
    expect(() => assertSafeSlug('foo.bar')).toThrow()
  })

  it('rejects leading or trailing hyphens', () => {
    expect(() => assertSafeSlug('-foo')).toThrow()
    expect(() => assertSafeSlug('foo-')).toThrow()
  })
})

describe('formatDateUtc', () => {
  it('formats as YYYY-MM-DD in UTC regardless of local time', () => {
    // Pacific is UTC-7 in summer; midnight UTC = 5pm local prior day.
    // Our helper must give the UTC date, not the local one.
    const d = new Date('2026-05-12T03:14:15Z')
    expect(formatDateUtc(d)).toBe('2026-05-12')
  })

  it('zero-pads month and day', () => {
    const d = new Date('2026-01-05T00:00:00Z')
    expect(formatDateUtc(d)).toBe('2026-01-05')
  })
})

describe('makeDraftPaths', () => {
  it('produces predictable paths from slug + date', () => {
    const p = makeDraftPaths('stripe', '2026-05-12')
    expect(p.bodyFilename).toBe('2026-05-12-stripe.md')
    expect(p.bodyPath).toBe('apps/web/src/lib/blog-bodies/totw/2026-05-12-stripe.md')
    expect(p.postSlug).toBe('totw-2026-05-12-stripe')
  })

  it('sanitizes the import binding for kebab-case slugs', () => {
    // import bindings must be valid JS identifiers (no dashes, no
    // leading digits, all caps for our convention)
    const p = makeDraftPaths('open-ai', '2026-05-12')
    expect(p.importBinding).toBe('TOTW_2026_05_12_OPEN_AI_BODY')
    expect(/^[A-Z][A-Z0-9_]*$/.test(p.importBinding)).toBe(true)
  })

  it('rejects unsafe slug', () => {
    expect(() => makeDraftPaths('../etc', '2026-05-12')).toThrow()
  })

  it('rejects malformed date', () => {
    expect(() => makeDraftPaths('stripe', '5/12/2026')).toThrow()
    expect(() => makeDraftPaths('stripe', '2026-5-12')).toThrow()
    expect(() => makeDraftPaths('stripe', '')).toThrow()
  })
})

describe('countWords', () => {
  it('counts plain prose', () => {
    expect(countWords('one two three four')).toBe(4)
  })

  it('strips fenced code blocks before counting', () => {
    const md = [
      'Three words here.',
      '```ts',
      'const x = thisShouldNotCount + neither.shouldThisOne()',
      '```',
      'Four more words after.',
    ].join('\n')
    expect(countWords(md)).toBe(7)
  })

  it('strips inline code', () => {
    expect(countWords('use `npm install foo` to do it')).toBe(4)
  })

  it('strips heading markers but counts the heading text', () => {
    expect(countWords('# Title\n\nbody words here')).toBe(4)
  })

  it('extracts link text but drops the URL', () => {
    expect(countWords('see [the docs](https://example.com) for more')).toBe(5)
  })

  it('strips emphasis markers', () => {
    // Strips *, _, ~ markers; the remaining tokens are: this, is, bold, and, italic, together → 6
    expect(countWords('this *is* bold _and_ italic ~together~')).toBe(6)
  })

  it('returns 0 for empty / whitespace', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('  \n  \n')).toBe(0)
  })
})

describe('validateDraft', () => {
  function makeBody(words: number, withCodeFence = true): string {
    const prose = Array.from({ length: words }, (_, i) => `word${i}`).join(' ')
    if (withCodeFence) {
      return `# Title\n\n${prose}\n\n\`\`\`ts\nconst x = 1\n\`\`\`\n`
    }
    return `# Title\n\n${prose}\n`
  }

  it('rejects empty', () => {
    const r = validateDraft('   \n   ')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('empty draft')
  })

  it('rejects below floor', () => {
    const body = makeBody(TARGET_WORDS_MIN - 50)
    const r = validateDraft(body)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('below floor')
  })

  it('rejects above ceiling', () => {
    const body = makeBody(TARGET_WORDS_MAX + 50)
    const r = validateDraft(body)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('above ceiling')
  })

  it('rejects missing code fence', () => {
    const body = makeBody(TARGET_WORDS_MIN + 30, false)
    const r = validateDraft(body)
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('code block')
  })

  it('accepts a draft in the band with a code fence', () => {
    const body = makeBody(TARGET_WORDS_MIN + 30)
    const r = validateDraft(body)
    expect(r.ok).toBe(true)
    expect(r.wordCount).toBeGreaterThanOrEqual(TARGET_WORDS_MIN)
    expect(r.wordCount).toBeLessThanOrEqual(TARGET_WORDS_MAX)
  })
})

describe('buildDraftPrompt', () => {
  const base = {
    templateName: 'Stripe',
    templateSlug: 'stripe',
    templateDescription: 'Payment processing.',
    templateCategory: 'finance',
    scaffoldCount: 12,
    viewCount: 45,
    daysSinceAdded: 7,
  }

  it('contains the load-bearing voice rules', () => {
    const { system } = buildDraftPrompt(base)
    expect(system).toMatch(/First person/)
    expect(system).toMatch(/No marketing speak/i)
    expect(system).toMatch(/No em-dashes/)
    expect(system).toMatch(/Show the actual code/)
  })

  it('embeds the canonical CTA URL with the correct slug', () => {
    const { system } = buildDraftPrompt(base)
    expect(system).toContain('https://settlegrid.ai/templates/stripe')
  })

  it('reports the selection signal so the model knows the angle', () => {
    const { user } = buildDraftPrompt(base)
    expect(user).toContain('scaffold_success events: 12')
    expect(user).toContain('template_detail_viewed events: 45')
    expect(user).toContain('7 days')
  })

  it('handles unknown freshness gracefully', () => {
    const { user } = buildDraftPrompt({ ...base, daysSinceAdded: null })
    expect(user).toContain('unknown')
  })

  it('does not leak the API key (no env reads here, but defensive)', () => {
    const { system, user } = buildDraftPrompt(base)
    // Shouldn't echo any env-shaped strings into the prompt.
    expect(system).not.toMatch(/sk-ant-|phx_|API_KEY/i)
    expect(user).not.toMatch(/sk-ant-|phx_|API_KEY/i)
  })
})
