import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

export const maxDuration = 10

function escapeJsString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function formatCents(cents: number): string {
  if (cents === 0) return 'Free'
  return cents < 100 ? `${cents}\u00A2` : `$${(cents / 100).toFixed(2)}`
}

function formatCallCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

function getEffectiveCost(pricingConfig: unknown): number {
  if (!pricingConfig || typeof pricingConfig !== 'object') return 0
  const config = pricingConfig as Record<string, unknown>
  const cost = config.defaultCostCents
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) return Math.floor(cost)
  return 0
}

/**
 * GET /api/badge/embed.js?tool=slug — Embeddable JavaScript badge widget
 *
 * Usage:
 *   <script src="https://settlegrid.ai/api/badge/embed.js?tool=weather-api"></script>
 *
 * Renders a compact widget showing: tool name, price, call count, "Try it" button.
 */
export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('tool')

    if (!slug || slug.length > 200) {
      return new NextResponse(
        '/* SettleGrid badge: missing or invalid ?tool= parameter */',
        { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=60' } }
      )
    }

    const [tool] = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        pricingConfig: tools.pricingConfig,
        status: tools.status,
        totalInvocations: tools.totalInvocations,
      })
      .from(tools)
      .where(eq(tools.slug, slug))
      .limit(1)

    if (!tool || tool.status !== 'active') {
      return new NextResponse(
        `/* SettleGrid badge: tool "${escapeJsString(slug)}" not found or inactive */`,
        { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300' } }
      )
    }

    const costCents = getEffectiveCost(tool.pricingConfig)
    const name = escapeJsString(tool.name)
    const desc = escapeJsString((tool.description ?? '').slice(0, 80))
    const price = escapeJsString(formatCents(costCents))
    const calls = escapeJsString(formatCallCount(tool.totalInvocations))
    const toolUrl = `https://settlegrid.ai/tools/${escapeJsString(tool.slug)}`

    logger.info('badge.embed_served', { slug })

    const js = `(function(){
  if(document.getElementById('sg-badge-${escapeJsString(slug)}')){return;}
  var c=document.createElement('div');
  c.id='sg-badge-${escapeJsString(slug)}';
  c.style.cssText='display:inline-block;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0C0E14;border:1px solid #2A2D3E;border-radius:10px;padding:12px 16px;max-width:320px;color:#E5E7EB;font-size:13px;line-height:1.4;';
  c.innerHTML='<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'
    +'<span style="font-weight:700;color:#F9FAFB;font-size:14px">${name}</span>'
    +'<span style="display:inline-block;padding:1px 6px;border-radius:9999px;font-size:10px;font-weight:600;background:#E5A336;color:#0C0E14">${price}/call</span>'
    +'</div>'
    +'<div style="color:#9CA3AF;font-size:12px;margin-bottom:10px">${desc}</div>'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<span style="color:#6B7280;font-size:11px">${calls} calls</span>'
    +'<a href="${toolUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:5px 12px;background:#E5A336;color:#0C0E14;border-radius:6px;text-decoration:none;font-weight:600;font-size:12px">Try it</a>'
    +'</div>'
    +'<div style="border-top:1px solid #2A2D3E;margin-top:10px;padding-top:8px;text-align:center;font-size:10px;color:#6B7280">'
    +'Powered by <a href="https://settlegrid.ai" target="_blank" rel="noopener noreferrer" style="color:#E5A336;text-decoration:none;font-weight:600">SettleGrid</a>'
    +'</div>';
  var s=document.currentScript||document.scripts[document.scripts.length-1];
  s.parentNode.insertBefore(c,s.nextSibling);
})();`

    return new NextResponse(js, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    logger.error('badge.embed_error', {}, error)
    return new NextResponse(
      '/* SettleGrid badge: internal error */',
      { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } }
    )
  }
}
