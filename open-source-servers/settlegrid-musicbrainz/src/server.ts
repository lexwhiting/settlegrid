/**
 * settlegrid-musicbrainz — MusicBrainz MCP Server
 *
 * Wraps MusicBrainz API with SettleGrid billing.
 * No API key needed — rate limited to 1 req/sec.
 *
 * Methods:
 *   search_artist(query, limit?) — search artists (1¢)
 *   search_release(query, limit?) — search releases (1¢)
 *   get_artist_releases(artist_id) — artist releases (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface ArtistReleasesInput { artist_id: string }

const API_BASE = 'https://musicbrainz.org/ws/2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}fmt=json`, {
    headers: { 'User-Agent': 'SettleGrid-MCP/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'musicbrainz',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artist: { costCents: 1, displayName: 'Search Artist' },
      search_release: { costCents: 1, displayName: 'Search Release' },
      get_artist_releases: { costCents: 1, displayName: 'Artist Releases' },
    },
  },
})

const searchArtist = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(`/artist?query=${encodeURIComponent(args.query)}&limit=${limit}`)
  return {
    count: data.count,
    artists: (data.artists || []).map((a: any) => ({
      id: a.id, name: a.name, sort_name: a['sort-name'],
      type: a.type, country: a.country, score: a.score,
      begin: a['life-span']?.begin, end: a['life-span']?.end,
      tags: a.tags?.slice(0, 5).map((t: any) => t.name),
    })),
  }
}, { method: 'search_artist' })

const searchRelease = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(`/release?query=${encodeURIComponent(args.query)}&limit=${limit}`)
  return {
    count: data.count,
    releases: (data.releases || []).map((r: any) => ({
      id: r.id, title: r.title, status: r.status, date: r.date,
      country: r.country, artist: r['artist-credit']?.[0]?.name, score: r.score,
      track_count: r['track-count'],
    })),
  }
}, { method: 'search_release' })

const getArtistReleases = sg.wrap(async (args: ArtistReleasesInput) => {
  if (!args.artist_id) throw new Error('artist_id is required')
  const data = await apiFetch<any>(`/release?artist=${args.artist_id}&limit=50`)
  return {
    count: data['release-count'],
    releases: (data.releases || []).map((r: any) => ({
      id: r.id, title: r.title, date: r.date, status: r.status, country: r.country,
    })),
  }
}, { method: 'get_artist_releases' })

export { searchArtist, searchRelease, getArtistReleases }

console.log('settlegrid-musicbrainz MCP server ready')
console.log('Methods: search_artist, search_release, get_artist_releases')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
