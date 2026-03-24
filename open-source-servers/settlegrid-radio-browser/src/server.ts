/**
 * settlegrid-radio-browser — Internet Radio Browser MCP Server
 * Wraps the Radio Browser API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RadioStation {
  changeuuid: string
  stationuuid: string
  name: string
  url: string
  url_resolved: string
  homepage: string
  favicon: string
  tags: string
  country: string
  countrycode: string
  state: string
  language: string
  languagecodes: string
  votes: number
  lastchangetime: string
  codec: string
  bitrate: number
  hls: number
  lastcheckok: number
  clickcount: number
  clicktrend: number
  geo_lat: number | null
  geo_long: number | null
}

interface CountryInfo {
  name: string
  iso_3166_1: string
  stationcount: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://de1.api.radio-browser.info/json'

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'settlegrid-radio-browser/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Radio Browser API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateLimit(limit?: number, max = 100): number {
  if (limit === undefined) return 20
  if (limit < 1 || limit > max) throw new Error(`Limit must be between 1 and ${max}`)
  return Math.floor(limit)
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed) throw new Error('Search query is required')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'radio-browser' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function search_stations(query: string, limit?: number): Promise<RadioStation[]> {
  const q = validateQuery(query)
  const lim = validateLimit(limit)
  return sg.wrap('search_stations', async () => {
    const params = new URLSearchParams({
      name: q, limit: String(lim), order: 'votes', reverse: 'true', hidebroken: 'true',
    })
    return fetchJSON<RadioStation[]>(`${API}/stations/search?${params}`)
  })
}

export async function get_top(limit?: number, country?: string): Promise<RadioStation[]> {
  const lim = validateLimit(limit)
  return sg.wrap('get_top', async () => {
    const params = new URLSearchParams({ limit: String(lim), hidebroken: 'true' })
    if (country) params.set('country', country.trim())
    return fetchJSON<RadioStation[]>(`${API}/stations/topvote?${params}`)
  })
}

export async function list_countries(): Promise<CountryInfo[]> {
  return sg.wrap('list_countries', async () => {
    const params = new URLSearchParams({ order: 'stationcount', reverse: 'true' })
    return fetchJSON<CountryInfo[]>(`${API}/countries?${params}`)
  })
}

console.log('settlegrid-radio-browser MCP server loaded')
