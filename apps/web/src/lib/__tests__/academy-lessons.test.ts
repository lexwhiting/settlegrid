import { describe, it, expect } from 'vitest'
import {
  ACADEMY_LESSONS,
  ACADEMY_SLUGS,
  getAcademyLessonBySlug,
} from '../academy-lessons'
import {
  BLOG_POSTS,
  BLOG_SLUGS,
  extractTocFromMarkdown,
  getBlogPostBySlug,
  isBodyPost,
  slugifyHeading,
  wordCountFromMarkdown,
  type BlogPost,
} from '../blog-posts'

describe('ACADEMY_LESSONS registry', () => {
  it('has at least 5 lessons (Phase 3 full Academy launch)', () => {
    // P3.8 shipped lesson 1; P3.9 shipped lessons 2-5. The registry
    // floor is now 5 — if a lesson gets silently removed this test
    // surfaces the regression.
    expect(ACADEMY_LESSONS.length).toBeGreaterThanOrEqual(5)
  })

  it('every lesson has a unique slug', () => {
    const slugs = ACADEMY_LESSONS.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every slug matches the URL-safe shape /^[a-z0-9-]+$/', () => {
    for (const l of ACADEMY_LESSONS) {
      expect(l.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('ACADEMY_SLUGS mirrors the lesson list', () => {
    expect(ACADEMY_SLUGS).toEqual(ACADEMY_LESSONS.map((l) => l.slug))
  })

  it('every relatedSlug refers to a real lesson (no dangling references)', () => {
    const validSlugs = new Set(ACADEMY_SLUGS)
    for (const l of ACADEMY_LESSONS) {
      for (const related of l.relatedSlugs) {
        expect(
          validSlugs.has(related),
          `lesson ${l.slug} references unknown related ${related}`,
        ).toBe(true)
      }
    }
  })

  it('no lesson lists itself as a related slug', () => {
    for (const l of ACADEMY_LESSONS) {
      expect(l.relatedSlugs).not.toContain(l.slug)
    }
  })
})

describe('getAcademyLessonBySlug', () => {
  it('returns the lesson for a known slug', () => {
    const l = getAcademyLessonBySlug('pricing-your-mcp-server')
    expect(l).toBeDefined()
    expect(l?.title).toMatch(/Price Your MCP Server/i)
  })

  it('returns undefined for an unknown slug', () => {
    expect(getAcademyLessonBySlug('does-not-exist')).toBeUndefined()
  })
})

// ─── Universal per-lesson checks ────────────────────────────────────
//
// These assertions run against every lesson in the registry. If a
// future lesson is added and any of these checks fails, the registry
// test surfaces it before the build ships broken content.

describe.each(ACADEMY_LESSONS.map((l) => [l.slug, l] as const))(
  'lesson: %s',
  (_slug, lesson) => {
    it('has all required metadata fields populated', () => {
      expect(lesson.title).toBeTruthy()
      expect(lesson.summary).toBeTruthy()
      expect(lesson.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(lesson.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(lesson.readingTime).toBeTruthy()
      expect(lesson.author.name).toBeTruthy()
      expect(lesson.canonicalUrl).toMatch(
        /^https:\/\/settlegrid\.ai\/learn\/academy\//,
      )
      // Canonical URL must contain the slug (typo-resistance).
      expect(lesson.canonicalUrl).toContain(`/academy/${lesson.slug}`)
      expect(lesson.keywords.length).toBeGreaterThanOrEqual(3)
    })

    it('body is between 3000 and 5000 words (spec floor + ceiling)', () => {
      expect(lesson.body).toBeTruthy()
      expect(lesson.body.length).toBeGreaterThan(10_000)
      const wc = wordCountFromMarkdown(lesson.body)
      expect(wc).toBeGreaterThanOrEqual(3000)
      expect(wc).toBeLessThanOrEqual(5000)
    })

    it('body uses proper H2 structure (at least 6 top-level sections)', () => {
      const h2Count = (lesson.body.match(/^##\s+/gm) ?? []).length
      expect(h2Count).toBeGreaterThanOrEqual(6)
    })

    it('body has H3 subheadings for nested structure (spec: h1-h3)', () => {
      const h3Count = (lesson.body.match(/^###\s+/gm) ?? []).length
      expect(h3Count).toBeGreaterThanOrEqual(8)
    })

    it('contains at least 3 internal links (blog, academy, or shadow)', () => {
      // Match any /learn/blog/*, /learn/academy/*, or /mcp* link.
      const internalLinks = [
        ...lesson.body.matchAll(/\]\((\/(?:learn\/(?:blog|academy)|mcp)[^)]*)\)/g),
      ]
      expect(internalLinks.length).toBeGreaterThanOrEqual(3)
    })

    it('contains at least 2 blog-post links (P3.9 spec: link to ≥2 blog posts)', () => {
      // The P3.9 spec step 5 explicitly requires "lessons link to
      // each other AND to ≥2 blog posts" — not just any internal
      // links. Enforcing this separately catches the case where a
      // lesson satisfies the generic ≥3 internal-links test via
      // academy cross-links alone, which is cheaper than properly
      // tying into the broader /learn/blog corpus.
      const blogLinks = [
        ...lesson.body.matchAll(/\]\(\/learn\/blog\/[^)]+\)/g),
      ]
      expect(blogLinks.length).toBeGreaterThanOrEqual(2)
    })

    it('does not stuff its primary keyword into every paragraph', () => {
      // Use each lesson's first keyword as its primary phrase. If more
      // than 50% of paragraphs contain the literal phrase, treat as
      // stuffing.
      const primary = lesson.keywords[0].toLowerCase()
      const paragraphs = lesson.body
        .split(/\n\n/)
        .filter((p) => p.trim().length > 0)
      const hits = paragraphs.filter((p) =>
        p.toLowerCase().includes(primary),
      ).length
      expect(hits / paragraphs.length).toBeLessThan(0.5)
    })

    it('declared wordCount (if any) is within 5% of the computed count', () => {
      if (lesson.wordCount === undefined) return
      const computed = wordCountFromMarkdown(lesson.body)
      const driftPct = Math.abs(lesson.wordCount - computed) / computed
      expect(driftPct).toBeLessThan(0.05)
    })
  },
)

// ─── Lesson-specific SEO keyword checks ────────────────────────────────
//
// Each lesson has spec-defined SEO target phrases that must appear
// verbatim in its keywords array. These assertions encode the specific
// targets per lesson so a rename of the keywords array doesn't
// silently drop an SEO target.

describe('lesson 1 — pricing-your-mcp-server SEO targets', () => {
  const lesson = getAcademyLessonBySlug('pricing-your-mcp-server')!
  const lower = lesson.keywords.map((k) => k.toLowerCase())

  it('includes the three P3.8 SEO target phrases', () => {
    expect(lower).toContain('how to price mcp server')
    expect(lower).toContain('mcp server pricing')
    expect(lower).toContain('ai tool pricing')
  })

  it('cites the three competitor pricing sources verbatim in the body', () => {
    // Anthropic + OpenAI + Stripe pricing URLs are the spec-cited
    // sources the body was built against. If any of these URLs
    // disappears from the body, the benchmark claim they support is
    // orphaned — the test forces a deliberate citation update when
    // the body changes.
    expect(lesson.body).toMatch(/\]\(https:\/\/claude\.com\/pricing\)/)
    expect(lesson.body).toMatch(/\]\(https:\/\/openai\.com\/api\/pricing\)/)
    expect(lesson.body).toMatch(/\]\(https:\/\/stripe\.com\/pricing\)/)
  })
})

describe('lesson 3 — stripe-vs-settlegrid-vs-x402 (sensitive content)', () => {
  const lesson = getAcademyLessonBySlug('stripe-vs-settlegrid-vs-x402')!

  it('cites Stripe MPP announcement', () => {
    expect(lesson.body).toMatch(
      /\]\(https:\/\/stripe\.com\/blog\/machine-payments-protocol\)/,
    )
  })

  it('cites Stripe Agentic Commerce Suite blog', () => {
    expect(lesson.body).toMatch(
      /\]\(https:\/\/stripe\.com\/blog\/agentic-commerce-suite\)/,
    )
  })

  it('cites the Stripe Agent Toolkit docs', () => {
    expect(lesson.body).toMatch(/\]\(https:\/\/docs\.stripe\.com\/agents\)/)
  })

  it('cites x402.org', () => {
    expect(lesson.body).toMatch(/\]\(https:\/\/www\.x402\.org\)/)
  })

  it('cites the x402 GitHub repo', () => {
    expect(lesson.body).toMatch(
      /\]\(https:\/\/github\.com\/coinbase\/x402\)/,
    )
  })

  it('cites the Linux Foundation x402 Foundation press release', () => {
    expect(lesson.body).toMatch(
      /\]\(https:\/\/www\.linuxfoundation\.org\/press\/linux-foundation-is-launching-the-x402-foundation/,
    )
  })

  it('has more external citations than lesson 1 (sensitive content bar)', () => {
    // Lesson 3 makes claims about live competitor products. The bar
    // is "every competitor claim is cited from their public docs."
    // An easy check is that the competitive-comparison lesson has
    // more external URLs than the pricing fundamentals lesson.
    const lesson1 = getAcademyLessonBySlug('pricing-your-mcp-server')!
    const countExternal = (body: string) =>
      [...body.matchAll(/\]\(https:\/\/[^)]+\)/g)].length
    const externalLesson3 = countExternal(lesson.body)
    const externalLesson1 = countExternal(lesson1.body)
    expect(externalLesson3).toBeGreaterThanOrEqual(externalLesson1)
    // Absolute floor — a sensitive-content lesson must have at least
    // 10 external citations regardless of what lesson 1 carries.
    expect(externalLesson3).toBeGreaterThanOrEqual(10)
  })
})

