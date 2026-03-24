/**
 * settlegrid-omdb — Open Movie Database MCP Server
 *
 * Methods:
 *   search_title(query, type?)  — Search by title    (2¢)
 *   get_by_id(imdb_id)          — Get by IMDb ID     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  type?: string
}

interface GetByIdInput {
  imdb_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.omdbapi.com'
const API_KEY = process.env.OMDB_API_KEY || ''

async function omdbFetch<T>(params: string): Promise<T> {
  if (!API_KEY) throw new Error('OMDB_API_KEY environment variable is required')
  const res = await fetch(`${BASE}/?apikey=${API_KEY}&${params}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OMDb API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as T & { Response?: string; Error?: string }
  if (data.Response === 'False') {
    throw new Error(`OMDb: ${data.Error || 'Unknown error'}`)
  }
  return data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'omdb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_title: { costCents: 2, displayName: 'Search by Title' },
      get_by_id: { costCents: 2, displayName: 'Get by IMDb ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTitle = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const typeParam = args.type ? `&type=${encodeURIComponent(args.type)}` : ''
  const data = await omdbFetch<{ Search: Array<{ Title: string; Year: string; imdbID: string; Type: string; Poster: string }>; totalResults: string }>(`s=${q}${typeParam}`)
  return {
    query: args.query,
    totalResults: parseInt(data.totalResults, 10),
    results: (data.Search || []).slice(0, 10).map((r) => ({
      title: r.Title,
      year: r.Year,
      imdbId: r.imdbID,
      type: r.Type,
      poster: r.Poster !== 'N/A' ? r.Poster : null,
    })),
  }
}, { method: 'search_title' })

const getById = sg.wrap(async (args: GetByIdInput) => {
  if (!args.imdb_id || typeof args.imdb_id !== 'string') {
    throw new Error('imdb_id is required (e.g. "tt1375666")')
  }
  if (!/^tt\d{7,}$/.test(args.imdb_id)) {
    throw new Error('imdb_id must match format "tt" followed by 7+ digits')
  }
  const data = await omdbFetch<{ Title: string; Year: string; Rated: string; Runtime: string; Genre: string; Director: string; Actors: string; Plot: string; imdbRating: string; imdbID: string; Type: string }>(`i=${args.imdb_id}&plot=full`)
  return {
    title: data.Title,
    year: data.Year,
    rated: data.Rated,
    runtime: data.Runtime,
    genre: data.Genre,
    director: data.Director,
    actors: data.Actors,
    plot: data.Plot,
    imdbRating: data.imdbRating,
    imdbId: data.imdbID,
    type: data.Type,
  }
}, { method: 'get_by_id' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTitle, getById }

console.log('settlegrid-omdb MCP server ready')
console.log('Methods: search_title, get_by_id')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
