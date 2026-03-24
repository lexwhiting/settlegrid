/**
 * settlegrid-google-books — Google Books MCP Server
 *
 * Wraps the Google Books API with SettleGrid billing.
 * API key optional but recommended for higher quota.
 *
 * Methods:
 *   search_volumes(query, maxResults?)  — Search books   (1¢)
 *   get_volume(volumeId)               — Volume details  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; maxResults?: number }
interface GetVolumeInput { volumeId: string }

interface VolumeInfo {
  title: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  pageCount?: number
  categories?: string[]
  averageRating?: number
  ratingsCount?: number
  imageLinks?: { thumbnail?: string }
  industryIdentifiers?: Array<{ type: string; identifier: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.googleapis.com/books/v1'
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || ''

async function booksFetch<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const keyParam = API_KEY ? `${separator}key=${API_KEY}` : ''
  const res = await fetch(`${API_BASE}${path}${keyParam}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google Books API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatVolume(v: { id: string; volumeInfo: VolumeInfo }) {
  const info = v.volumeInfo
  return {
    id: v.id,
    title: info.title,
    authors: info.authors || [],
    publisher: info.publisher || null,
    publishedDate: info.publishedDate || null,
    description: info.description?.slice(0, 500) || null,
    pageCount: info.pageCount || null,
    categories: info.categories || [],
    rating: info.averageRating || null,
    ratingsCount: info.ratingsCount || 0,
    thumbnail: info.imageLinks?.thumbnail || null,
    isbn: info.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier || info.industryIdentifiers?.[0]?.identifier || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'google-books',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_volumes: { costCents: 1, displayName: 'Search Volumes' },
      get_volume: { costCents: 1, displayName: 'Get Volume' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchVolumes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const max = Math.min(Math.max(args.maxResults || 10, 1), 40)
  const q = encodeURIComponent(args.query.trim())
  const data = await booksFetch<{ totalItems: number; items?: Array<{ id: string; volumeInfo: VolumeInfo }> }>(`/volumes?q=${q}&maxResults=${max}`)
  return { query: args.query, totalItems: data.totalItems, volumes: (data.items || []).map(formatVolume) }
}, { method: 'search_volumes' })

const getVolume = sg.wrap(async (args: GetVolumeInput) => {
  if (!args.volumeId || typeof args.volumeId !== 'string') {
    throw new Error('volumeId is required')
  }
  const data = await booksFetch<{ id: string; volumeInfo: VolumeInfo }>(`/volumes/${encodeURIComponent(args.volumeId)}`)
  return formatVolume(data)
}, { method: 'get_volume' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchVolumes, getVolume }

console.log('settlegrid-google-books MCP server ready')
console.log('Methods: search_volumes, get_volume')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