// ─── Page-side hostile regression ─────────────────────────────────────
//
// The lesson page embeds JSON-LD via dangerouslySetInnerHTML. If any
// lesson's title or summary ever contains a literal `</script>`
// sequence, naive JSON.stringify would break out of the script tag
// and render the rest of the payload as HTML (XSS in static
// generation). The safeJsonLd helper escapes `<` as `\u003c` to
// prevent this. This test mirrors that escape behavior at the
// registry level so a lesson authored with a hostile title still
// round-trips safely.

// ─── Blog-posts helper coverage ───────────────────────────────────────
//
// The academy page.tsx imports extractTocFromMarkdown and isBodyPost
// from blog-posts.ts. Those helpers have no direct tests in the repo
// — this block adds them in the academy test file because academy
// behavior depends on them (TOC rendering, body-vs-sections branch).
// If either helper regresses, the academy page breaks silently; these
// tests surface the break before it ships.

describe('extractTocFromMarkdown (academy TOC dependency)', () => {
  it('returns an empty array for an empty body', () => {
    expect(extractTocFromMarkdown('')).toEqual([])
  })

  it('returns an empty array for a body with no H2 headings', () => {
    const body = 'Just prose.\n\nAnother paragraph.\n\n### An H3 only\n'
    expect(extractTocFromMarkdown(body)).toEqual([])
  })

  it('extracts every H2 heading with a slug id', () => {
    const body = [
      '## First Section',
      '',
      'body text',
      '',
      '## Second Section',
      '',
      'more text',
      '',
      '## Third Section',
    ].join('\n')
    expect(extractTocFromMarkdown(body)).toEqual([
      { id: 'first-section', heading: 'First Section' },
      { id: 'second-section', heading: 'Second Section' },
      { id: 'third-section', heading: 'Third Section' },
    ])
  })

  it('skips H2-looking lines inside fenced code blocks', () => {
    const body = [
      '## Real Section',
      '',
      '```python',
      '## comment in Python code',
      'print("hello")',
      '```',
      '',
      '## Another Real Section',
    ].join('\n')
    // The fenced `## comment` must not appear in the TOC.
    expect(extractTocFromMarkdown(body)).toEqual([
      { id: 'real-section', heading: 'Real Section' },
      { id: 'another-real-section', heading: 'Another Real Section' },
    ])
  })

  it('strips inline emphasis markers (*, _, `) from headings', () => {
    const body = '## **Bold** and `code` and _italic_'
    const toc = extractTocFromMarkdown(body)
    expect(toc).toHaveLength(1)
    // Emphasis markers stripped from display heading.
    expect(toc[0].heading).toBe('Bold and code and italic')
    // Slug matches rehype-slug output: lowercased + hyphenated.
    expect(toc[0].id).toBe('bold-and-code-and-italic')
  })

  it('does not match H3+ headings (ensures H2-only TOC)', () => {
    const body = [
      '## Real H2',
      '### Not an H2',
      '#### Also not',
      '##### Still not',
    ].join('\n')
    expect(extractTocFromMarkdown(body)).toEqual([
      { id: 'real-h2', heading: 'Real H2' },
    ])
  })

  it('handles multiple code fences correctly (toggle state)', () => {
    const body = [
      '## First',
      '```',
      '## fake-a',
      '```',
      '## Second',
      '```',
      '## fake-b',
      '```',
      '## Third',
    ].join('\n')
    // Three real H2s; the two code-fenced ones must be ignored.
    expect(extractTocFromMarkdown(body)).toEqual([
      { id: 'first', heading: 'First' },
      { id: 'second', heading: 'Second' },
      { id: 'third', heading: 'Third' },
    ])
  })
})

