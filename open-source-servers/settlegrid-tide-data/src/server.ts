/**
 * settlegrid-tide-data — Tidal Predictions MCP Server
 * Wraps NOAA CO-OPS API with SettleGrid billing.
 * Methods:
 *   get_predictions(station, date?, range?) — Get predictions (2¢)
 *   list_stations(state?)                   — List stations (1¢)
 *   get_levels(station)                     — Get water levels (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PredictionInput {
  station: string
  date?: string
  range?: number
}

interface ListInput {
  state?: string
}

interface LevelInput {
  station: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  params.application = 'settlegrid-tide-data'
  params.units = 'english'
  params.time_zone = 'gmt'
  params.format = 'json'
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-tide-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NOAA CO-OPS ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function todayStr(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tide-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_predictions: { costCents: 2, displayName: 'Get tide predictions' },
      list_stations: { costCents: 1, displayName: 'List tide stations' },
      get_levels: { costCents: 1, displayName: 'Get water levels' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPredictions = sg.wrap(async (args: PredictionInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  const range = Math.min(args.range || 24, 168)
  return apiFetch<unknown>({
    station: args.station,
    product: 'predictions',
    datum: 'MLLW',
    begin_date: args.date || todayStr(),
    range: String(range),
    interval: 'hilo',
  })
}, { method: 'get_predictions' })

const listStations = sg.wrap(async (args: ListInput) => {
  const url = new URL('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json')
  url.searchParams.set('type', 'tidepredictions')
  if (args.state) url.searchParams.set('state', args.state.toUpperCase())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-tide-data/1.0' },
  })
  if (!res.ok) throw new Error(`NOAA API ${res.status}`)
  return res.json()
}, { method: 'list_stations' })

const getLevels = sg.wrap(async (args: LevelInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  return apiFetch<unknown>({
    station: args.station,
    product: 'water_level',
    datum: 'MLLW',
    date: 'latest',
    range: '24',
  })
}, { method: 'get_levels' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPredictions, listStations, getLevels }

console.log('settlegrid-tide-data MCP server ready')
console.log('Methods: get_predictions, list_stations, get_levels')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
