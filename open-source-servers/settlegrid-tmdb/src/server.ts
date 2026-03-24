/**
 * settlegrid-tmdb — TMDB (The Movie Database) MCP Server
 *
 * Search movies, TV shows, and people via The Movie Database API.
 *
 * Methods:
 *   search_movies(query)          — Search movies by title  (2¢)
 *   get_movie(id)                 — Get movie details by ID  (2¢)
 *   search_tv(query)              — Search TV shows by name  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchMoviesInput {
  query: string
}

interface GetMovieInput {
  id: number
}

interface SearchTvInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.themoviedb.org/3'
const API_KEY = process.env.TMDB_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-tmdb/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TMDB (The Movie Database) API ${res.status}: ${body.slice(0, 200)}`)
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
      get_movie: { costCents: 2, displayName: 'Get Movie' },
      search_tv: { costCents: 2, displayName: 'Search TV Shows' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMovies = sg.wrap(async (args: SearchMoviesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search/movie?query=${encodeURIComponent(query)}&api_key=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        release_date: item.release_date,
        overview: item.overview,
        vote_average: item.vote_average,
    })),
  }
}, { method: 'search_movies' })

const getMovie = sg.wrap(async (args: GetMovieInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/movie/${id}?api_key=${API_KEY}`)
  return {
    id: data.id,
    title: data.title,
    release_date: data.release_date,
    overview: data.overview,
    vote_average: data.vote_average,
    runtime: data.runtime,
    genres: data.genres,
  }
}, { method: 'get_movie' })

const searchTv = sg.wrap(async (args: SearchTvInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search/tv?query=${encodeURIComponent(query)}&api_key=${API_KEY}`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        first_air_date: item.first_air_date,
        overview: item.overview,
        vote_average: item.vote_average,
    })),
  }
}, { method: 'search_tv' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMovies, getMovie, searchTv }

console.log('settlegrid-tmdb MCP server ready')
console.log('Methods: search_movies, get_movie, search_tv')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
