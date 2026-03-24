/**
 * settlegrid-tvmaze — TVMaze MCP Server
 *
 * Search TV shows, get episode guides, and scheduling data.
 *
 * Methods:
 *   search_shows(query)           — Search TV shows by name  (1¢)
 *   get_show(id)                  — Get TV show details by ID  (1¢)
 *   get_episodes(show_id)         — Get all episodes for a show  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchShowsInput {
  query: string
}

interface GetShowInput {
  id: number
}

interface GetEpisodesInput {
  show_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.tvmaze.com'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-tvmaze/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TVMaze API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tvmaze',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_shows: { costCents: 1, displayName: 'Search Shows' },
      get_show: { costCents: 1, displayName: 'Get Show' },
      get_episodes: { costCents: 1, displayName: 'Get Episodes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchShows = sg.wrap(async (args: SearchShowsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search/shows?q=${encodeURIComponent(query)}`)
  return {
    score: data.score,
    show: data.show,
  }
}, { method: 'search_shows' })

const getShow = sg.wrap(async (args: GetShowInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/shows/${id}`)
  return {
    id: data.id,
    name: data.name,
    language: data.language,
    genres: data.genres,
    status: data.status,
    rating: data.rating,
    premiered: data.premiered,
  }
}, { method: 'get_show' })

const getEpisodes = sg.wrap(async (args: GetEpisodesInput) => {
  if (typeof args.show_id !== 'number') throw new Error('show_id is required and must be a number')
  const show_id = args.show_id
  const data = await apiFetch<any>(`/shows/${show_id}/episodes`)
  return {
    id: data.id,
    name: data.name,
    season: data.season,
    number: data.number,
    airdate: data.airdate,
  }
}, { method: 'get_episodes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchShows, getShow, getEpisodes }

console.log('settlegrid-tvmaze MCP server ready')
console.log('Methods: search_shows, get_show, get_episodes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
