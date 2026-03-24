/**
 * settlegrid-metropolitan — Met Museum Collection MCP Server
 *
 * Wraps The Metropolitan Museum of Art Open Access API with SettleGrid billing.
 * No API key needed — completely free and open.
 *
 * Methods:
 *   search_artworks(query, limit?)   — Search artworks (1¢)
 *   get_artwork(objectID)            — Get artwork details (1¢)
 *   get_departments()                — List departments (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchArtworksInput {
  query: string
  limit?: number
}

interface GetArtworkInput {
  objectID: number
}

interface SearchResult {
  total: number
  objectIDs: number[] | null
}

interface ArtworkDetail {
  objectID: number
  title: string
  artistDisplayName: string
  department: string
  objectDate: string
  medium: string
  primaryImage: string
  primaryImageSmall: string
  [key: string]: unknown
}

interface Department {
  departmentId: number
  displayName: string
}

interface DepartmentsResult {
  departments: Department[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
const USER_AGENT = 'settlegrid-metropolitan/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Met Museum API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'metropolitan',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artworks: { costCents: 1, displayName: 'Search Met artworks' },
      get_artwork: { costCents: 1, displayName: 'Get artwork details' },
      get_departments: { costCents: 1, displayName: 'List departments' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtworks = sg.wrap(async (args: SearchArtworksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const limit = args.limit ?? 10
  const encoded = encodeURIComponent(args.query)
  const data = await apiFetch<SearchResult>(`/search?q=${encoded}`)
  const ids = data.objectIDs?.slice(0, limit) ?? []
  const objects = await Promise.all(
    ids.map(id => apiFetch<ArtworkDetail>(`/objects/${id}`).catch(() => null))
  )
  return {
    total: data.total,
    returned: objects.filter(Boolean).length,
    artworks: objects.filter(Boolean),
  }
}, { method: 'search_artworks' })

const getArtwork = sg.wrap(async (args: GetArtworkInput) => {
  if (args.objectID === undefined || typeof args.objectID !== 'number') {
    throw new Error('objectID is required (numeric Met Museum object ID)')
  }
  return apiFetch<ArtworkDetail>(`/objects/${args.objectID}`)
}, { method: 'get_artwork' })

const getDepartments = sg.wrap(async () => {
  return apiFetch<DepartmentsResult>('/departments')
}, { method: 'get_departments' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtworks, getArtwork, getDepartments }

console.log('settlegrid-metropolitan MCP server ready')
console.log('Methods: search_artworks, get_artwork, get_departments')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
