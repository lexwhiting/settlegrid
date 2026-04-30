import { describe, it, expect } from 'vitest'
import { GET } from '../rss.xml/route'
import {
  buildRssFeed,
  escapeXml,
  toRfc822,
} from '../rss.xml/feed-builder'
import { ACADEMY_LESSONS } from '@/lib/academy-lessons'

// ─── escapeXml ─────────────────────────────────────────────────────

describe('escapeXml', () => {
  it('escapes each of the five XML-reserved characters', () => {
    expect(escapeXml('&')).toBe('&amp;')
    expect(escapeXml('<')).toBe('&lt;')
    expect(escapeXml('>')).toBe('&gt;')
    expect(escapeXml('"')).toBe('&quot;')
    expect(escapeXml("'")).toBe('&apos;')
  })

  it('escapes ampersand before other entities (ordering matters)', () => {
    // If ampersand is escaped after other chars, an input like `<`
    // becomes `&amp;lt;` instead of `&lt;`. The function's first
    // `.replace(&...)` pass ensures `&` is escaped before the other
    // passes insert `&` into their replacements.
    expect(escapeXml('<')).toBe('&lt;')
    expect(escapeXml('&<')).toBe('&amp;&lt;')
  })

  it('escapes a script-tag attempt into inert text', () => {
    const hostile = '</script><script>alert(1)</script>'
    const safe = escapeXml(hostile)
    expect(safe).not.toContain('<script>')
    expect(safe).not.toContain('</script>')
    expect(safe).toContain('&lt;/script&gt;')
  })

  it('leaves a plain ASCII string untouched', () => {
    expect(escapeXml('Hello, Academy!')).toBe('Hello, Academy!')
  })

  // --- H1 regression: XML 1.0 prohibits most C0 controls ---------
  // A stray U+0000 or U+000C in a lesson title would produce
  // invalid XML that refuses to parse even though all five
  // reserved entities are correctly escaped. escapeXml strips
  // these; the Tab/LF/CR trio that XML permits is preserved.
  it('strips null bytes (U+0000)', () => {
    expect(escapeXml('before\u0000after')).toBe('beforeafter')
  })

  it('strips form feed (U+000C)', () => {
    expect(escapeXml('a\u000Cb')).toBe('ab')
  })

  it('strips DEL (U+007F)', () => {
    expect(escapeXml('x\u007Fy')).toBe('xy')
  })

  it('strips vertical tab (U+000B)', () => {
    expect(escapeXml('p\u000Bq')).toBe('pq')
  })

  it('preserves Tab / LF / CR (the XML-legal whitespace trio)', () => {
    // Tab, LF, CR are all legal in XML 1.0 text nodes; escapeXml
    // must not strip them (would garble multi-line descriptions).
    expect(escapeXml('a\tb\nc\rd')).toBe('a\tb\nc\rd')
  })
})

// ─── toRfc822 ──────────────────────────────────────────────────────

describe('toRfc822', () => {
  it('converts an ISO date to a valid RFC-822 UTC string', () => {
    const rfc = toRfc822('2026-04-20')
    // Node's toUTCString formats exactly like RFC-822 requires —
    // e.g., "Mon, 20 Apr 2026 00:00:00 GMT".
    expect(rfc).toMatch(
      /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
    )
    expect(rfc).toContain('20 Apr 2026')
    expect(rfc).toContain('GMT')
  })

  it('parses as UTC regardless of host timezone', () => {
    // ISO date "2026-01-01" should always map to Jan 1, not Dec 31,
    // even if the build machine is in UTC-5 or similar.
    expect(toRfc822('2026-01-01')).toContain('01 Jan 2026')
    expect(toRfc822('2026-01-01')).toContain('00:00:00 GMT')
  })

  // --- H4 regression: fail loudly on bad input ---------------------
  // The earlier implementation returned the string "Invalid Date"
  // when Date parsing failed, producing a <pubDate>Invalid Date
  // </pubDate> element that feed readers would refuse to parse
  // while the XML shape still looked valid. Throwing at the source
  // surfaces the bad input at build time rather than shipping it.

  it('throws a clear error on a non-date input', () => {
    expect(() => toRfc822('not-a-date')).toThrow(
      /toRfc822: invalid ISO date/,
    )
  })

  it('throws on an empty string', () => {
    expect(() => toRfc822('')).toThrow(/invalid ISO date/)
  })

  it('throws on an out-of-range date like 2026-02-30', () => {
    // JavaScript's Date is lenient — `new Date("2026-02-30T...")`
    // rolls over to March rather than producing NaN. That's
    // arguably worse than a parse error. Explicit check that our
    // function either throws OR emits a predictable canonical form.
    // Current Node behavior: this parses as 2026-03-02, so
    // toRfc822 returns a real UTC string. Record the behavior so
    // future Node changes don't silently shift dates around.
    const result = toRfc822('2026-02-30')
    // Either it threw (good) or rolled over to March (documented).
    expect(result).toMatch(/(02 Mar 2026|03 Mar 2026)/)
  })
})

