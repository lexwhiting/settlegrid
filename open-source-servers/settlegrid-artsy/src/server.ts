/**
 * settlegrid-artsy — Artsy Art & Gallery MCP Server
 *
 * Wraps Artsy API with SettleGrid billing.
 * Requires ARTSY_CLIENT_ID and ARTSY_CLIENT_SECRET from https://developers.artsy.net
 *
 * Methods:
 *   search_artworks(query, limit?)    — Search artworks (2¢)
 *   get_artwork(id)                   — Get artwork details (1¢)
 *   search_artists(query)             — Search artists (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  id: string
}

interface SearchArtistsInput {
  query: string
}

interface ArtsyTokenResponse {
  type: string
  token: string
  expires_at: string
}

interface ArtsySearchResult {
  _embedded: { results: Array<{ type: string; title: string; description: string; [key: string]: unknown }> }
  total_count?: number
}

interface ArtsyArtwork {
  id: string
  title: string
  category: string
  medium: string
  date: string
  [key: string]: unknown
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.artsy.net/api'
const CLIENT_ID = process.env.ARTSY_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.ARTSY_CLIENT_SECRET ?? ''
const USER_AGENT = 'settlegrid-artsy/1.0 (contact@settlegrid.ai)'

let cachedToken: string | null = null
let tokenExpires = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpires) return cachedToken
  const res = await fetch(`${API_BASE}/tokens/xapp_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!res.ok) throw new Error(`Artsy auth failed: ${res.status}`)
  const data = await res.json() as ArtsyTokenResponse
  cachedToken = data.token
  tokenExpires = new Date(data.expires_at).getTime() - 60_000
  return data.token
}

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getToken()
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.artsy-v2+json',
      'X-Xapp-Token': token,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Artsy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'artsy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 2, displayName: 'Search artworks on Artsy' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      search_artists: { costCents: 2, displayName: 'Search artists on Artsy' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query, type: 'artwork' }
  if (args.limit !== undefined) params['size'] = String(args.limit)
  return apiFetch<ArtsySearchResult>('/search', params)
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Artsy artwork ID)')
  }
  return apiFetch<ArtsyArtwork>(`/artworks/${args.id}`)
}, { method: 'get_artwork' })

const searchArtists = sg.wrap(async (args: SearchArtistsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (artist name)')
  }
  return apiFetch<ArtsySearchResult>('/search', { q: args.query, type: 'artist' })
}, { method: 'search_artists' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, searchArtists }

console.log('settlegrid-artsy MCP server ready')
console.log('Methods: search_artworks, get_artwork, search_artists')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
