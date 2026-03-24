/**
 * settlegrid-anime — Jikan (Anime/Manga) MCP Server
 *
 * Search anime and manga data via the Jikan MyAnimeList API.
 *
 * Methods:
 *   search_anime(query)           — Search anime by title  (1¢)
 *   search_manga(query)           — Search manga by title  (1¢)
 *   get_anime(id)                 — Get anime details by MyAnimeList ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchAnimeInput {
  query: string
}

interface SearchMangaInput {
  query: string
}

interface GetAnimeInput {
  id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.jikan.moe/v4'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-anime/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Jikan (Anime/Manga) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'anime',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_anime: { costCents: 1, displayName: 'Search Anime' },
      search_manga: { costCents: 1, displayName: 'Search Manga' },
      get_anime: { costCents: 1, displayName: 'Get Anime' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchAnime = sg.wrap(async (args: SearchAnimeInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/anime?q=${encodeURIComponent(query)}&limit=10`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        mal_id: item.mal_id,
        title: item.title,
        score: item.score,
        episodes: item.episodes,
        status: item.status,
        synopsis: item.synopsis,
    })),
  }
}, { method: 'search_anime' })

const searchManga = sg.wrap(async (args: SearchMangaInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/manga?q=${encodeURIComponent(query)}&limit=10`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        mal_id: item.mal_id,
        title: item.title,
        score: item.score,
        chapters: item.chapters,
        status: item.status,
        synopsis: item.synopsis,
    })),
  }
}, { method: 'search_manga' })

const getAnime = sg.wrap(async (args: GetAnimeInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/anime/${id}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        mal_id: item.mal_id,
        title: item.title,
        score: item.score,
        episodes: item.episodes,
        status: item.status,
        synopsis: item.synopsis,
        genres: item.genres,
    })),
  }
}, { method: 'get_anime' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchAnime, searchManga, getAnime }

console.log('settlegrid-anime MCP server ready')
console.log('Methods: search_anime, search_manga, get_anime')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
