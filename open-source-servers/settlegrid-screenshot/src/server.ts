/**
 * settlegrid-screenshot — Website Screenshot MCP Server
 *
 * Wraps free screenshot APIs with SettleGrid billing.
 *
 * Methods:
 *   capture(url)     — Full page screenshot URL    (3¢)
 *   thumbnail(url)   — Small thumbnail URL         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface UrlInput {
  url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MICROLINK_BASE = 'https://api.microlink.io'

function validateUrl(url: unknown): string {
  if (!url || typeof url !== 'string') throw new Error('url is required')
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs')
    return parsed.href
  } catch {
    throw new Error('Invalid URL format')
  }
}

async function microlinkScreenshot(url: string, fullPage: boolean): Promise<{
  screenshotUrl: string
  title: string
  description: string
}> {
  const params = new URLSearchParams({
    url,
    screenshot: 'true',
    meta: 'true',
    embed: 'screenshot.url',
    ...(fullPage ? { 'screenshot.fullPage': 'true' } : {}),
  })

  const res = await fetch(`${MICROLINK_BASE}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Screenshot API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as {
    status: string
    data: {
      screenshot: { url: string }
      title: string
      description: string
    }
  }

  if (data.status !== 'success') throw new Error('Screenshot capture failed')

  return {
    screenshotUrl: data.data.screenshot?.url || '',
    title: data.data.title || '',
    description: data.data.description || '',
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'screenshot',
  pricing: {
    defaultCostCents: 2,
    methods: {
      capture: { costCents: 3, displayName: 'Full Screenshot' },
      thumbnail: { costCents: 2, displayName: 'Thumbnail' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const capture = sg.wrap(async (args: UrlInput) => {
  const url = validateUrl(args.url)
  const result = await microlinkScreenshot(url, true)

  return {
    url,
    screenshotUrl: result.screenshotUrl,
    title: result.title,
    description: result.description?.slice(0, 300) || null,
    fullPage: true,
    domain: new URL(url).hostname,
    timestamp: new Date().toISOString(),
  }
}, { method: 'capture' })

const thumbnail = sg.wrap(async (args: UrlInput) => {
  const url = validateUrl(args.url)
  const result = await microlinkScreenshot(url, false)

  return {
    url,
    thumbnailUrl: result.screenshotUrl,
    title: result.title,
    fullPage: false,
    domain: new URL(url).hostname,
    timestamp: new Date().toISOString(),
  }
}, { method: 'thumbnail' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { capture, thumbnail }

console.log('settlegrid-screenshot MCP server ready')
console.log('Methods: capture, thumbnail')
console.log('Pricing: 2-3¢ per call | Powered by SettleGrid')
