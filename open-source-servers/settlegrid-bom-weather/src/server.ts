/**
 * settlegrid-bom-weather — Australia BOM Weather MCP Server
 *
 * Wraps Open-Meteo BOM model with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_bom_forecast(lat, lon, days?) — BOM forecast (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ForecastInput { lat: number; lon: number; days?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.open-meteo.com/v1/bom'

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
  toolSlug: 'bom-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_bom_forecast: { costCents: 1, displayName: 'BOM Forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBomForecast = sg.wrap(async (args: ForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  if (days < 1 || days > 10) throw new Error('days must be 1-10')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=${days}&timezone=Australia/Sydney`)
  return {
    location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation },
    daily: data.daily,
    units: data.daily_units,
  }
}, { method: 'get_bom_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBomForecast }

console.log('settlegrid-bom-weather MCP server ready')
console.log('Methods: get_bom_forecast')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
