/**
 * Dynamic serve route for showcase tools.
 *
 * GET  /api/tools/serve/{slug}?query=...&health=1
 * POST /api/tools/serve/{slug}  { "query": "..." }
 *
 * No authentication required — these are public showcase tools.
 * Each slug maps to a handler that either calls a free public API
 * or performs local computation and returns JSON.
 */

import { NextRequest, NextResponse } from 'next/server'
import { handlers } from './handlers'

export const maxDuration = 15
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ slug: string }>
}

function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'X-Powered-By': 'SettleGrid',
    },
  })
}

function errorJson(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message, status },
    { status, headers: { 'X-Powered-By': 'SettleGrid' } },
  )
}

async function handle(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { slug } = await ctx.params

  // Health check — fast path
  const isHealth = request.nextUrl.searchParams.get('health') === '1'
  if (isHealth) {
    const hasHandler = slug in handlers
    return jsonResponse({
      status: hasHandler ? 'ok' : 'unknown_tool',
      tool: slug,
      timestamp: new Date().toISOString(),
    }, hasHandler ? 200 : 404)
  }

  // Look up handler
  const handler = handlers[slug]
  if (!handler) {
    return errorJson(`Unknown tool: ${slug}. See /api/tools/serve for available tools.`, 404)
  }

  // Merge query-string params and JSON body into a single params object
  const params: Record<string, unknown> = {}

  // Query string
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    params[key] = value
  }

  // POST body (JSON)
  if (request.method === 'POST') {
    try {
      const contentType = request.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const body = await request.json() as Record<string, unknown>
        if (body && typeof body === 'object' && !Array.isArray(body)) {
          Object.assign(params, body)
        }
      }
    } catch {
      // Non-JSON body is fine — just use query params
    }
  }

  // Execute handler
  try {
    const result = await handler(params)
    return jsonResponse({ data: result, tool: slug, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal handler error'

    // Distinguish client errors from upstream failures
    if (message.includes('required') || message.includes('must be') || message.includes('Invalid')) {
      return errorJson(message, 400)
    }

    if (message.includes('Upstream')) {
      return errorJson(message, 502)
    }

    return errorJson(message, 500)
  }
}

export async function GET(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return handle(request, ctx)
}

export async function POST(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return handle(request, ctx)
}
