import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { checkRateLimit, createRateLimiter } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { classifyWithAI, type ClassificationResult } from '@/lib/ai-classify'
import { getSuggestedPricing } from '@/lib/pricing-utils'
import { logger } from '@/lib/logger'

export const maxDuration = 30

/** 10 requests per minute per IP — prevent abuse without auth */
const autoDetectLimiter = createRateLimiter(10, '1 m')

// ─── SSRF Protection ─────────────────────────────────────────────────────────

function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true
    if (hostname === 'metadata.google.internal' || hostname.endsWith('.internal')) return true
    const parts = hostname.split('.').map(Number)
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      if (parts[0] === 10) return true
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      if (parts[0] === 192 && parts[1] === 168) return true
      if (parts[0] === 169 && parts[1] === 254) return true
      if (parts[0] === 0) return true
    }
    return false
  } catch {
    return true
  }
}

// ─── Request Schema ──────────────────────────────────────────────────────────

const autoDetectSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .max(2000, 'URL must not exceed 2000 characters')
    .refine(
      (u) => u.startsWith('https://'),
      'URL must use HTTPS'
    )
    .refine(
      (u) => !isPrivateUrl(u),
      'URL must not point to private or internal addresses'
    ),
})

// ─── Service Type Detection ──────────────────────────────────────────────────

type ServiceType = 'mcp-tool' | 'llm-inference' | 'rest-api' | 'browser-automation' | 'media-generation' | 'agent-service'

interface ProbeResult {
  statusCode: number
  contentType: string
  headers: Record<string, string>
  bodySample: string
  latencyMs: number
}

