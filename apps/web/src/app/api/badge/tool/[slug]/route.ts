import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { getRedis, tryRedis } from '@/lib/redis'

export const maxDuration = 10

const BADGE_TTL_SECONDS = 90 * 24 * 60 * 60 // 90 days

/** Fire-and-forget Redis tracking for badge impressions */
function trackBadgeImpression(slug: string): void {
  const date = new Date().toISOString().slice(0, 10)
  void tryRedis(async () => {
    const redis = getRedis()
    const key = `badge:impressions:${slug}:${date}`
    const pipeline = redis.pipeline()
    pipeline.incr(key)
    pipeline.expire(key, BADGE_TTL_SECONDS)
    await pipeline.exec()
  })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatCallCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M calls`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K calls`
  return `${count} calls`
}

function badge(segments: { text: string; bg: string }[]): string {
  const segmentWidths = segments.map((s) => s.text.length * 6.5 + 16)
  const totalWidth = segmentWidths.reduce((a, b) => a + b, 0)

  let rects = ''
  let texts = ''
  let xOffset = 0

  for (let i = 0; i < segments.length; i++) {
    const w = segmentWidths[i]
    rects += `<rect x="${xOffset}" width="${w}" height="20" fill="${segments[i].bg}"/>`
    texts += `<text x="${xOffset + w / 2}" y="14">${escapeXml(segments[i].text)}</text>`
    xOffset += w
  }

  const ariaLabel = segments.map((s) => s.text).join(' | ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${escapeXml(ariaLabel)}">
  <title>${escapeXml(ariaLabel)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    ${rects}
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    ${texts}
  </g>
</svg>`
}

/**
 * GET /api/badge/tool/:slug — Enhanced SVG badge for a tool with live stats
 *
 * Shows: "SettleGrid | tool-name | X calls" with status color
 * Usage in README: ![SettleGrid](https://settlegrid.ai/api/badge/tool/my-tool)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params

    // Fire-and-forget badge impression tracking
    trackBadgeImpression(slug)

    const [tool] = await db
      .select({
        name: tools.name,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
      })
      .from(tools)
      .where(eq(tools.slug, slug))
      .limit(1)

    if (!tool) {
      const svg = badge([
        { text: 'SettleGrid', bg: '#555' },
        { text: 'not found', bg: '#999' },
      ])
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=300',
        },
      })
    }

    const color = tool.status === 'active' ? '#E5A336' : '#6B7280'
    const callCountText = formatCallCount(tool.totalInvocations)
    const svg = badge([
      { text: 'SettleGrid', bg: '#555' },
      { text: tool.name, bg: color },
      { text: callCountText, bg: '#4c1' },
    ])

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch {
    const svg = badge([
      { text: 'SettleGrid', bg: '#555' },
      { text: 'error', bg: '#EF4444' },
    ])
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' },
    })
  }
}
