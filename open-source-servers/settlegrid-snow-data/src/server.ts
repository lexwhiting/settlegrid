/**
 * settlegrid-snow-data — Snowfall & Snowpack Data MCP Server
 * Wraps NRCS SNOTEL AWDB with SettleGrid billing.
 * Methods:
 *   get_snowpack(station)     — Get snowpack data (1¢)
 *   list_stations(state?)     — List stations (1¢)
 *   get_forecast(station)     — Get forecast (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StationInput {
  station: string
}

interface ListInput {
  state?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://wcc.sc.egov.usda.gov/awdbWebService/services'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-snow-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NRCS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'snow-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_snowpack: { costCents: 1, displayName: 'Get snowpack data' },
      list_stations: { costCents: 1, displayName: 'List SNOTEL stations' },
      get_forecast: { costCents: 2, displayName: 'Get water supply forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSnowpack = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required (e.g. 669:CO:SNTL)')
  }
  return apiFetch<unknown>('v1/data', {
    stationTriplets: args.station,
    elementCd: 'SNWD,WTEQ',
    beginDate: todayStr(),
    endDate: todayStr(),
  })
}, { method: 'get_snowpack' })

const listStations = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = { networkCd: 'SNTL' }
  if (args.state) params.stateCd = args.state.toUpperCase()
  return apiFetch<unknown>('v1/stations', params)
}, { method: 'list_stations' })

const getForecast = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  return apiFetch<unknown>('v1/forecasts', {
    stationTriplets: args.station,
  })
}, { method: 'get_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSnowpack, listStations, getForecast }

console.log('settlegrid-snow-data MCP server ready')
console.log('Methods: get_snowpack, list_stations, get_forecast')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
