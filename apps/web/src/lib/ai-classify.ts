/**
 * AI Classification Helper for SettleGrid Auto-Detect
 *
 * Uses Claude API (via @ai-sdk/anthropic) to classify an API endpoint
 * when basic URL probing cannot determine the service type.
 * Results are cached in Redis for 24 hours.
 */

import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { tryRedis, getRedis } from './redis'
import { CATEGORY_SLUGS } from './categories'
import { logger } from './logger'

const CACHE_TTL_SECONDS = 86400 // 24 hours
const CACHE_PREFIX = 'ai-classify:'

const SERVICE_TYPES = [
  'mcp-tool',
  'llm-inference',
  'rest-api',
  'browser-automation',
  'media-generation',
  'agent-service',
] as const

export type ServiceType = (typeof SERVICE_TYPES)[number]

export interface ClassificationResult {
  serviceType: ServiceType
  category: string
  suggestedName: string
  suggestedDescription: string
  suggestedPriceCents: number
  suggestedPricingModel: 'per-invocation' | 'per-token' | 'per-byte' | 'per-second'
  confidence: number
  tags: string[]
}

const classificationSchema = z.object({
  serviceType: z.enum(SERVICE_TYPES),
  category: z.string(),
  suggestedName: z.string().max(200),
  suggestedDescription: z.string().max(500),
  suggestedPriceCents: z.number().int().min(1).max(10000),
  suggestedPricingModel: z.enum(['per-invocation', 'per-token', 'per-byte', 'per-second']),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string().max(50)).max(10),
})

function buildPrompt(
  url: string,
  headers: Record<string, string>,
  bodySample: string
): string {
  const categoryList = CATEGORY_SLUGS.join(', ')

  return `Classify this API endpoint into one of these categories and determine its service type.

URL: ${url}
Response Headers: ${JSON.stringify(headers)}
Response Body (first 500 chars): ${bodySample}

Available categories: ${categoryList}

Service types:
- mcp-tool: Model Context Protocol server
- llm-inference: LLM/AI model inference endpoint
- rest-api: Standard REST API
- browser-automation: Web scraping or browser automation
- media-generation: Image, audio, or video generation
- agent-service: AI agent or multi-step workflow

Return a JSON object with:
- serviceType: one of the service types above
- category: one of the categories above
- suggestedName: a human-friendly name for this service (max 200 chars)
- suggestedDescription: a 1-2 sentence description (max 500 chars)
- suggestedPriceCents: suggested price per call in cents (integer, typically 1-50)
- suggestedPricingModel: one of per-invocation, per-token, per-byte, per-second
- confidence: your confidence in this classification (0-1)
- tags: up to 10 relevant tags for discovery

Base pricing guidance:
- Simple data lookups: 1-3 cents
- NLP/text processing: 3-8 cents
- Image/media generation: 5-50 cents
- LLM inference: 2-20 cents (depends on model size)
- Code execution: 3-10 cents
- Browser automation: 5-15 cents`
}

/**
 * Normalizes the cache key from a URL to avoid collisions.
 */
function cacheKey(url: string): string {
  return `${CACHE_PREFIX}${url}`
}

/**
 * Uses Claude to classify an API endpoint.
 * Caches results in Redis for 24 hours.
 * Gracefully degrades to a default "rest-api" classification if Claude is unavailable.
 */
export async function classifyWithAI(
  url: string,
  headers: Record<string, string>,
  bodySample: string
): Promise<ClassificationResult> {
  // Check cache first
  const cached = await tryRedis(async () => {
    const redis = getRedis()
    const data = await redis.get<ClassificationResult>(cacheKey(url))
    return data
  })

  if (cached) {
    logger.info('ai_classify.cache_hit', { url })
    return cached
  }

  try {
    const prompt = buildPrompt(url, headers, bodySample)

    const result = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: classificationSchema,
      prompt,
    })

    const classification = result.object

    // Validate category is in our list, fall back to 'utility' if not
    if (!CATEGORY_SLUGS.includes(classification.category)) {
      classification.category = 'utility'
    }

    // Cache the result
    await tryRedis(async () => {
      const redis = getRedis()
      await redis.set(cacheKey(url), classification, { ex: CACHE_TTL_SECONDS })
    })

    logger.info('ai_classify.success', {
      url,
      serviceType: classification.serviceType,
      category: classification.category,
      confidence: classification.confidence,
    })

    return classification
  } catch (err) {
    logger.error('ai_classify.failed', { url }, err)

    // Graceful degradation: return a sensible default
    return fallbackClassification(url)
  }
}

/**
 * Fallback classification when AI is unavailable.
 * Derives a basic classification from the URL structure.
 */
function fallbackClassification(url: string): ClassificationResult {
  let name = 'API Service'
  try {
    const parsed = new URL(url)
    const hostParts = parsed.hostname.replace('www.', '').split('.')
    name = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1) + ' API'
  } catch {
    // Use default name
  }

  return {
    serviceType: 'rest-api',
    category: 'utility',
    suggestedName: name,
    suggestedDescription: 'A REST API endpoint available on SettleGrid.',
    suggestedPriceCents: 5,
    suggestedPricingModel: 'per-invocation',
    confidence: 0.1,
    tags: ['api'],
  }
}
