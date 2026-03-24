/**
 * settlegrid-giphy — Giphy GIF Search MCP Server
 *
 * Wraps the Giphy API with SettleGrid billing.
 * Requires a Giphy API key.
 *
 * Methods:
 *   search_gifs(query, limit)  — Search GIFs     (2¢)
 *   get_trending(limit)        — Trending GIFs   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface TrendingInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GIPHY_BASE = 'https://api.giphy.com/v1'
const API_KEY = process.env.GIPHY_API_KEY || ''

async function giphyFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('GIPHY_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${GIPHY_BASE}${path}${sep}api_key=${API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Giphy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatGif(g: any): Record<string, unknown> {
  return {
    id: g.id,
    title: g.title,
    url: g.url,
    gifUrl: g.images?.original?.url,
    previewUrl: g.images?.preview_gif?.url,
    width: g.images?.original?.width,
    height: g.images?.original?.height,
    rating: g.rating,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'giphy',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_gifs: { costCents: 2, displayName: 'Search GIFs' },
      get_trending: { costCents: 2, displayName: 'Trending GIFs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGifs = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const q = encodeURIComponent(args.query)
  const data = await giphyFetch<{ data: any[]; pagination: any }>(
    `/gifs/search?q=${q}&limit=${limit}&rating=g`
  )
  return {
    query: args.query,
    count: data.data.length,
    totalCount: data.pagination.total_count,
    gifs: data.data.map(formatGif),
  }
}, { method: 'search_gifs' })

const getTrending = sg.wrap(async (args: TrendingInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const data = await giphyFetch<{ data: any[] }>(`/gifs/trending?limit=${limit}&rating=g`)
  return {
    count: data.data.length,
    gifs: data.data.map(formatGif),
  }
}, { method: 'get_trending' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGifs, getTrending }

console.log('settlegrid-giphy MCP server ready')
console.log('Methods: search_gifs, get_trending')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
