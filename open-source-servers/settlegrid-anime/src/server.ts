/**
 * settlegrid-anime — Anime & Manga (Jikan) MCP Server
 *
 * Methods:
 *   search_anime(query)   — Search anime      (1¢)
 *   search_manga(query)   — Search manga      (1¢)
 *   get_top_anime(type?)  — Top-rated anime   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface TopInput { type?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.jikan.moe/v4'

async function jikanFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Jikan API ${res.status}: ${body.slice(0, 200)}`)
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
      get_top_anime: { costCents: 1, displayName: 'Top Anime' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchAnime = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await jikanFetch<{ data: Array<{ mal_id: number; title: string; title_english: string; episodes: number; score: number; year: number; genres: Array<{ name: string }>; synopsis: string }> }>(`/anime?q=${q}&limit=10`)
  return {
    query: args.query,
    count: data.data.length,
    anime: data.data.map((a) => ({
      malId: a.mal_id,
      title: a.title,
      titleEnglish: a.title_english,
      episodes: a.episodes,
      score: a.score,
      year: a.year,
      genres: a.genres?.map((g) => g.name),
      synopsis: a.synopsis?.slice(0, 300),
    })),
  }
}, { method: 'search_anime' })

const searchManga = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await jikanFetch<{ data: Array<{ mal_id: number; title: string; title_english: string; chapters: number; volumes: number; score: number; genres: Array<{ name: string }>; synopsis: string }> }>(`/manga?q=${q}&limit=10`)
  return {
    query: args.query,
    count: data.data.length,
    manga: data.data.map((m) => ({
      malId: m.mal_id,
      title: m.title,
      titleEnglish: m.title_english,
      chapters: m.chapters,
      volumes: m.volumes,
      score: m.score,
      genres: m.genres?.map((g) => g.name),
      synopsis: m.synopsis?.slice(0, 300),
    })),
  }
}, { method: 'search_manga' })

const getTopAnime = sg.wrap(async (args: TopInput) => {
  const validTypes = ['tv', 'movie', 'ova', 'special']
  const typeParam = args.type && validTypes.includes(args.type) ? `?type=${args.type}` : ''
  const data = await jikanFetch<{ data: Array<{ mal_id: number; title: string; score: number; episodes: number; year: number; rank: number }> }>(`/top/anime${typeParam}`)
  return {
    type: args.type || 'all',
    anime: data.data.slice(0, 25).map((a) => ({
      rank: a.rank,
      malId: a.mal_id,
      title: a.title,
      score: a.score,
      episodes: a.episodes,
      year: a.year,
    })),
  }
}, { method: 'get_top_anime' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchAnime, searchManga, getTopAnime }

console.log('settlegrid-anime MCP server ready')
console.log('Methods: search_anime, search_manga, get_top_anime')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
