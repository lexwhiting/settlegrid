/**
 * settlegrid-glacier-data — Glacier Monitoring (NCEI) MCP Server
 *
 * Global glacier monitoring data from NOAA NCEI.
 *
 * Methods:
 *   search_datasets(query)        — Search glacier and ice datasets  (1¢)
 *   get_stations(locationid)      — Get monitoring stations by location  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query?: string
}

interface GetStationsInput {
  locationid: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.ncei.noaa.gov'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-glacier-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Glacier Monitoring (NCEI) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'glacier-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Datasets' },
      get_stations: { costCents: 1, displayName: 'Get Stations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  const query = typeof args.query === 'string' ? args.query.trim() : ''
  const data = await apiFetch<any>(`/cdo-web/api/v2/datasets?datatypeid=SNOW&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        mindate: item.mindate,
        maxdate: item.maxdate,
        datacoverage: item.datacoverage,
    })),
  }
}, { method: 'search_datasets' })

const getStations = sg.wrap(async (args: GetStationsInput) => {
  if (!args.locationid || typeof args.locationid !== 'string') throw new Error('locationid is required')
  const locationid = args.locationid.trim()
  const data = await apiFetch<any>(`/cdo-web/api/v2/stations?locationid=${encodeURIComponent(locationid)}&limit=10`)
  const items = (data.results ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        elevation: item.elevation,
        mindate: item.mindate,
        maxdate: item.maxdate,
    })),
  }
}, { method: 'get_stations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getStations }

console.log('settlegrid-glacier-data MCP server ready')
console.log('Methods: search_datasets, get_stations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
