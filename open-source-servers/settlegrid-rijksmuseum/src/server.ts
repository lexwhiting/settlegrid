/**
 * settlegrid-rijksmuseum — Rijksmuseum Collection MCP Server
 *
 * Wraps Rijksmuseum API with SettleGrid billing.
 * Requires a free API key from https://data.rijksmuseum.nl
 *
 * Methods:
 *   search_artworks(query, limit?)    — Search artworks (1¢)
 *   get_artwork(objectNumber)         — Get artwork details (1¢)
 *   get_collections(limit?)           — Browse collection (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  objectNumber: string
}

interface GetCollectionsInput {
  limit?: number
}

interface RijksArtObject {
  objectNumber: string
  title: string
  principalOrFirstMaker: string
  longTitle: string
  webImage: { url: string } | null
  headerImage: { url: string } | null
  [key: string]: unknown
}

interface RijksSearchResult {
  count: number
  artObjects: RijksArtObject[]
}

interface RijksDetailResult {
  artObject: RijksArtObject & {
    description: string
    plaqueDescriptionEnglish: string
    dating: { sortingDate: number; presentingDate: string }
    materials: string[]
    techniques: string[]
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.rijksmuseum.nl/api/en/collection'
const API_KEY = process.env.RIJKS_API_KEY ?? ''
const USER_AGENT = 'settlegrid-rijksmuseum/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('key', API_KEY)
  url.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Rijksmuseum API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rijksmuseum',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 1, displayName: 'Search Rijksmuseum artworks' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      get_collections: { costCents: 1, displayName: 'Browse collection items' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['ps'] = String(args.limit)
  return apiFetch<RijksSearchResult>('', params)
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (!args.objectNumber || typeof args.objectNumber !== 'string') {
    throw new Error('objectNumber is required (e.g. SK-C-5)')
  }
  return apiFetch<RijksDetailResult>(`/${args.objectNumber}`)
}, { method: 'get_artwork' })

const getCollections = sg.wrap(async (args: GetCollectionsInput) => {
  const params: Record<string, string> = { s: 'relevance' }
  if (args.limit !== undefined) params['ps'] = String(args.limit)
  return apiFetch<RijksSearchResult>('', params)
}, { method: 'get_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, getCollections }

console.log('settlegrid-rijksmuseum MCP server ready')
console.log('Methods: search_artworks, get_artwork, get_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
