/**
 * settlegrid-podcast-index — Podcast Index MCP Server
 *
 * Search podcasts and episodes via the Podcast Index API.
 *
 * Methods:
 *   search_podcasts(q)            — Search podcasts by keyword  (2¢)
 *   get_podcast(id)               — Get podcast details by feed ID  (2¢)
 *   get_episodes(id)              — Get recent episodes of a podcast  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPodcastsInput {
  q: string
}

interface GetPodcastInput {
  id: number
}

interface GetEpisodesInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.podcastindex.org/api/1.0'
const API_KEY = process.env.PODCAST_INDEX_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-podcast-index/1.0', 'X-Auth-Key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Podcast Index API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'podcast-index',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_podcasts: { costCents: 2, displayName: 'Search Podcasts' },
      get_podcast: { costCents: 2, displayName: 'Get Podcast' },
      get_episodes: { costCents: 2, displayName: 'Get Episodes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPodcasts = sg.wrap(async (args: SearchPodcastsInput) => {
  if (!args.q || typeof args.q !== 'string') throw new Error('q is required')
  const q = args.q.trim()
  const data = await apiFetch<any>(`/search/byterm?q=${encodeURIComponent(q)}`)
  const items = (data.feeds ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        description: item.description,
        author: item.author,
    })),
  }
}, { method: 'search_podcasts' })

const getPodcast = sg.wrap(async (args: GetPodcastInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/podcasts/byfeedid?id=${id}`)
  return {
    feed: data.feed,
  }
}, { method: 'get_podcast' })

const getEpisodes = sg.wrap(async (args: GetEpisodesInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/episodes/byfeedid?id=${id}&max=10`)
  const items = (data.items ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        datePublished: item.datePublished,
        description: item.description,
        enclosureUrl: item.enclosureUrl,
    })),
  }
}, { method: 'get_episodes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPodcasts, getPodcast, getEpisodes }

console.log('settlegrid-podcast-index MCP server ready')
console.log('Methods: search_podcasts, get_podcast, get_episodes')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
