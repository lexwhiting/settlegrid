/**
 * settlegrid-jma-weather — JMA Japan Weather MCP Server
 *
 * Wraps Open-Meteo JMA model with SettleGrid billing.
 * No API key needed — Open-Meteo is free and open.
 *
 * Methods:
 *   get_jma_forecast(lat, lon, days?) — JMA forecast (1¢)
 *   get_jma_hourly(lat, lon) — JMA hourly data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ForecastInput { lat: number; lon: number; days?: number }
interface HourlyInput { lat: number; lon: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.open-meteo.com/v1/jma'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'jma-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_jma_forecast: { costCents: 1, displayName: 'JMA Forecast' },
      get_jma_hourly: { costCents: 1, displayName: 'JMA Hourly' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getJmaForecast = sg.wrap(async (args: ForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon are required numbers')
  const days = args.days ?? 7
  if (days < 1 || days > 16) throw new Error('days must be 1-16')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&forecast_days=${days}&timezone=Asia/Tokyo`)
  return {
    location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation },
    daily: data.daily,
    units: data.daily_units,
  }
}, { method: 'get_jma_forecast' })

const getJmaHourly = sg.wrap(async (args: HourlyInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon are required numbers')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&hourly=temperature_2m,relative_humidity_2m,precipitation,weathercode,windspeed_10m&forecast_days=2&timezone=Asia/Tokyo`)
  return {
    location: { lat: data.latitude, lon: data.longitude },
    hourly: data.hourly,
    units: data.hourly_units,
  }
}, { method: 'get_jma_hourly' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getJmaForecast, getJmaHourly }

console.log('settlegrid-jma-weather MCP server ready')
console.log('Methods: get_jma_forecast, get_jma_hourly')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
