/**
 * settlegrid-musicbrainz — MusicBrainz MCP Server
 *
 * Methods:
 *   search_artists(query)    — Search artists        (1¢)
 *   search_releases(query)   — Search releases       (1¢)
 *   get_artist(mbid)         — Get artist details    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetArtistInput { mbid: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://musicbrainz.org/ws/2'
const UA = 'settlegrid-musicbrainz/1.0 (contact@settlegrid.ai)'

async function mbFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}fmt=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`MusicBrainz API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'musicbrainz',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artists: { costCents: 1, displayName: 'Search Artists' },
      search_releases: { costCents: 1, displayName: 'Search Releases' },
      get_artist: { costCents: 1, displayName: 'Get Artist Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArtists = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await mbFetch<{ artists: Array<{ id: string; name: string; type: string; country: string; 'life-span': { begin: string; end: string | null } }> }>(`/artist?query=${q}&limit=10`)
  return {
    query: args.query,
    artists: (data.artists || []).map((a) => ({
      mbid: a.id,
      name: a.name,
      type: a.type,
      country: a.country,
      lifeSpan: a['life-span'],
    })),
  }
}, { method: 'search_artists' })

const searchReleases = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(args.query.trim())
  const data = await mbFetch<{ releases: Array<{ id: string; title: string; date: string; country: string; 'artist-credit': Array<{ name: string }> }> }>(`/release?query=${q}&limit=10`)
  return {
    query: args.query,
    releases: (data.releases || []).map((r) => ({
      mbid: r.id,
      title: r.title,
      date: r.date,
      country: r.country,
      artists: r['artist-credit']?.map((a) => a.name),
    })),
  }
}, { method: 'search_releases' })

const getArtist = sg.wrap(async (args: GetArtistInput) => {
  if (!args.mbid || typeof args.mbid !== 'string') throw new Error('mbid is required')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.mbid)) {
    throw new Error('mbid must be a valid UUID')
  }
  const data = await mbFetch<{ id: string; name: string; type: string; country: string; 'life-span': { begin: string; end: string | null; ended: boolean }; 'begin-area': { name: string } }>(`/artist/${args.mbid}?inc=url-rels`)
  return {
    mbid: data.id,
    name: data.name,
    type: data.type,
    country: data.country,
    lifeSpan: data['life-span'],
    beginArea: data['begin-area']?.name,
  }
}, { method: 'get_artist' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArtists, searchReleases, getArtist }

console.log('settlegrid-musicbrainz MCP server ready')
console.log('Methods: search_artists, search_releases, get_artist')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
