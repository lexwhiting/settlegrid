/**
 * settlegrid-wind-data — NREL Wind Data MCP Server
 *
 * Wind energy resource data and toolkit from NREL.
 *
 * Methods:
 *   get_wind_resource(lat, lon)   — Get wind resource data for a location  (2¢)
 *   get_wind_speed(lat, lon)      — Get nearest wind speed data point  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetWindResourceInput {
  lat: number
  lon: number
}

interface GetWindSpeedInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://developer.nrel.gov/api/wind-toolkit'
const API_KEY = process.env.NREL_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-wind-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NREL Wind Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wind-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_wind_resource: { costCents: 2, displayName: 'Wind Resource' },
      get_wind_speed: { costCents: 2, displayName: 'Wind Speed' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getWindResource = sg.wrap(async (args: GetWindResourceInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lon !== 'number') throw new Error('lon is required and must be a number')
  const lon = args.lon
  const data = await apiFetch<any>(`/v2/wind/wtk-srw-download.json?lat=${lat}&lon=${lon}&year=2014&hubheight=100&api_key=${API_KEY}`)
  return {
    outputs: data.outputs,
    metadata: data.metadata,
  }
}, { method: 'get_wind_resource' })

const getWindSpeed = sg.wrap(async (args: GetWindSpeedInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lon !== 'number') throw new Error('lon is required and must be a number')
  const lon = args.lon
  const data = await apiFetch<any>(`/v2/wind/wtk-download.json?lat=${lat}&lon=${lon}&year=2014&attributes=windspeed_100m&utc=true&interval=60&leap_day=false&api_key=${API_KEY}`)
  return {
    outputs: data.outputs,
    metadata: data.metadata,
  }
}, { method: 'get_wind_speed' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getWindResource, getWindSpeed }

console.log('settlegrid-wind-data MCP server ready')
console.log('Methods: get_wind_resource, get_wind_speed')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
