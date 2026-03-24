/**
 * settlegrid-climate-data — Historical Climate Data MCP Server
 *
 * Historical weather and climate data from Open-Meteo archive.
 *
 * Methods:
 *   get_historical_weather(lat, lng, start_date, end_date) — Get historical daily weather for a location and date range  (1¢)
 *   get_climate_normals(lat, lng) — Get climate normals (monthly averages) for a location  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetHistoricalWeatherInput {
  lat: number
  lng: number
  start_date: string
  end_date: string
}

interface GetClimateNormalsInput {
  lat: number
  lng: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://archive-api.open-meteo.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-climate-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Historical Climate Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'climate-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_historical_weather: { costCents: 1, displayName: 'Historical Weather' },
      get_climate_normals: { costCents: 1, displayName: 'Climate Normals' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHistoricalWeather = sg.wrap(async (args: GetHistoricalWeatherInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lng !== 'number') throw new Error('lng is required and must be a number')
  const lng = args.lng
  if (!args.start_date || typeof args.start_date !== 'string') throw new Error('start_date is required')
  const start_date = args.start_date.trim()
  if (!args.end_date || typeof args.end_date !== 'string') throw new Error('end_date is required')
  const end_date = args.end_date.trim()
  const data = await apiFetch<any>(`/archive?latitude=${lat}&longitude=${lng}&start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum`)
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    daily: data.daily,
    daily_units: data.daily_units,
  }
}, { method: 'get_historical_weather' })

const getClimateNormals = sg.wrap(async (args: GetClimateNormalsInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lng !== 'number') throw new Error('lng is required and must be a number')
  const lng = args.lng
  const data = await apiFetch<any>(`/archive?latitude=${lat}&longitude=${lng}&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_max,temperature_2m_min&timezone=auto`)
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    daily: data.daily,
    daily_units: data.daily_units,
  }
}, { method: 'get_climate_normals' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHistoricalWeather, getClimateNormals }

console.log('settlegrid-climate-data MCP server ready')
console.log('Methods: get_historical_weather, get_climate_normals')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
