/**
 * settlegrid-lastfm — Last.fm Music MCP Server
 *
 * Wraps Last.fm API with SettleGrid billing.
 * Free key from https://www.last.fm/api/account/create.
 *
 * Methods:
 *   get_top_artists(limit?) — top artists (2¢)
 *   get_artist_info_lastfm(artist) — artist info (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TopInput { limit?: number }
interface ArtistInput { artist: string }

const API_BASE = 'https://ws.audioscrobbler.com/2.0'
const API_KEY = process.env.LASTFM_API_KEY || ''

async function apiFetch<T>(params: string): Promise<T> {
  const url = `${API_BASE}?${params}&api_key=${API_KEY}&format=json`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'lastfm',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_top_artists: { costCents: 2, displayName: 'Top Artists' },
      get_artist_info_lastfm: { costCents: 2, displayName: 'Artist Info' },
    },
  },
})

const getTopArtists = sg.wrap(async (args: TopInput) => {
  if (!API_KEY) throw new Error('LASTFM_API_KEY not set')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(`method=chart.gettopartists&limit=${limit}`)
  return {
    artists: (data.artists?.artist || []).map((a: any) => ({
      name: a.name, playcount: a.playcount, listeners: a.listeners,
      url: a.url, mbid: a.mbid,
    })),
  }
}, { method: 'get_top_artists' })

const getArtistInfoLastfm = sg.wrap(async (args: ArtistInput) => {
  if (!API_KEY) throw new Error('LASTFM_API_KEY not set')
  if (!args.artist) throw new Error('artist name is required')
  const data = await apiFetch<any>(`method=artist.getinfo&artist=${encodeURIComponent(args.artist)}`)
  const a = data.artist
  return {
    name: a?.name, url: a?.url, listeners: a?.stats?.listeners,
    playcount: a?.stats?.playcount,
    bio: a?.bio?.summary?.replace(/<[^>]*>/g, '').slice(0, 500),
    tags: a?.tags?.tag?.map((t: any) => t.name),
    similar: a?.similar?.artist?.map((s: any) => s.name),
  }
}, { method: 'get_artist_info_lastfm' })

export { getTopArtists, getArtistInfoLastfm }

console.log('settlegrid-lastfm MCP server ready')
console.log('Methods: get_top_artists, get_artist_info_lastfm')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
