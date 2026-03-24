/**
 * settlegrid-spotify-metadata — Spotify Web API MCP Server
 *
 * Methods:
 *   search_tracks(query, limit?)        — Search tracks         (2¢)
 *   search_artists(query)               — Search artists        (2¢)
 *   get_artist_top_tracks(artist_id)    — Artist top tracks     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTracksInput { query: string; limit?: number }
interface SearchArtistsInput { query: string }
interface TopTracksInput { artist_id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.spotify.com/v1'
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''

let cachedToken: { token: string; expires: number } | null = null

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return cachedToken.token
}

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Spotify API ${res.status}: ${body.slice(0, 200)}`)
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
      get_artist_top_tracks: { costCents: 2, displayName: 'Artist Top Tracks' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTracks = sg.wrap(async (args: SearchTracksInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const limit = Math.min(Math.max(args.limit || 10, 1), 10)
  const q = encodeURIComponent(args.query.trim())
  const data = await spotifyFetch<{ tracks: { items: Array<{ id: string; name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string }; duration_ms: number; preview_url: string | null }> } }>(`/search?q=${q}&type=track&limit=${limit}`)
  return {
    query: args.query,
    tracks: data.tracks.items.map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => a.name),
      album: t.album.name,
      releaseDate: t.album.release_date,
      durationMs: t.duration_ms,
      previewUrl: t.preview_url,
    })),
  }
}, { method: 'search_tracks' })

const searchArtists = sg.wrap(async (args: SearchArtistsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await spotifyFetch<{ artists: { items: Array<{ id: string; name: string; genres: string[]; popularity: number; followers: { total: number } }> } }>(`/search?q=${q}&type=artist&limit=10`)
  return {
    query: args.query,
    artists: data.artists.items.map((a) => ({
      id: a.id,
      name: a.name,
      genres: a.genres,
      popularity: a.popularity,
      followers: a.followers.total,
    })),
  }
}, { method: 'search_artists' })

const getArtistTopTracks = sg.wrap(async (args: TopTracksInput) => {
  if (!args.artist_id || typeof args.artist_id !== 'string') throw new Error('artist_id is required')
  const data = await spotifyFetch<{ tracks: Array<{ id: string; name: string; album: { name: string }; duration_ms: number; popularity: number }> }>(`/artists/${encodeURIComponent(args.artist_id)}/top-tracks?market=US`)
  return {
    artistId: args.artist_id,
    tracks: data.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      album: t.album.name,
      durationMs: t.duration_ms,
      popularity: t.popularity,
    })),
  }
}, { method: 'get_artist_top_tracks' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTracks, searchArtists, getArtistTopTracks }

console.log('settlegrid-spotify-metadata MCP server ready')
console.log('Methods: search_tracks, search_artists, get_artist_top_tracks')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
