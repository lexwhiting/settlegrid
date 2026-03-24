/**
 * settlegrid-art-institute — Art Institute of Chicago MCP Server
 *
 * Wraps Art Institute of Chicago API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_artworks(query, limit?)    — Search artworks (1¢)
 *   get_artwork(id)                   — Get artwork details (1¢)
 *   get_artists(query?)               — Search artists (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  id: number
}

interface GetArtistsInput {
  query?: string
}

interface AICDataItem {
  id: number
  title: string
  [key: string]: unknown
}

interface AICSearchResult {
  data: AICDataItem[]
  pagination: { total: number; limit: number; offset: number; total_pages: number; current_page: number }
  config: { iiif_url: string }
}

interface AICDetailResult {
  data: AICDataItem & {
    artist_display: string
    date_display: string
    medium_display: string
    dimensions: string
    image_id: string
    description: string | null
    [key: string]: unknown
  }
  config: { iiif_url: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.artic.edu/api/v1'
const USER_AGENT = 'settlegrid-art-institute/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Art Institute API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'art-institute',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 1, displayName: 'Search artworks' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      get_artists: { costCents: 1, displayName: 'Search artists' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  return apiFetch<AICSearchResult>('/artworks/search', params)
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (args.id === undefined || typeof args.id !== 'number') {
    throw new Error('id is required (numeric artwork ID)')
  }
  return apiFetch<AICDetailResult>(`/artworks/${args.id}`)
}, { method: 'get_artwork' })

const getArtists = sg.wrap(async (args: GetArtistsInput) => {
  if (args.query && typeof args.query === 'string') {
    return apiFetch<AICSearchResult>('/artists/search', { q: args.query })
  }
  return apiFetch<AICSearchResult>('/artists', { limit: '20' })
}, { method: 'get_artists' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, getArtists }

console.log('settlegrid-art-institute MCP server ready')
console.log('Methods: search_artworks, get_artwork, get_artists')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
