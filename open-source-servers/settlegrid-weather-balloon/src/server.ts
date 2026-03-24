/**
 * settlegrid-weather-balloon — Radiosonde Data MCP Server
 * Wraps NWS API with SettleGrid billing.
 * Methods:
 *   get_soundings(station, date?) — Get soundings (2¢)
 *   list_stations()               — List stations (1¢)
 *   get_latest(station)           — Get latest obs (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SoundingInput {
  station: string
  date?: string
}

interface StationInput {
  station: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.weather.gov'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'settlegrid-weather-balloon/1.0 (contact@settlegrid.ai)',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NWS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'weather-balloon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_soundings: { costCents: 2, displayName: 'Get radiosonde soundings' },
      list_stations: { costCents: 1, displayName: 'List radiosonde stations' },
      get_latest: { costCents: 1, displayName: 'Get latest observation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSoundings = sg.wrap(async (args: SoundingInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required (e.g. OKX)')
  }
  const station = args.station.toUpperCase()
  return apiFetch<unknown>(`/stations/${encodeURIComponent(station)}/observations`)
}, { method: 'get_soundings' })

const listStations = sg.wrap(async () => {
  return apiFetch<unknown>('/stations?state=US&limit=50')
}, { method: 'list_stations' })

const getLatest = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  const station = args.station.toUpperCase()
  return apiFetch<unknown>(`/stations/${encodeURIComponent(station)}/observations/latest`)
}, { method: 'get_latest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSoundings, listStations, getLatest }

console.log('settlegrid-weather-balloon MCP server ready')
console.log('Methods: get_soundings, list_stations, get_latest')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
