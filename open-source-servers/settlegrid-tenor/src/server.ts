/**
 * settlegrid-tenor — Tenor GIF Search MCP Server
 *
 * Wraps the Tenor API (Google) with SettleGrid billing.
 * Requires a Tenor API key.
 *
 * Methods:
 *   search_gifs(query, limit)  — Search GIFs       (2¢)
 *   get_featured(limit)        — Featured GIFs     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface FeaturedInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENOR_BASE = 'https://tenor.googleapis.com/v2'
const API_KEY = process.env.TENOR_API_KEY || ''

async function tenorFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('TENOR_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${TENOR_BASE}${path}${sep}key=${API_KEY}&client_key=settlegrid`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Tenor API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatGif(r: any): Record<string, unknown> {
  return {
    id: r.id,
    title: r.title,
    contentDescription: r.content_description,
    url: r.url,
    gifUrl: r.media_formats?.gif?.url,
    tinyGifUrl: r.media_formats?.tinygif?.url,
    previewUrl: r.media_formats?.nanogif?.url,
    created: r.created,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tenor',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_gifs: { costCents: 2, displayName: 'Search GIFs' },
      get_featured: { costCents: 2, displayName: 'Featured GIFs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGifs = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await tenorFetch<{ results: any[] }>(`/search?q=${q}&limit=${limit}`)
  return {
    query: args.query,
    count: data.results.length,
    gifs: data.results.map(formatGif),
  }
}, { method: 'search_gifs' })

const getFeatured = sg.wrap(async (args: FeaturedInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await tenorFetch<{ results: any[] }>(`/featured?limit=${limit}`)
  return {
    count: data.results.length,
    gifs: data.results.map(formatGif),
  }
}, { method: 'get_featured' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGifs, getFeatured }

console.log('settlegrid-tenor MCP server ready')
console.log('Methods: search_gifs, get_featured')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
