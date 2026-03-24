/**
 * settlegrid-pexels — Pexels Stock Photos MCP Server
 *
 * Wraps the Pexels API with SettleGrid billing.
 * Requires a free Pexels API key.
 *
 * Methods:
 *   search_photos(query, per_page)  — Search photos     (2¢)
 *   get_curated(per_page)           — Curated picks     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  per_page?: number
}

interface CuratedInput {
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PEXELS_BASE = 'https://api.pexels.com/v1'
const API_KEY = process.env.PEXELS_API_KEY || ''

async function pexelsFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('PEXELS_API_KEY environment variable is required')
  const res = await fetch(`${PEXELS_BASE}${path}`, {
    headers: { Authorization: API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Pexels API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatPhoto(p: any): Record<string, unknown> {
  return {
    id: p.id,
    width: p.width,
    height: p.height,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    alt: p.alt,
    src: { original: p.src?.original, large: p.src?.large, medium: p.src?.medium, small: p.src?.small },
    url: p.url,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pexels',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_photos: { costCents: 2, displayName: 'Search Photos' },
      get_curated: { costCents: 2, displayName: 'Curated Photos' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPhotos = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await pexelsFetch<{ total_results: number; photos: any[] }>(
    `/search?query=${q}&per_page=${perPage}`
  )
  return {
    query: args.query,
    totalResults: data.total_results,
    photos: data.photos.map(formatPhoto),
  }
}, { method: 'search_photos' })

const getCurated = sg.wrap(async (args: CuratedInput) => {
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const data = await pexelsFetch<{ photos: any[] }>(`/curated?per_page=${perPage}`)
  return {
    count: data.photos.length,
    photos: data.photos.map(formatPhoto),
  }
}, { method: 'get_curated' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPhotos, getCurated }

console.log('settlegrid-pexels MCP server ready')
console.log('Methods: search_photos, get_curated')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