describe('slugifyHeading (transitively covered, but worth a direct check)', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyHeading('Hello World')).toBe('hello-world')
  })

  it('strips non-word non-space non-hyphen characters', () => {
    expect(slugifyHeading('What?! Really — OK.')).toBe('what-really-ok')
  })

  it('collapses runs of whitespace to a single hyphen', () => {
    expect(slugifyHeading('many    spaces   here')).toBe('many-spaces-here')
  })

  it('collapses runs of hyphens to a single hyphen', () => {
    expect(slugifyHeading('already---hyphenated')).toBe('already-hyphenated')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugifyHeading('-leading')).toBe('leading')
    expect(slugifyHeading('trailing-')).toBe('trailing')
    expect(slugifyHeading('--both--')).toBe('both')
  })

  it('is idempotent on already-slugified input', () => {
    expect(slugifyHeading('already-a-slug')).toBe('already-a-slug')
  })
})

describe('isBodyPost (academy body/sections branch dependency)', () => {
  // Minimal BlogPost fixture — only the fields isBodyPost reads.
  function fakePost(overrides: Partial<BlogPost> = {}): BlogPost {
    return {
      slug: 'sample',
      title: 'Sample',
      description: 'desc',
      datePublished: '2026-04-20',
      dateModified: '2026-04-20',
      keywords: [],
      readingTime: '1 min',
      wordCount: 1,
      author: { name: 'Test', bio: 'bio' },
      relatedSlugs: [],
      ...overrides,
    }
  }

  it('returns true when body is a non-empty string', () => {
    expect(isBodyPost(fakePost({ body: 'some markdown' }))).toBe(true)
  })

  it('returns false when body is undefined', () => {
    expect(isBodyPost(fakePost())).toBe(false)
  })

  it('returns false when body is an empty string', () => {
    expect(isBodyPost(fakePost({ body: '' }))).toBe(false)
  })

  it('narrows the TypeScript type when the guard returns true', () => {
    const post = fakePost({ body: 'text' })
    if (isBodyPost(post)) {
      // Inside this branch, post.body is `string`, not `string | undefined`.
      // If the type narrowing broke, this next line would be a tsc error.
      expect(post.body.length).toBeGreaterThan(0)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect.fail('isBodyPost should have returned true')
    }
  })
})

