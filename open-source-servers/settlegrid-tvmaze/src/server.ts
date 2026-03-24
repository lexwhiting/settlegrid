/**
 * settlegrid-tvmaze — TVMaze MCP Server
 *
 * Methods:
 *   search_shows(query)              — Search TV shows       (1¢)
 *   get_episodes(show_id)            — Get episode list      (1¢)
 *   get_schedule(country?, date?)    — Get TV schedule       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface EpisodesInput { show_id: number }
interface ScheduleInput { country?: string; date?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.tvmaze.com'

async function tvFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
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
      get_episodes: { costCents: 1, displayName: 'Get Episodes' },
      get_schedule: { costCents: 1, displayName: 'Get Schedule' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchShows = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const data = await tvFetch<Array<{ score: number; show: { id: number; name: string; language: string; genres: string[]; premiered: string; rating: { average: number | null }; summary: string | null } }>>(`/search/shows?q=${q}`)
  return {
    query: args.query,
    count: data.length,
    shows: data.slice(0, 10).map((r) => ({
      id: r.show.id,
      name: r.show.name,
      language: r.show.language,
      genres: r.show.genres,
      premiered: r.show.premiered,
      rating: r.show.rating?.average,
      summary: r.show.summary?.replace(/<[^>]*>/g, '').slice(0, 300),
    })),
  }
}, { method: 'search_shows' })

const getEpisodes = sg.wrap(async (args: EpisodesInput) => {
  if (typeof args.show_id !== 'number' || args.show_id <= 0) {
    throw new Error('show_id must be a positive number')
  }
  const data = await tvFetch<Array<{ id: number; name: string; season: number; number: number; airdate: string; summary: string | null }>>(`/shows/${args.show_id}/episodes`)
  return {
    showId: args.show_id,
    totalEpisodes: data.length,
    episodes: data.slice(0, 50).map((e) => ({
      id: e.id,
      name: e.name,
      season: e.season,
      episode: e.number,
      airdate: e.airdate,
      summary: e.summary?.replace(/<[^>]*>/g, '').slice(0, 200),
    })),
  }
}, { method: 'get_episodes' })

const getSchedule = sg.wrap(async (args: ScheduleInput) => {
  const country = args.country?.toUpperCase().trim() || 'US'
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error('country must be a 2-letter ISO code')
  }
  const dateParam = args.date ? `&date=${args.date}` : ''
  const data = await tvFetch<Array<{ id: number; airdate: string; airtime: string; show: { id: number; name: string }; name: string; season: number; number: number }>>(`/schedule?country=${country}${dateParam}`)
  return {
    country,
    date: args.date || 'today',
    count: data.length,
    schedule: data.slice(0, 25).map((e) => ({
      showName: e.show.name,
      episodeName: e.name,
      season: e.season,
      episode: e.number,
      airdate: e.airdate,
      airtime: e.airtime,
    })),
  }
}, { method: 'get_schedule' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchShows, getEpisodes, getSchedule }

console.log('settlegrid-tvmaze MCP server ready')
console.log('Methods: search_shows, get_episodes, get_schedule')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
