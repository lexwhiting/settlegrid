/**
 * settlegrid-canada-weather — Canada Weather MCP Server
 *
 * Wraps Open-Meteo GEM model with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_gem_forecast(lat, lon, days?) — GEM forecast (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ForecastInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/gem'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'canada-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_gem_forecast: { costCents: 1, displayName: 'GEM Forecast' },
    },
  },
})

const getGemForecast = sg.wrap(async (args: ForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  if (days < 1 || days > 14) throw new Error('days must be 1-14')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&forecast_days=${days}&timezone=America/Toronto`)
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, units: data.daily_units }
}, { method: 'get_gem_forecast' })

export { getGemForecast }

console.log('settlegrid-canada-weather MCP server ready')
console.log('Methods: get_gem_forecast')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
