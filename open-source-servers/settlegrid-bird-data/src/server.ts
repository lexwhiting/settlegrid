/**
 * settlegrid-bird-data — eBird Observation Data MCP Server
 * Wraps eBird API 2.0 with SettleGrid billing.
 * Methods:
 *   get_recent(lat, lon, limit?)    — Get recent sightings (1¢)
 *   get_hotspots(regionCode)        — Get hotspots (1¢)
 *   get_species_list(regionCode)    — Get species list (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecentInput {
  lat: number
  lon: number
  limit?: number
}

interface RegionInput {
  regionCode: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.ebird.org/v2'
const API_KEY = process.env.EBIRD_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('EBIRD_API_KEY environment variable is required')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-eBirdApiToken': API_KEY, Accept: 'application/json', 'User-Agent': 'settlegrid-bird-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`eBird API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bird-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_recent: { costCents: 1, displayName: 'Get recent bird observations' },
      get_hotspots: { costCents: 1, displayName: 'Get birding hotspots' },
      get_species_list: { costCents: 2, displayName: 'Get species list' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRecent = sg.wrap(async (args: RecentInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric)')
  }
  const limit = Math.min(args.limit || 20, 100)
  return apiFetch<unknown>(`/data/obs/geo/recent?lat=${args.lat}&lng=${args.lon}&maxResults=${limit}`)
}, { method: 'get_recent' })

const getHotspots = sg.wrap(async (args: RegionInput) => {
  if (!args.regionCode || typeof args.regionCode !== 'string') {
    throw new Error('regionCode is required (e.g. US-MA)')
  }
  return apiFetch<unknown>(`/ref/hotspot/${encodeURIComponent(args.regionCode)}`)
}, { method: 'get_hotspots' })

const getSpeciesList = sg.wrap(async (args: RegionInput) => {
  if (!args.regionCode || typeof args.regionCode !== 'string') {
    throw new Error('regionCode is required')
  }
  return apiFetch<unknown>(`/product/spplist/${encodeURIComponent(args.regionCode)}`)
}, { method: 'get_species_list' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRecent, getHotspots, getSpeciesList }

console.log('settlegrid-bird-data MCP server ready')
console.log('Methods: get_recent, get_hotspots, get_species_list')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
