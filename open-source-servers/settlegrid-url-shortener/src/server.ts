/**
 * settlegrid-url-shortener — URL Shortener MCP Server
 *
 * Shorten long URLs using the is.gd service.
 *
 * Methods:
 *   shorten_url(url)              — Create a shortened URL  (1¢)
 *   shorten_custom(url, shorturl) — Create a shortened URL with custom shorturl path (via v.gd)  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ShortenUrlInput {
  url: string
}

interface ShortenCustomInput {
  url: string
  shorturl: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://is.gd'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-url-shortener/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`URL Shortener API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'url-shortener',
  pricing: {
    defaultCostCents: 1,
    methods: {
      shorten_url: { costCents: 1, displayName: 'Shorten URL' },
      shorten_custom: { costCents: 1, displayName: 'Shorten with Custom Alias' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const shortenUrl = sg.wrap(async (args: ShortenUrlInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/create.php?format=json&url=${encodeURIComponent(url)}`)
  return {
    shorturl: data.shorturl,
  }
}, { method: 'shorten_url' })

const shortenCustom = sg.wrap(async (args: ShortenCustomInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  if (!args.shorturl || typeof args.shorturl !== 'string') throw new Error('shorturl is required')
  const shorturl = args.shorturl.trim()
  const data = await apiFetch<any>(`/create.php?format=json&url=${encodeURIComponent(url)}&shorturl=${encodeURIComponent(shorturl)}`)
  return {
    shorturl: data.shorturl,
  }
}, { method: 'shorten_custom' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { shortenUrl, shortenCustom }

console.log('settlegrid-url-shortener MCP server ready')
console.log('Methods: shorten_url, shorten_custom')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