describe('getBlogPostBySlug (full blog-posts coverage)', () => {
  it('returns the post for a known slug', () => {
    // Pick any real slug from the committed registry rather than
    // hard-coding one (which would drift if posts get renamed).
    const sampleSlug = BLOG_SLUGS[0]
    const post = getBlogPostBySlug(sampleSlug)
    expect(post).toBeDefined()
    expect(post?.slug).toBe(sampleSlug)
  })

  it('returns undefined for an unknown slug', () => {
    expect(getBlogPostBySlug('no-such-post-anywhere')).toBeUndefined()
  })

  it('BLOG_SLUGS mirrors the BLOG_POSTS array', () => {
    expect(BLOG_SLUGS).toEqual(BLOG_POSTS.map((p) => p.slug))
  })
})

describe('wordCountFromMarkdown edge cases', () => {
  it('returns 0 for an empty body', () => {
    expect(wordCountFromMarkdown('')).toBe(0)
  })

  it('strips fenced code so source code does not inflate the count', () => {
    const body = [
      'Real prose with five words.',
      '',
      '```js',
      'const x = Array.from({ length: 100 }, () => "code").join(" ");',
      'console.log(x);',
      '```',
    ].join('\n')
    // "Real prose with five words." is 5 words.
    expect(wordCountFromMarkdown(body)).toBe(5)
  })

  it('strips inline code segments (the code words do not count)', () => {
    // `const x = 1` is stripped to a space, leaving "use   here"
    // — two words. The stripping is by design: source code shouldn't
    // inflate a prose word count used for JSON-LD article schema.
    expect(wordCountFromMarkdown('use `const x = 1` here')).toBe(2)
  })

  it('strips link syntax while keeping the link text word count', () => {
    // Expected: "See the docs for more info" — 6 words. The URL
    // disappears, the link text stays.
    expect(
      wordCountFromMarkdown('See the [docs](https://example.com/docs) for more info'),
    ).toBe(6)
  })

  it('strips heading markers so the heading word still counts', () => {
    // "Heading" is one word; the `## ` prefix shouldn't inflate.
    expect(wordCountFromMarkdown('## Heading')).toBe(1)
  })

  it('strips emphasis markers without stripping the words themselves', () => {
    expect(wordCountFromMarkdown('*bold* _italic_ ~strike~')).toBe(3)
  })
})

describe('JSON-LD payload safety', () => {
  it('a lesson title containing </script> still produces safe JSON when escaped', () => {
    const hostileTitle = 'Pricing</script><script>alert(1)</script>'
    const payload = { headline: hostileTitle }
    const raw = JSON.stringify(payload)
    const safe = raw.replace(/</g, '\\u003c')
    // Raw stringification still carries the script tag verbatim.
    expect(raw).toContain('</script>')
    // Escaped payload no longer contains a literal `<` anywhere, so
    // the HTML parser cannot see `</script>` when the payload is
    // embedded inside a script tag.
    expect(safe).not.toContain('</script>')
    expect(safe).not.toContain('<')
    // The escaped payload is still valid JSON that round-trips to
    // the same object.
    expect(JSON.parse(safe)).toEqual(payload)
  })
})
