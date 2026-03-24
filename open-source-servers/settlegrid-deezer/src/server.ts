/**
 * settlegrid-deezer — Deezer Music Data MCP Server
 *
 * Search artists, albums, and tracks on Deezer. No API key needed.
 *
 * Methods:
 *   search_tracks(query, limit?) — Search tracks (1¢)
 *   get_artist(id) — Get artist info (1¢)
 *   get_album(id) — Get album info (1¢)
 *   get_chart() — Get current chart (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface IdInput { id: number }

const API = 'https://api.deezer.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'deezer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_tracks: { costCents: 1, displayName: 'Search Tracks' },
      get_artist: { costCents: 1, displayName: 'Get Artist' },
      get_album: { costCents: 1, displayName: 'Get Album' },
      get_chart: { costCents: 1, displayName: 'Get Chart' },
    },
  },
})

const searchTracks = sg.wrap(async (args: SearchInput) => {
  const q = args.query?.trim()
  if (!q) throw new Error('query required')
  const limit = Math.min(args.limit || 25, 50)
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  const tracks = (data.data || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    artist: t.artist?.name,
    album: t.album?.title,
    duration: t.duration,
    preview: t.preview,
    explicit: t.explicit_lyrics,
  }))
  return { query: q, total: data.total, count: tracks.length, tracks }
}, { method: 'search_tracks' })

const getArtist = sg.wrap(async (args: IdInput) => {
  if (!args.id) throw new Error('artist id required')
  const data = await apiFetch<any>(`/artist/${args.id}`)
  return {
    id: data.id, name: data.name, fans: data.nb_fan,
    albums: data.nb_album, picture: data.picture_big,
    link: data.link,
  }
}, { method: 'get_artist' })

const getAlbum = sg.wrap(async (args: IdInput) => {
  if (!args.id) throw new Error('album id required')
  const data = await apiFetch<any>(`/album/${args.id}`)
  const tracks = (data.tracks?.data || []).map((t: any) => ({
    id: t.id, title: t.title, duration: t.duration, trackNumber: t.track_position,
  }))
  return {
    id: data.id, title: data.title, artist: data.artist?.name,
    releaseDate: data.release_date, tracks, trackCount: tracks.length,
    genres: data.genres?.data?.map((g: any) => g.name) || [],
    duration: data.duration, fans: data.fans, cover: data.cover_big,
  }
}, { method: 'get_album' })

const getChart = sg.wrap(async () => {
  const data = await apiFetch<any>('/chart')
  return {
    tracks: (data.tracks?.data || []).slice(0, 20).map((t: any) => ({
      position: t.position, title: t.title, artist: t.artist?.name, duration: t.duration,
    })),
    artists: (data.artists?.data || []).slice(0, 10).map((a: any) => ({
      position: a.position, name: a.name, fans: a.nb_fan,
    })),
    albums: (data.albums?.data || []).slice(0, 10).map((a: any) => ({
      position: a.position, title: a.title, artist: a.artist?.name,
    })),
  }
}, { method: 'get_chart' })

export { searchTracks, getArtist, getAlbum, getChart }

console.log('settlegrid-deezer MCP server ready')
console.log('Methods: search_tracks, get_artist, get_album, get_chart')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
