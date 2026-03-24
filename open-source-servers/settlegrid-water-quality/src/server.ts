/**
 * settlegrid-water-quality — Water Quality Data MCP Server
 *
 * US water quality monitoring data from the Water Quality Portal (USGS/EPA).
 *
 * Methods:
 *   search_stations(statecode)    — Search water monitoring stations by state  (1¢)
 *   get_results(siteid)           — Get water quality results by site ID  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchStationsInput {
  statecode: string
}

interface GetResultsInput {
  siteid: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.waterqualitydata.us/data'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-water-quality/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Water Quality Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'water-quality',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_stations: { costCents: 1, displayName: 'Search Stations' },
      get_results: { costCents: 1, displayName: 'Get Results' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchStations = sg.wrap(async (args: SearchStationsInput) => {
  if (!args.statecode || typeof args.statecode !== 'string') throw new Error('statecode is required')
  const statecode = args.statecode.trim()
  const data = await apiFetch<any>(`/Station/search?statecode=${encodeURIComponent(statecode)}&mimeType=geojson&sorted=no&zip=no`)
  const items = (data.features ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        properties: item.properties,
    })),
  }
}, { method: 'search_stations' })

const getResults = sg.wrap(async (args: GetResultsInput) => {
  if (!args.siteid || typeof args.siteid !== 'string') throw new Error('siteid is required')
  const siteid = args.siteid.trim()
  const data = await apiFetch<any>(`/Result/search?siteid=${encodeURIComponent(siteid)}&mimeType=geojson&sorted=no&zip=no`)
  const items = (data.features ?? []).slice(0, 15)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        properties: item.properties,
    })),
  }
}, { method: 'get_results' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchStations, getResults }

console.log('settlegrid-water-quality MCP server ready')
console.log('Methods: search_stations, get_results')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
