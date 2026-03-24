/**
 * settlegrid-lyrics — Song Lyrics Search MCP Server
 *
 * Search and retrieve song lyrics. Uses lyrics.ovh free API.
 *
 * Methods:
 *   get_lyrics(artist, title) — Get lyrics for a song (1¢)
 *   search_lyrics(query) — Search for songs (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface LyricsInput { artist: string; title: string }
interface SearchInput { query: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-lyrics/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'lyrics',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_lyrics: { costCents: 1, displayName: 'Get Lyrics' },
      search_lyrics: { costCents: 1, displayName: 'Search Lyrics' },
    },
  },
})

const getLyrics = sg.wrap(async (args: LyricsInput) => {
  const artist = args.artist?.trim()
  const title = args.title?.trim()
  if (!artist || !title) throw new Error('artist and title required')
  const data = await apiFetch<any>(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
  )
  const lyrics = (data.lyrics || '').trim()
  const lines = lyrics.split('\n').filter((l: string) => l.trim())
  return {
    artist,
    title,
    lyrics: lyrics.slice(0, 5000),
    lineCount: lines.length,
    wordCount: lyrics.split(/\s+/).filter(Boolean).length,
  }
}, { method: 'get_lyrics' })

const searchLyrics = sg.wrap(async (args: SearchInput) => {
  const q = args.query?.trim()
  if (!q) throw new Error('query required')
  const data = await apiFetch<any>(
    `https://api.lyrics.ovh/suggest/${encodeURIComponent(q)}`
  )
  const results = (data.data || []).slice(0, 15).map((r: any) => ({
    artist: r.artist?.name,
    title: r.title,
    album: r.album?.title,
    duration: r.duration,
    preview: r.preview,
  }))
  return { query: q, count: results.length, results }
}, { method: 'search_lyrics' })

export { getLyrics, searchLyrics }

console.log('settlegrid-lyrics MCP server ready')
console.log('Methods: get_lyrics, search_lyrics')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