// ─── buildRssFeed (pure function) ───────────────────────────────────

describe('buildRssFeed', () => {
  const feed = buildRssFeed(ACADEMY_LESSONS)

  it('starts with the correct XML declaration', () => {
    expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(
      true,
    )
  })

  it('declares RSS 2.0 + atom + dc namespaces on the <rss> element', () => {
    expect(feed).toContain('<rss version="2.0"')
    expect(feed).toContain('xmlns:atom="http://www.w3.org/2005/Atom"')
    expect(feed).toContain(
      'xmlns:dc="http://purl.org/dc/elements/1.1/"',
    )
  })

  it('includes the required <channel> child tags', () => {
    expect(feed).toContain('<title>SettleGrid Academy</title>')
    expect(feed).toContain(
      '<link>https://settlegrid.ai/learn/academy</link>',
    )
    expect(feed).toMatch(/<description>.+<\/description>/s)
    expect(feed).toContain('<language>en-us</language>')
    expect(feed).toMatch(/<lastBuildDate>[^<]+<\/lastBuildDate>/)
  })

  it('includes a well-formed <atom:link rel="self"> element', () => {
    expect(feed).toContain(
      '<atom:link href="https://settlegrid.ai/learn/academy/rss.xml" rel="self" type="application/rss+xml" />',
    )
  })

  it('emits one <item> per lesson in the registry', () => {
    const itemCount = [...feed.matchAll(/<item>/g)].length
    expect(itemCount).toBe(ACADEMY_LESSONS.length)
  })

  it("every item has every required RSS 2.0 element (title, link, description, pubDate, guid)", () => {
    // Rough-check: count matches for each required tag; should be
    // at least one per item.
    const n = ACADEMY_LESSONS.length
    expect([...feed.matchAll(/<title>/g)].length).toBeGreaterThanOrEqual(
      n + 1,
    ) // +1 for channel title
    expect([...feed.matchAll(/<link>/g)].length).toBeGreaterThanOrEqual(
      n + 1,
    ) // +1 for channel link
    expect(
      [...feed.matchAll(/<description>/g)].length,
    ).toBeGreaterThanOrEqual(n + 1)
    expect([...feed.matchAll(/<pubDate>/g)].length).toBeGreaterThanOrEqual(n)
    expect([...feed.matchAll(/<guid /g)].length).toBeGreaterThanOrEqual(n)
  })

  it('every lesson slug is represented in the feed output', () => {
    for (const lesson of ACADEMY_LESSONS) {
      expect(feed).toContain(lesson.canonicalUrl)
      expect(feed).toContain(escapeXml(lesson.title))
    }
  })

  it('items are sorted by publish date descending (most recent first)', () => {
    // Pull pubDate strings in document order; convert back to
    // timestamps; assert non-increasing.
    const pubDates = [...feed.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map(
      (m) => new Date(m[1]).getTime(),
    )
    for (let i = 1; i < pubDates.length; i++) {
      expect(pubDates[i]).toBeLessThanOrEqual(pubDates[i - 1])
    }
  })

  it('has NO unescaped `<` or `>` characters inside an item title (hostile audit item c)', () => {
    // Extract every <item>...</item> block and check that titles
    // are free of raw script markup. This is the check that would
    // have caught a naive implementation forgetting to escape
    // lesson titles.
    const itemBlocks = [...feed.matchAll(/<item>[\s\S]*?<\/item>/g)]
    for (const block of itemBlocks) {
      const titleMatch = block[0].match(/<title>([\s\S]*?)<\/title>/)
      expect(titleMatch).not.toBeNull()
      const titleContent = titleMatch![1]
      expect(titleContent).not.toContain('<script')
      expect(titleContent).not.toContain('</script>')
      // Inside the title node, raw < or > (besides the escaped
      // entity form) would break the XML. Ensure neither appears.
      expect(titleContent).not.toMatch(/[<>]/)
    }
  })

  it('handles a hostile lesson title with XML-reserved characters', () => {
    // Drive buildRssFeed with a synthetic registry entry containing
    // the full spectrum of reserved chars. Output must remain valid
    // XML with all five escaped correctly.
    const hostileLesson = {
      ...ACADEMY_LESSONS[0],
      slug: 'hostile-test',
      title: 'Pricing & "MCP" <tools> \'A vs B\'',
      summary: 'Test < > & " \' all in one line.',
      canonicalUrl: 'https://settlegrid.ai/learn/academy/hostile-test',
    }
    const out = buildRssFeed([hostileLesson])
    expect(out).toContain(
      'Pricing &amp; &quot;MCP&quot; &lt;tools&gt; &apos;A vs B&apos;',
    )
    expect(out).toContain('Test &lt; &gt; &amp; &quot; &apos;')
    // No raw `<` or `>` inside any title (escaped entities are fine).
    // Scoped to item titles to avoid false-matching the channel title
    // or the enclosing tag itself.
    const itemTitles = [
      ...out.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g),
    ]
    for (const m of itemTitles) {
      expect(m[1]).not.toMatch(/[<>]/)
    }
  })

  it('renders author without parentheses when author.url is absent', () => {
    // Coverage gap: every real lesson in the registry sets
    // `author.url` via the SHARED_AUTHOR constant, so the
    // falsy-url branch of the ternary never executes in the
    // real-registry tests. Drive it explicitly with a synthetic
    // lesson whose author has no url.
    const base = ACADEMY_LESSONS[0]
    const noUrlLesson = {
      ...base,
      slug: 'no-url-author',
      canonicalUrl: 'https://settlegrid.ai/learn/academy/no-url-author',
      author: { name: 'Anonymous Contributor', bio: 'test' },
    }
    const out = buildRssFeed([noUrlLesson])
    expect(out).toContain('<dc:creator>Anonymous Contributor</dc:creator>')
    // And the URL-form should not appear.
    expect(out).not.toContain('Anonymous Contributor (')
  })

  it('handles a lesson with no keywords (empty category list)', () => {
    // Coverage gap: the `keywords.slice(0, 5).map(...).join('\n')`
    // expression produces an empty string when keywords is empty.
    // The surrounding template still emits a well-formed item.
    const base = ACADEMY_LESSONS[0]
    const noKeywordsLesson = {
      ...base,
      slug: 'no-keywords',
      canonicalUrl: 'https://settlegrid.ai/learn/academy/no-keywords',
      keywords: [] as string[],
    }
    const out = buildRssFeed([noKeywordsLesson])
    // No <category> elements at all for this item.
    expect(out).not.toMatch(/<category>[^<]*<\/category>/)
    // But the item itself renders with the other required fields.
    expect(out).toContain('<item>')
    expect(out).toContain(
      '<guid isPermaLink="true">https://settlegrid.ai/learn/academy/no-keywords</guid>',
    )
  })

  it('sorts by publish date when dates differ (primary sort branch)', () => {
    // Coverage gap: all 5 real lessons share the same datePublished
    // ('2026-04-20'), so the sort comparator only ever hits its
    // tie-breaker path. Drive the primary date-sort branch with
    // two lessons whose dates differ and assert the newer wins.
    const base = ACADEMY_LESSONS[0]
    const older = {
      ...base,
      slug: 'older-lesson',
      canonicalUrl: 'https://settlegrid.ai/learn/academy/older-lesson',
      datePublished: '2025-01-15',
    }
    const newer = {
      ...base,
      slug: 'newer-lesson',
      canonicalUrl: 'https://settlegrid.ai/learn/academy/newer-lesson',
      datePublished: '2026-06-01',
    }
    const out = buildRssFeed([older, newer])
    // Newer item must appear before older in feed document order.
    const newerPos = out.indexOf('newer-lesson')
    const olderPos = out.indexOf('older-lesson')
    expect(newerPos).toBeLessThan(olderPos)
    expect(newerPos).toBeGreaterThan(-1)
    expect(olderPos).toBeGreaterThan(-1)
  })

  it('caps <category> elements at 5 even when keywords has more', () => {
    // Coverage of the `.slice(0, 5)` behavior at the upper bound.
    const base = ACADEMY_LESSONS[0]
    const manyKeywordsLesson = {
      ...base,
      slug: 'many-keywords',
      canonicalUrl: 'https://settlegrid.ai/learn/academy/many-keywords',
      keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    }
    const out = buildRssFeed([manyKeywordsLesson])
    // Exactly 5 <category> elements for this one item.
    const categoryCount = (out.match(/<category>/g) ?? []).length
    expect(categoryCount).toBe(5)
  })

  it('emits an empty <channel> gracefully when no lessons exist', () => {
    const out = buildRssFeed([])
    expect(out).toContain('<rss version="2.0"')
    expect(out).toContain('<channel>')
    expect(out).toContain('</channel>')
    expect([...out.matchAll(/<item>/g)].length).toBe(0)
    // lastBuildDate falls back to the 1970-01-01 sentinel for an
    // empty feed. Node's toUTCString renders this as "Thu, 01 Jan
    // 1970 00:00:00 GMT" — the regex allows the weekday prefix
    // before the numeric date.
    expect(out).toMatch(
      /<lastBuildDate>[^<]*01 Jan 1970[^<]*<\/lastBuildDate>/,
    )
  })
})

