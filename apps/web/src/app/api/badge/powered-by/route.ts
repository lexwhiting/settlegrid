import { NextResponse } from 'next/server'

export const maxDuration = 5

/**
 * GET /api/badge/powered-by — Generic "Powered by SettleGrid" SVG badge
 *
 * Usage in README:
 *   ![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)
 *
 * Links to: https://settlegrid.ai
 */
export async function GET() {
  const label = 'Powered by'
  const message = 'SettleGrid'
  const color = '#E5A336'

  const labelWidth = label.length * 6.5 + 16
  const messageWidth = message.length * 6.5 + 16
  const totalWidth = labelWidth + messageWidth

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>
  </g>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
