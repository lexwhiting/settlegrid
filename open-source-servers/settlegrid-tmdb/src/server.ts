/**
 * settlegrid-tmdb — The Movie Database MCP Server
 *
 * Wraps the TMDB API with SettleGrid billing.
 * Requires a free TMDB API key.
 *
 * Methods:
 *   search_movies(query, year?)       — Search movies by title      (2¢)
 *   search_tv(query)                  — Search TV shows by name     (2¢)
 *   get_trending(media_type, window?) — Get trending content        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchMoviesInput {
  query: string
  year?: number
}

interface SearchTvInput {
  query: string
}

interface TrendingInput {
  media_type: string
  time_window?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.themoviedb.org/3'
const API_KEY = process.env.TMDB_API_KEY || ''

async function tmdbFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('TMDB_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}api_key=${API_KEY}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TMDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tmdb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_movies: { costCents: 2, displayName: 'Search Movies' },
      search_tv: { costCents: 2, displayName: 'Search TV Shows' },
      get_trending: { costCents: 2, displayName: 'Get Trending' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMovies = sg.wrap(async (args: SearchMoviesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const yearParam = args.year ? `&year=${args.year}` : ''
  const data = await tmdbFetch<{ results: Array<{ id: number; title: string; release_date: string; overview: string; vote_average: number; poster_path: string | null }> }>(`/search/movie?query=${q}${yearParam}`)
  return {
    query: args.query,
    count: data.results.length,
    movies: data.results.slice(0, 10).map((m) => ({
      id: m.id,
      title: m.title,
      releaseDate: m.release_date,
      overview: m.overview?.slice(0, 300),
      rating: m.vote_average,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    })),
  }
}, { method: 'search_movies' })

const searchTv = sg.wrap(async (args: SearchTvInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const data = await tmdbFetch<{ results: Array<{ id: number; name: string; first_air_date: string; overview: string; vote_average: number }> }>(`/search/tv?query=${q}`)
  return {
    query: args.query,
    count: data.results.length,
    shows: data.results.slice(0, 10).map((s) => ({
      id: s.id,
      name: s.name,
      firstAirDate: s.first_air_date,
      overview: s.overview?.slice(0, 300),
      rating: s.vote_average,
    })),
  }
}, { method: 'search_tv' })

const getTrending = sg.wrap(async (args: TrendingInput) => {
  const validTypes = ['movie', 'tv']
  if (!args.media_type || !validTypes.includes(args.media_type)) {
    throw new Error('media_type must be "movie" or "tv"')
  }
  const window = args.time_window === 'day' ? 'day' : 'week'
  const data = await tmdbFetch<{ results: Array<{ id: number; title?: string; name?: string; overview: string; vote_average: number; media_type: string }> }>(`/trending/${args.media_type}/${window}`)
  return {
    mediaType: args.media_type,
    timeWindow: window,
    results: data.results.slice(0, 10).map((r) => ({
      id: r.id,
      title: r.title || r.name,
      overview: r.overview?.slice(0, 300),
      rating: r.vote_average,
    })),
  }
}, { method: 'get_trending' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMovies, searchTv, getTrending }

console.log('settlegrid-tmdb MCP server ready')
console.log('Methods: search_movies, search_tv, get_trending')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
