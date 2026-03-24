/**
 * settlegrid-gtfs — TransitFeeds GTFS MCP Server
 *
 * GTFS transit feed listings and metadata from TransitFeeds.
 *
 * Methods:
 *   get_feeds(location)           — Get a list of GTFS feeds  (2¢)
 *   get_locations()               — Get transit feed locations  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFeedsInput {
  location?: string
}

interface GetLocationsInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.transitfeeds.com/v1'
const API_KEY = process.env.TRANSITFEEDS_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-gtfs/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TransitFeeds GTFS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gtfs',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_feeds: { costCents: 2, displayName: 'List Feeds' },
      get_locations: { costCents: 2, displayName: 'List Locations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFeeds = sg.wrap(async (args: GetFeedsInput) => {
  const location = typeof args.location === 'string' ? args.location.trim() : ''
  const data = await apiFetch<any>(`/getFeeds?page=1&limit=10&descendants=1&type=gtfs&location=${encodeURIComponent(location)}&key=${API_KEY}`)
  const items = (data.results.feeds ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        ty: item.ty,
        l: item.l,
        u: item.u,
    })),
  }
}, { method: 'get_feeds' })

const getLocations = sg.wrap(async (args: GetLocationsInput) => {

  const data = await apiFetch<any>(`/getLocations?key=${API_KEY}`)
  const items = (data.results.locations ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        pid: item.pid,
        n: item.n,
        t: item.t,
        lat: item.lat,
        lng: item.lng,
    })),
  }
}, { method: 'get_locations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFeeds, getLocations }

console.log('settlegrid-gtfs MCP server ready')
console.log('Methods: get_feeds, get_locations')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
