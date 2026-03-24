/**
 * settlegrid-listennotes — Listen Notes MCP Server
 *
 * Search podcasts and episodes via the Listen Notes API.
 *
 * Methods:
 *   search_podcasts(q)            — Search podcasts by keyword  (2¢)
 *   search_episodes(q)            — Search episodes by keyword  (2¢)
 *   get_podcast(id)               — Get podcast details by ID  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPodcastsInput {
  q: string
}

interface SearchEpisodesInput {
  q: string
}

interface GetPodcastInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://listen-api.listennotes.com/api/v2'
const API_KEY = process.env.LISTENNOTES_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-listennotes/1.0', 'X-ListenAPI-Key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Listen Notes API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'listennotes',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_podcasts: { costCents: 2, displayName: 'Search Podcasts' },
      search_episodes: { costCents: 2, displayName: 'Search Episodes' },
      get_podcast: { costCents: 2, displayName: 'Get Podcast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPodcasts = sg.wrap(async (args: SearchPodcastsInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(q)}&type=podcast`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title_original: item.title_original,
        publisher_original: item.publisher_original,
        description_original: item.description_original,
        listennotes_url: item.listennotes_url,
    })),
  }
}, { method: 'search_podcasts' })

const searchEpisodes = sg.wrap(async (args: SearchEpisodesInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(q)}&type=episode`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title_original: item.title_original,
        podcast_title_original: item.podcast_title_original,
        description_original: item.description_original,
        listennotes_url: item.listennotes_url,
    })),
  }
}, { method: 'search_episodes' })

const getPodcast = sg.wrap(async (args: GetPodcastInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/podcasts/${encodeURIComponent(id)}`)
  return {
    id: data.id,
    title: data.title,
    publisher: data.publisher,
    description: data.description,
    listennotes_url: data.listennotes_url,
    total_episodes: data.total_episodes,
  }
}, { method: 'get_podcast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPodcasts, searchEpisodes, getPodcast }

console.log('settlegrid-listennotes MCP server ready')
console.log('Methods: search_podcasts, search_episodes, get_podcast')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
