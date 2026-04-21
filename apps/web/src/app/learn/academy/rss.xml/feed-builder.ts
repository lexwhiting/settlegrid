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
 * Escape a string for safe embedding inside XML text nodes and
 * attribute values. Covers the five XML-reserved characters.
 * The ampersand pass runs first so the other replacements don't
 * re-escape their inserted `&` characters.
 */
export function escapeXml(str: string): string {
  return str
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
 */
export function toRfc822(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toUTCString()
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
