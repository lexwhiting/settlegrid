/**
 * settlegrid-short-url — URL Shortening MCP Server
 *
 * Wraps the free is.gd service with SettleGrid billing.
 *
 * Methods:
 *   shorten(url)        — Create a short URL             (1¢)
 *   expand(shortUrl)    — Expand a short URL to original  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ShortenInput {
  url: string
}

interface ExpandInput {
  shortUrl: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateUrl(url: unknown, label: string): string {
  if (!url || typeof url !== 'string') throw new Error(`${label} is required`)
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs')
    return parsed.href
  } catch {
    throw new Error(`Invalid URL format for ${label}`)
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'short-url',
  pricing: {
    defaultCostCents: 1,
    methods: {
      shorten: { costCents: 1, displayName: 'Shorten URL' },
      expand: { costCents: 1, displayName: 'Expand URL' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const shorten = sg.wrap(async (args: ShortenInput) => {
  const url = validateUrl(args.url, 'url')

  const params = new URLSearchParams({
    format: 'json',
    url,
  })

  const res = await fetch(`https://is.gd/create.php?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`is.gd API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json() as { shorturl?: string; errorcode?: number; errormessage?: string }

  if (data.errorcode) {
    throw new Error(`is.gd error: ${data.errormessage}`)
  }

  return {
    originalUrl: url,
    shortUrl: data.shorturl || '',
    domain: 'is.gd',
    saved: url.length - (data.shorturl?.length || 0),
    timestamp: new Date().toISOString(),
  }
}, { method: 'shorten' })

const expand = sg.wrap(async (args: ExpandInput) => {
  const shortUrl = validateUrl(args.shortUrl, 'shortUrl')

  // Follow redirects manually to get the final URL
  const res = await fetch(shortUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  })

  const location = res.headers.get('location')

  if (res.status >= 300 && res.status < 400 && location) {
    return {
      shortUrl,
      originalUrl: location,
      statusCode: res.status,
      expanded: true,
      timestamp: new Date().toISOString(),
    }
  }

  // If no redirect, the URL might not be a short URL
  return {
    shortUrl,
    originalUrl: shortUrl,
    statusCode: res.status,
    expanded: false,
    note: 'URL did not redirect — it may not be a shortened URL',
    timestamp: new Date().toISOString(),
  }
}, { method: 'expand' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { shorten, expand }

console.log('settlegrid-short-url MCP server ready')
console.log('Methods: shorten, expand')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
