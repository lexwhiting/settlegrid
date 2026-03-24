/**
 * settlegrid-flood-data — Flood Monitoring MCP Server
 *
 * Wraps Open-Meteo Flood API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_flood_forecast(lat, lon) — flood forecast (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FloodInput { lat: number; lon: number }

const API_BASE = 'https://flood-api.open-meteo.com/v1/flood'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'flood-data',
  pricing: { defaultCostCents: 1, methods: { get_flood_forecast: { costCents: 1, displayName: 'Flood Forecast' } } },
})

const getFloodForecast = sg.wrap(async (args: FloodInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=river_discharge,river_discharge_mean,river_discharge_max`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, units: data.daily_units }
}, { method: 'get_flood_forecast' })

export { getFloodForecast }

console.log('settlegrid-flood-data MCP server ready')
console.log('Methods: get_flood_forecast')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
