/**
 * RSS 2.0 feed for the SettleGrid Academy.
 *
 * Exposed at `/learn/academy/rss.xml`. Subscribers poll this URL to
 * see new lessons as they publish without having to crawl the
 * landing page. Emitted as a Next.js route handler rather than a
 * static file so the feed always reflects the current registry.
 *
 * Next.js restricts what a `route.ts` file is allowed to export
 * (GET/POST/etc plus a handful of config constants), so the XML
 * builders live in the sibling `feed-builder.ts` module and are
 * re-imported here.
 */

import { NextResponse } from 'next/server'
import { ACADEMY_LESSONS } from '@/lib/academy-lessons'
import { buildRssFeed } from './feed-builder'

// Revalidate at most once per hour. Changes to the registry show up
// within 60 minutes without forcing a full rebuild.
export const revalidate = 3600

export async function GET() {
  const xml = buildRssFeed(ACADEMY_LESSONS)
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
