/**
 * settlegrid-audiodb — AudioDB MCP Server
 *
 * Wraps TheAudioDB API with SettleGrid billing.
 * No API key needed — free tier.
 *
 * Methods:
 *   search_audio_artist(name) — search artist (1¢)
 *   get_artist_albums(artist_id) — artist albums (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ArtistInput { name: string }
interface AlbumInput { artist_id: string }

const API_BASE = 'https://theaudiodb.com/api/v1/json/2'

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
  toolSlug: 'audiodb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_audio_artist: { costCents: 1, displayName: 'Search Artist' },
      get_artist_albums: { costCents: 1, displayName: 'Artist Albums' },
    },
  },
})

const searchAudioArtist = sg.wrap(async (args: ArtistInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(`/search.php?s=${encodeURIComponent(args.name)}`)
  return {
    artists: (data.artists || []).map((a: any) => ({
      id: a.idArtist, name: a.strArtist, genre: a.strGenre, style: a.strStyle,
      country: a.strCountry, formed_year: a.intFormedYear, mood: a.strMood,
      biography: a.strBiographyEN?.slice(0, 500),
      thumb: a.strArtistThumb, banner: a.strArtistBanner,
      website: a.strWebsite, facebook: a.strFacebook,
    })),
  }
}, { method: 'search_audio_artist' })

const getArtistAlbums = sg.wrap(async (args: AlbumInput) => {
  if (!args.artist_id) throw new Error('artist_id is required')
  const data = await apiFetch<any>(`/album.php?i=${args.artist_id}`)
  return {
    albums: (data.album || []).map((a: any) => ({
      id: a.idAlbum, title: a.strAlbum, year: a.intYearReleased,
      genre: a.strGenre, style: a.strStyle, mood: a.strMood,
      label: a.strLabel, score: a.intScore, thumb: a.strAlbumThumb,
      description: a.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'get_artist_albums' })

export { searchAudioArtist, getArtistAlbums }

console.log('settlegrid-audiodb MCP server ready')
console.log('Methods: search_audio_artist, get_artist_albums')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
