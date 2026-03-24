import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers, developerReputation } from '@/lib/db/schema'

export const maxDuration = 10

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function badge(label: string, message: string, color: string): string {
  const labelWidth = label.length * 6.5 + 16
  const messageWidth = message.length * 6.5 + 16
  const totalWidth = labelWidth + messageWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}">
  <title>${escapeXml(label)}: ${escapeXml(message)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${escapeXml(message)}</text>
  </g>
</svg>`
}

/**
 * GET /api/badge/dev/:slug — SVG reputation badge for a developer
 *
 * Shows: "SettleGrid | Developer Name (Gold)" with tier color
 * Usage in README: ![SettleGrid](https://settlegrid.ai/api/badge/dev/lexwhiting)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params

    const [developer] = await db
      .select({
        id: developers.id,
        name: developers.name,
        publicProfile: developers.publicProfile,
      })
      .from(developers)
      .where(eq(developers.slug, slug))
      .limit(1)

    if (!developer || !developer.publicProfile) {
      const svg = badge('SettleGrid', 'not found', '#999')
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=300',
        },
      })
    }

    const [rep] = await db
      .select({ score: developerReputation.score })
      .from(developerReputation)
      .where(eq(developerReputation.developerId, developer.id))
      .limit(1)

    const score = rep?.score ?? 0
    const tier = score >= 80 ? 'Platinum' : score >= 60 ? 'Gold' : score >= 40 ? 'Silver' : 'Bronze'
    const color =
      tier === 'Platinum' ? '#A78BFA'
        : tier === 'Gold' ? '#F59E0B'
          : tier === 'Silver' ? '#9CA3AF'
            : '#CD7F32'

    const displayName = developer.name ?? slug
    const svg = badge('SettleGrid', `${displayName} (${tier})`, color)

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch {
    const svg = badge('SettleGrid', 'error', '#EF4444')
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' },
    })
  }
}
