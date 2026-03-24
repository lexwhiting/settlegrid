import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

const BASE_URL = 'https://settlegrid.ai'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = await checkRateLimit(apiLimiter, `feed:rss:${ip}`)
  if (!rl.success) {
    return new NextResponse('Rate limited', { status: 429 })
  }

  const activeTools = await db
    .select({
      name: schema.tools.name,
      slug: schema.tools.slug,
      description: schema.tools.description,
      category: schema.tools.category,
      createdAt: schema.tools.createdAt,
      developerName: schema.developers.name,
    })
    .from(schema.tools)
    .leftJoin(schema.developers, eq(schema.tools.developerId, schema.developers.id))
    .where(eq(schema.tools.status, 'active'))
    .orderBy(desc(schema.tools.createdAt))
    .limit(50)

  const now = new Date().toUTCString()

  const items = activeTools
    .map((tool) => {
      const title = escapeXml(tool.name)
      const link = `${BASE_URL}/tools/${escapeXml(tool.slug)}`
      const description = escapeXml(tool.description ?? 'An AI tool on SettleGrid.')
      const pubDate = tool.createdAt ? new Date(tool.createdAt).toUTCString() : now
      const author = tool.developerName ? escapeXml(tool.developerName) : 'SettleGrid Developer'
      const category = tool.category ? `<category>${escapeXml(tool.category)}</category>` : ''

      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <author>${author}</author>
      ${category}
      <guid isPermaLink="true">${link}</guid>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SettleGrid — New AI Tools</title>
    <link>${BASE_URL}</link>
    <description>Newly published AI tools on SettleGrid</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${BASE_URL}/api/feed" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
