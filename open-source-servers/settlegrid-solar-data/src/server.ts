/**
 * settlegrid-solar-data — NREL Solar Data MCP Server
 *
 * Solar irradiance and photovoltaic resource data from NREL.
 *
 * Methods:
 *   get_solar_resource(lat, lon)  — Get solar resource data for a lat/lon  (2¢)
 *   get_pvwatts(lat, lon, system_capacity) — Estimate PV system energy production  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetSolarResourceInput {
  lat: number
  lon: number
}

interface GetPvwattsInput {
  lat: number
  lon: number
  system_capacity: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://developer.nrel.gov/api/solar'
const API_KEY = process.env.NREL_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-solar-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NREL Solar Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'solar-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_solar_resource: { costCents: 2, displayName: 'Solar Resource' },
      get_pvwatts: { costCents: 2, displayName: 'PVWatts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSolarResource = sg.wrap(async (args: GetSolarResourceInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lon !== 'number') throw new Error('lon is required and must be a number')
  const lon = args.lon
  const data = await apiFetch<any>(`/solar_resource/v1.json?lat=${lat}&lon=${lon}&api_key=${API_KEY}`)
  return {
    outputs: data.outputs,
    station_info: data.station_info,
  }
}, { method: 'get_solar_resource' })

const getPvwatts = sg.wrap(async (args: GetPvwattsInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lon !== 'number') throw new Error('lon is required and must be a number')
  const lon = args.lon
  if (typeof args.system_capacity !== 'number') throw new Error('system_capacity is required and must be a number')
  const system_capacity = args.system_capacity
  const data = await apiFetch<any>(`/pvwatts/v8.json?lat=${lat}&lon=${lon}&system_capacity=${system_capacity}&module_type=0&losses=14&array_type=1&tilt=20&azimuth=180&api_key=${API_KEY}`)
  return {
    outputs: data.outputs,
    station_info: data.station_info,
  }
}, { method: 'get_pvwatts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSolarResource, getPvwatts }

console.log('settlegrid-solar-data MCP server ready')
console.log('Methods: get_solar_resource, get_pvwatts')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