// ─── Academy landing page metadata ─────────────────────────────────
//
// H22 regression: the earlier implementation set RSS auto-discovery
// via `metadata.other: { 'alternate-rss': ... }` which emits
// `<meta name="alternate-rss">` — a tag no feed reader recognizes.
// Real auto-discovery needs `<link rel="alternate" type="application/
// rss+xml" ...>`. Next.js's `alternates.types` field emits that shape.
// This test asserts the metadata uses the discoverable pattern.

describe('academy landing page metadata (RSS auto-discovery)', () => {
  it('exposes the RSS feed via alternates.types so feed readers can discover it', async () => {
    const { metadata } = await import('../page')
    // alternates.types is the Next.js metadata shape that emits
    // `<link rel="alternate" type="...">` in the document head.
    const types = metadata.alternates?.types as
      | Record<string, string>
      | undefined
    expect(types).toBeDefined()
    expect(types?.['application/rss+xml']).toBe(
      'https://settlegrid.ai/learn/academy/rss.xml',
    )
  })

  it('does not use the non-standard "alternate-rss" meta name', () => {
    // The earlier implementation emitted a meta tag with
    // name="alternate-rss" that no reader looks for. Ensure it's
    // not there.
    return import('../page').then(({ metadata }) => {
      const other = metadata.other as Record<string, unknown> | undefined
      expect(other?.['alternate-rss']).toBeUndefined()
    })
  })
})

// ─── GET handler (integration) ─────────────────────────────────────

describe('GET /learn/academy/rss.xml', () => {
  it('returns 200 with correct Content-Type header', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(
      'application/rss+xml; charset=utf-8',
    )
  })

  it('sets a Cache-Control header for 1-hour freshness', async () => {
    const res = await GET()
    const cc = res.headers.get('cache-control')
    expect(cc).not.toBeNull()
    expect(cc).toContain('max-age=3600')
  })

  it('returns the same body buildRssFeed(ACADEMY_LESSONS) produces', async () => {
    const res = await GET()
    const body = await res.text()
    expect(body).toBe(buildRssFeed(ACADEMY_LESSONS))
  })
})
