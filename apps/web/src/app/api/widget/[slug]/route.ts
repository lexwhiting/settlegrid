import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { createRateLimiter, checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const maxDuration = 10

/** 10 requests per day per IP for widget interactions */
const widgetLimiter = createRateLimiter(10, '1 d')

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatCents(cents: number): string {
  if (cents === 0) return 'Free'
  return cents < 100 ? `${cents}\u00A2` : `$${(cents / 100).toFixed(2)}`
}

function getEffectiveCost(pricingConfig: unknown): number {
  if (!pricingConfig || typeof pricingConfig !== 'object') return 0
  const config = pricingConfig as Record<string, unknown>
  const cost = config.defaultCostCents
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) return Math.floor(cost)
  return 0
}

/**
 * GET /api/widget/:slug — Embeddable widget for a tool
 *
 * Returns an HTML page that can be embedded in an iframe:
 *   <iframe src="https://settlegrid.ai/api/widget/weather-api" width="400" height="300"></iframe>
 *
 * Shows: tool name, description, pricing, "Try it" button, and "Powered by SettleGrid" footer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

    const rl = await checkRateLimit(widgetLimiter, `widget:${ip}`)
    if (!rl.success) {
      return new NextResponse(widgetHtml('Rate Limited', 'Too many requests. Try again tomorrow.', null), {
        status: 429,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Frame-Options': 'ALLOWALL',
        },
      })
    }

    const [tool] = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
      })
      .from(tools)
      .where(eq(tools.slug, slug))
      .limit(1)

    if (!tool || tool.status !== 'active') {
      return new NextResponse(widgetHtml('Tool Not Found', 'This tool is not available.', null), {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Frame-Options': 'ALLOWALL',
        },
      })
    }

    const costCents = getEffectiveCost(tool.pricingConfig)

    logger.info('widget.served', { slug, ip })

    return new NextResponse(
      widgetHtml(tool.name, tool.description ?? 'An AI tool on SettleGrid.', {
        slug: tool.slug,
        category: tool.category,
        costCents,
        totalInvocations: tool.totalInvocations,
      }),
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Frame-Options': 'ALLOWALL',
        },
      }
    )
  } catch (error) {
    logger.error('widget.error', {}, error)
    return new NextResponse(widgetHtml('Error', 'Something went wrong.', null), {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
      },
    })
  }
}

function widgetHtml(
  name: string,
  description: string,
  toolInfo: { slug: string; category: string | null; costCents: number; totalInvocations: number } | null
): string {
  const safeName = escapeHtml(name)
  const safeDesc = escapeHtml(description.length > 120 ? description.slice(0, 117) + '...' : description)

  const toolSection = toolInfo
    ? `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${toolInfo.category ? `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:#E5A336;color:#0C0E14">${escapeHtml(toolInfo.category)}</span>` : ''}
        <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:rgba(229,163,54,0.15);color:#E5A336">${escapeHtml(formatCents(toolInfo.costCents))}/call</span>
        <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;background:rgba(255,255,255,0.06);color:#9CA3AF">${toolInfo.totalInvocations.toLocaleString()} calls</span>
      </div>
      <a href="https://settlegrid.ai/tools/${escapeHtml(toolInfo.slug)}" target="_blank" rel="noopener noreferrer"
         style="display:block;text-align:center;padding:10px 16px;background:#E5A336;color:#0C0E14;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;transition:opacity 0.2s"
         onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
        Try This Tool
      </a>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeName} — SettleGrid</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0C0E14;
    color: #E5E7EB;
    padding: 20px;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  a { color: #E5A336; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div style="flex:1">
    <h2 style="font-size:18px;font-weight:700;color:#F9FAFB;margin-bottom:6px">${safeName}</h2>
    <p style="font-size:13px;color:#9CA3AF;line-height:1.5;margin-bottom:16px">${safeDesc}</p>
    ${toolSection}
  </div>
  <div style="border-top:1px solid #2A2D3E;padding-top:12px;margin-top:16px;text-align:center">
    <span style="font-size:11px;color:#6B7280">
      Powered by <a href="https://settlegrid.ai" target="_blank" rel="noopener noreferrer" style="color:#E5A336;font-weight:600">SettleGrid</a>
    </span>
  </div>
</body>
</html>`
}
