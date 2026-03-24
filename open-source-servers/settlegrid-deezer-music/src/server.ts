/**
 * settlegrid-deezer-music — Deezer Music MCP Server
 *
 * Wraps Deezer public API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   search_tracks(query, limit?) — search tracks (1¢)
 *   get_chart() — music charts (1¢)
 *   get_artist_info(artist_id) — artist info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface ArtistInput { artist_id: number }

const API_BASE = 'https://api.deezer.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'deezer-music',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_tracks: { costCents: 1, displayName: 'Search Tracks' },
      get_chart: { costCents: 1, displayName: 'Music Charts' },
      get_artist_info: { costCents: 1, displayName: 'Artist Info' },
    },
  },
})

const searchTracks = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(args.query)}&limit=${limit}`)
  return {
    total: data.total,
    tracks: (data.data || []).map((t: any) => ({
      id: t.id, title: t.title, duration_sec: t.duration,
      artist: t.artist?.name, album: t.album?.title,
      preview: t.preview, link: t.link, explicit: t.explicit_lyrics,
    })),
  }
}, { method: 'search_tracks' })

const getChart = sg.wrap(async () => {
  const data = await apiFetch<any>('/chart')
  return {
    tracks: (data.tracks?.data || []).slice(0, 20).map((t: any) => ({
      position: t.position, title: t.title, artist: t.artist?.name,
      duration_sec: t.duration, link: t.link,
    })),
    artists: (data.artists?.data || []).slice(0, 10).map((a: any) => ({
      name: a.name, id: a.id, link: a.link,
    })),
    albums: (data.albums?.data || []).slice(0, 10).map((a: any) => ({
      title: a.title, artist: a.artist?.name, id: a.id, link: a.link,
    })),
  }
}, { method: 'get_chart' })

const getArtistInfo = sg.wrap(async (args: ArtistInput) => {
  if (!args.artist_id) throw new Error('artist_id is required')
  const data = await apiFetch<any>(`/artist/${args.artist_id}`)
  return {
    id: data.id, name: data.name, nb_album: data.nb_album,
    nb_fan: data.nb_fan, link: data.link, picture: data.picture_medium,
    tracklist: data.tracklist,
  }
}, { method: 'get_artist_info' })

export { searchTracks, getChart, getArtistInfo }

console.log('settlegrid-deezer-music MCP server ready')
console.log('Methods: search_tracks, get_chart, get_artist_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