async function probeEndpoint(url: string): Promise<ProbeResult | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const start = performance.now()
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/html, */*',
        'User-Agent': 'SettleGrid-AutoDetect/1.0',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    const latencyMs = Math.round(performance.now() - start)
    const contentType = response.headers.get('content-type') ?? ''

    // Collect relevant headers
    const headers: Record<string, string> = {}
    for (const key of ['content-type', 'server', 'x-powered-by', 'x-request-id', 'access-control-allow-origin']) {
      const val = response.headers.get(key)
      if (val) headers[key] = val
    }

    // Read body sample (first 500 chars)
    const textBody = await response.text()
    const bodySample = textBody.slice(0, 500)

    return {
      statusCode: response.status,
      contentType,
      headers,
      bodySample,
      latencyMs,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function tryMcpHandshake(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'settlegrid-autodetect', version: '1.0.0' },
        },
        id: 1,
      }),
      signal: controller.signal,
    })

    if (!response.ok) return false

    const body = await response.json()
    // MCP server responds with serverInfo and capabilities
    return !!(body?.result?.serverInfo || body?.result?.capabilities)
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function checkOpenApiSpec(baseUrl: string): Promise<string | null> {
  const specPaths = ['/openapi.json', '/swagger.json', '/api-docs', '/.well-known/openapi.json']

  for (const path of specPaths) {
    try {
      const specUrl = new URL(path, baseUrl).href
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)

      const response = await fetch(specUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      clearTimeout(timeout)

      if (response.ok) {
        const text = await response.text()
        // Check if it looks like an OpenAPI spec
        if (text.includes('"openapi"') || text.includes('"swagger"') || text.includes('"paths"')) {
          return text.slice(0, 500)
        }
      }
    } catch {
      // Try next path
    }
  }
  return null
}

function classifyFromProbe(probe: ProbeResult): ServiceType {
  const ct = probe.contentType.toLowerCase()
  const body = probe.bodySample.toLowerCase()

  // LLM inference endpoints typically return model/completion/choices keys
  if (ct.includes('application/json')) {
    if (body.includes('"model"') && (body.includes('"choices"') || body.includes('"completion"') || body.includes('"generated'))) {
      return 'llm-inference'
    }
  }

  // HTML response suggests browser automation or web scraping output
  if (ct.includes('text/html')) {
    return 'browser-automation'
  }

  // Media types
  if (ct.includes('image/') || ct.includes('audio/') || ct.includes('video/')) {
    return 'media-generation'
  }

  // Default to REST API
  return 'rest-api'
}

function suggestCategoryFromType(serviceType: ServiceType): string {
  const mapping: Record<ServiceType, string> = {
    'mcp-tool': 'utility',
    'llm-inference': 'nlp',
    'rest-api': 'data',
    'browser-automation': 'data',
    'media-generation': 'media',
    'agent-service': 'code',
  }
  return mapping[serviceType]
}

function suggestNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const hostParts = parsed.hostname.replace('www.', '').split('.')
    const baseName = hostParts[0]
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const lastPath = pathParts.length > 0 ? pathParts[pathParts.length - 1] : ''

    const nameBase = lastPath || baseName
    // Convert kebab-case or snake_case to Title Case
    return nameBase
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || 'API Service'
  } catch {
    return 'API Service'
  }
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request)

  try {
    // Rate limit by IP (no auth required for frictionless experience)
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(autoDetectLimiter, `auto-detect:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    const body = await parseBody(request, autoDetectSchema)
    const url = body.url

    logger.info('auto_detect.start', { url, ip })

    // Step 1: Probe the endpoint
    const [probe, isMcp, openApiSpec] = await Promise.all([
      probeEndpoint(url),
      tryMcpHandshake(url),
      checkOpenApiSpec(url),
    ])

    // Step 2: Classify
    let serviceType: ServiceType
    let category: string
    let suggestedName: string
    let suggestedDescription: string
    let suggestedPriceCents: number
    let suggestedPricingModel: string
    let confidence: number
    let tags: string[] = []

    if (isMcp) {
      // MCP handshake succeeded — definitive classification
      serviceType = 'mcp-tool'
      category = 'utility'
      suggestedName = suggestNameFromUrl(url) + ' MCP'
      suggestedDescription = `MCP-compatible tool server at ${new URL(url).hostname}.`
      suggestedPriceCents = 5
      suggestedPricingModel = 'per-invocation'
      confidence = 0.95
      tags = ['mcp', 'tool']
    } else if (probe) {
      // Basic probe succeeded — try classification
      const basicType = classifyFromProbe(probe)

      // Use AI classification for richer results
      let aiResult: ClassificationResult | null = null
      try {
        aiResult = await classifyWithAI(url, probe.headers, probe.bodySample)
      } catch {
        // AI classification failed — use basic
      }

      if (aiResult && aiResult.confidence > 0.3) {
        serviceType = aiResult.serviceType
        category = aiResult.category
        suggestedName = aiResult.suggestedName
        suggestedDescription = aiResult.suggestedDescription
        suggestedPriceCents = aiResult.suggestedPriceCents
        suggestedPricingModel = aiResult.suggestedPricingModel
        confidence = aiResult.confidence
        tags = aiResult.tags
      } else {
        serviceType = basicType
        category = suggestCategoryFromType(basicType)
        suggestedName = suggestNameFromUrl(url)
        suggestedDescription = `A ${basicType.replace('-', ' ')} endpoint.`
        suggestedPriceCents = 5
        suggestedPricingModel = 'per-invocation'
        confidence = 0.5
      }

      // If we found an OpenAPI spec, boost confidence
      if (openApiSpec) {
        serviceType = serviceType === 'rest-api' ? 'rest-api' : serviceType
        confidence = Math.min(confidence + 0.15, 1)
        if (!tags.includes('openapi')) tags.push('openapi')
      }
    } else {
      // Probe completely failed — try AI with just the URL
      let aiResult: ClassificationResult | null = null
      try {
        aiResult = await classifyWithAI(url, {}, '')
      } catch {
        // AI unavailable
      }

      if (aiResult && aiResult.confidence > 0.2) {
        serviceType = aiResult.serviceType
        category = aiResult.category
        suggestedName = aiResult.suggestedName
        suggestedDescription = aiResult.suggestedDescription
        suggestedPriceCents = aiResult.suggestedPriceCents
        suggestedPricingModel = aiResult.suggestedPricingModel
        confidence = aiResult.confidence
        tags = aiResult.tags
      } else {
        // Complete fallback
        serviceType = 'rest-api'
        category = 'utility'
        suggestedName = suggestNameFromUrl(url)
        suggestedDescription = 'An API endpoint. We could not probe it — please verify the URL is accessible.'
        suggestedPriceCents = 5
        suggestedPricingModel = 'per-invocation'
        confidence = 0.1
      }
    }

    // Step 3: Get market pricing context
    let pricingContext: { p25Cents: number; p75Cents: number; toolCount: number } | null = null
    try {
      const pricing = await getSuggestedPricing(category)
      pricingContext = {
        p25Cents: pricing.p25Cents,
        p75Cents: pricing.p75Cents,
        toolCount: pricing.toolCount,
      }
      // Adjust suggested price to be within market range if we have data
      if (pricing.toolCount >= 3 && pricing.suggestedCents > 0) {
        suggestedPriceCents = pricing.suggestedCents
      }
    } catch {
      // Pricing context unavailable — use AI's suggestion
    }

    // Generate a slug from the suggested name
    const suggestedSlug = suggestedName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 100)

    logger.info('auto_detect.complete', {
      url,
      serviceType,
      category,
      confidence,
    })

    return successResponse(
      {
        serviceType,
        suggestedCategory: category,
        suggestedName,
        suggestedSlug,
        suggestedDescription,
        suggestedPriceCents,
        suggestedPricingModel,
        confidence,
        tags,
        pricingContext,
        probeLatencyMs: probe?.latencyMs ?? null,
      },
      200,
      requestId
    )
  } catch (error) {
    return internalErrorResponse(error, requestId)
  }
}
