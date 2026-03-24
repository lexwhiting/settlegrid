/**
 * settlegrid-uk-transport — UK Transport Data MCP Server
 *
 * Wraps TransportAPI with SettleGrid billing.
 * Free key from https://developer.transportapi.com/.
 *
 * Methods:
 *   get_departures(station_code)           — Get departures (2¢)
 *   search_stations(query)                 — Search stations (2¢)
 *   get_bus_times(atcocode)                — Get bus times (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDeparturesInput {
  station_code: string
}

interface SearchStationsInput {
  query: string
}

interface GetBusTimesInput {
  atcocode: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://transportapi.com/v3'
const API_KEY = process.env.TRANSPORT_API_KEY || ''
const APP_ID = process.env.TRANSPORT_APP_ID || ''
const USER_AGENT = 'settlegrid-uk-transport/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('app_id', APP_ID)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TransportAPI ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-transport',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_departures: { costCents: 2, displayName: 'Get train departures' },
      search_stations: { costCents: 2, displayName: 'Search train stations' },
      get_bus_times: { costCents: 2, displayName: 'Get bus departure times' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDepartures = sg.wrap(async (args: GetDeparturesInput) => {
  if (!args.station_code || typeof args.station_code !== 'string') {
    throw new Error('station_code is required (CRS code e.g. PAD)')
  }
  const code = args.station_code.toUpperCase()
  const data = await apiFetch<Record<string, unknown>>(`/uk/train/station/${code}/live.json`)
  return data
}, { method: 'get_departures' })

const searchStations = sg.wrap(async (args: SearchStationsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (station name)')
  }
  const data = await apiFetch<Record<string, unknown>>('/uk/places.json', {
    params: { query: args.query, type: 'train_station' },
  })
  return data
}, { method: 'search_stations' })

const getBusTimes = sg.wrap(async (args: GetBusTimesInput) => {
  if (!args.atcocode || typeof args.atcocode !== 'string') {
    throw new Error('atcocode is required (bus stop ATCO code)')
  }
  const data = await apiFetch<Record<string, unknown>>(`/uk/bus/stop/${args.atcocode}/live.json`)
  return data
}, { method: 'get_bus_times' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDepartures, searchStations, getBusTimes }

console.log('settlegrid-uk-transport MCP server ready')
console.log('Methods: get_departures, search_stations, get_bus_times')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
