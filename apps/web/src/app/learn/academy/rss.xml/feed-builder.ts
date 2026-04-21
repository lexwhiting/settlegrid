/**
 * Pure helpers for building the Academy RSS 2.0 feed.
 *
 * Lives in a sibling module rather than `route.ts` because Next.js
 * route files restrict exports to a whitelist (`GET`, `POST`,
 * `config`, `revalidate`, etc.); any other named export fails the
 * build with "X is not a valid Route export field." Splitting the
 * helpers into a plain module lets tests import them without
 * triggering that restriction.
 */

import type { ACADEMY_LESSONS } from '@/lib/academy-lessons'

export const BASE_URL = 'https://settlegrid.ai'
export const FEED_URL = `${BASE_URL}/learn/academy/rss.xml`

/**
 * Strip C0 control characters that are illegal in XML 1.0
 * (U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+007F).
 * Tab (\t, U+0009), LF (\n, U+000A), and CR (\r, U+000D) are
 * permitted by XML 1.0 so they're preserved.
 *
 * Without this, a stray form feed or null byte in a lesson title
 * would produce invalid XML that feed readers refuse to parse,
 * even though the five-entity escape alone (handled below) looks
 * complete.
 */
function stripInvalidXmlChars(str: string): string {
  return str.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    '',
  )
}

/**
 * Escape a string for safe embedding inside XML text nodes and
 * attribute values. Covers the five XML-reserved characters AND
 * strips the C0 control characters XML 1.0 prohibits. The
 * ampersand pass runs first so the other replacements don't
 * re-escape their inserted `&` characters.
 */
export function escapeXml(str: string): string {
  return stripInvalidXmlChars(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format an ISO date (YYYY-MM-DD) as an RFC-822 date string — the
 * format RSS 2.0 requires for `pubDate` and `lastBuildDate`. The
 * ISO date is parsed as UTC to avoid timezone drift across build
 * machines.
 *
 * Throws on invalid input. An unchecked bad date would silently
 * emit `<pubDate>Invalid Date</pubDate>` — valid XML shape but
 * broken RSS, which feed readers refuse to parse. Fail loudly at
 * the source rather than ship a broken feed.
 */
export function toRfc822(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`toRfc822: invalid ISO date ${JSON.stringify(iso)}`)
  }
  return d.toUTCString()
}

/**
 * Build the full RSS 2.0 XML string from the current registry.
 * Pure function — no I/O, no timestamps from the clock — so the
 * output is deterministic given an input registry.
 */
export function buildRssFeed(
  lessons: typeof ACADEMY_LESSONS,
): string {
  const sorted = [...lessons].sort((a, b) => {
    const byDate = b.datePublished.localeCompare(a.datePublished)
    return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug)
  })

  // lastBuildDate reflects the most recent modification across all
  // lessons so edit-without-new-publication still refreshes the
  // feed.
  const latestModified = sorted.reduce<string>((acc, l) => {
    return l.dateModified > acc ? l.dateModified : acc
  }, '1970-01-01')
  const lastBuildDate = toRfc822(latestModified)

  const items = sorted
    .map((lesson) => {
      const title = escapeXml(lesson.title)
      const link = escapeXml(lesson.canonicalUrl)
      const description = escapeXml(lesson.summary)
      const pubDate = toRfc822(lesson.datePublished)
      const author = escapeXml(
        lesson.author.url
          ? `${lesson.author.name} (${lesson.author.url})`
          : lesson.author.name,
      )
      const categories = lesson.keywords
        .slice(0, 5)
        .map((k) => `      <category>${escapeXml(k)}</category>`)
        .join('\n')

      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${author}</dc:creator>
${categories}
      <guid isPermaLink="true">${link}</guid>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>SettleGrid Academy</title>
    <link>${BASE_URL}/learn/academy</link>
    <description>Long-form lessons on pricing, payment rails, tool-calling economics, and margin math for developers monetizing MCP tools and AI APIs.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`
}
