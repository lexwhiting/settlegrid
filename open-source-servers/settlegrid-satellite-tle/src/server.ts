/**
 * settlegrid-satellite-tle — Satellite TLE Tracking MCP Server
 * Wraps TLE API with SettleGrid billing.
 * Methods:
 *   search_satellites(query, limit?) — Search satellites (1¢)
 *   get_satellite(id)                — Get satellite info (1¢)
 *   get_tle(id)                      — Get TLE data (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface SatelliteInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://tle.ivanstanojevic.me/api/tle'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path ? '/' + path : ''}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-satellite-tle/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TLE API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'satellite-tle',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_satellites: { costCents: 1, displayName: 'Search satellites' },
      get_satellite: { costCents: 1, displayName: 'Get satellite info' },
      get_tle: { costCents: 2, displayName: 'Get TLE data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSatellites = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('', {
    search: args.query,
    page_size: String(limit),
  })
}, { method: 'search_satellites' })

const getSatellite = sg.wrap(async (args: SatelliteInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (NORAD catalog ID)')
  }
  return apiFetch<unknown>(args.id)
}, { method: 'get_satellite' })

const getTle = sg.wrap(async (args: SatelliteInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  const data = await apiFetch<{ line1?: string; line2?: string; name?: string }>(args.id)
  return {
    name: data.name,
    noradId: args.id,
    line1: data.line1,
    line2: data.line2,
  }
}, { method: 'get_tle' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSatellites, getSatellite, getTle }

console.log('settlegrid-satellite-tle MCP server ready')
console.log('Methods: search_satellites, get_satellite, get_tle')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
