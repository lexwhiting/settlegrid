/**
 * settlegrid-spotify-metadata — Spotify Metadata MCP Server
 *
 * Search tracks, albums, and artists via the Spotify Web API.
 *
 * Methods:
 *   search_tracks(query)          — Search for tracks by name  (2¢)
 *   search_artists(query)         — Search for artists by name  (2¢)
 *   get_track(id)                 — Get track details by Spotify ID  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTracksInput {
  query: string
}

interface SearchArtistsInput {
  query: string
}

interface GetTrackInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.spotify.com/v1'
const API_KEY = process.env.SPOTIFY_ACCESS_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-spotify-metadata/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Spotify Metadata API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spotify-metadata',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_tracks: { costCents: 2, displayName: 'Search Tracks' },
      search_artists: { costCents: 2, displayName: 'Search Artists' },
      get_track: { costCents: 2, displayName: 'Get Track' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTracks = sg.wrap(async (args: SearchTracksInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`)
  const items = (data.tracks.items ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        artists: item.artists,
        album: item.album,
        duration_ms: item.duration_ms,
    })),
  }
}, { method: 'search_tracks' })

const searchArtists = sg.wrap(async (args: SearchArtistsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/search?q=${encodeURIComponent(query)}&type=artist&limit=10`)
  const items = (data.artists.items ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        genres: item.genres,
        popularity: item.popularity,
        followers: item.followers,
    })),
  }
}, { method: 'search_artists' })

const getTrack = sg.wrap(async (args: GetTrackInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  const data = await apiFetch<any>(`/tracks/${encodeURIComponent(id)}`)
  return {
    id: data.id,
    name: data.name,
    artists: data.artists,
    album: data.album,
    duration_ms: data.duration_ms,
    popularity: data.popularity,
  }
}, { method: 'get_track' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTracks, searchArtists, getTrack }

console.log('settlegrid-spotify-metadata MCP server ready')
console.log('Methods: search_tracks, search_artists, get_track')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
