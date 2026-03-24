/**
 * settlegrid-omdb — OMDb (Open Movie Database) MCP Server
 *
 * Search and retrieve movie data from the Open Movie Database.
 *
 * Methods:
 *   search_movies(query)          — Search movies by title  (2¢)
 *   get_movie(query)              — Get movie details by IMDb ID or title  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchMoviesInput {
  query: string
}

interface GetMovieInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.omdbapi.com'
const API_KEY = process.env.OMDB_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-omdb/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OMDb (Open Movie Database) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'omdb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_movies: { costCents: 2, displayName: 'Search Movies' },
      get_movie: { costCents: 2, displayName: 'Get Movie' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMovies = sg.wrap(async (args: SearchMoviesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/?s=${encodeURIComponent(query)}&apikey=${API_KEY}`)
  const items = (data.Search ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Title: item.Title,
        Year: item.Year,
        imdbID: item.imdbID,
        Type: item.Type,
        Poster: item.Poster,
    })),
  }
}, { method: 'search_movies' })

const getMovie = sg.wrap(async (args: GetMovieInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/?t=${encodeURIComponent(query)}&plot=short&apikey=${API_KEY}`)
  return {
    Title: data.Title,
    Year: data.Year,
    Rated: data.Rated,
    Runtime: data.Runtime,
    Genre: data.Genre,
    Director: data.Director,
    Plot: data.Plot,
    imdbRating: data.imdbRating,
  }
}, { method: 'get_movie' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMovies, getMovie }

console.log('settlegrid-omdb MCP server ready')
console.log('Methods: search_movies, get_movie')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
