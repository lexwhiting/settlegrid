/**
 * settlegrid-climate-projection — Climate Projections MCP Server
 *
 * Wraps Open-Meteo Climate API (CMIP6) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_climate_projection(lat, lon, start_date, end_date) — projections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ClimInput { lat: number; lon: number; start_date: string; end_date: string }

const API_BASE = 'https://climate-api.open-meteo.com/v1/climate'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'climate-projection',
  pricing: { defaultCostCents: 1, methods: { get_climate_projection: { costCents: 1, displayName: 'Climate Projection' } } },
})

const getClimateProjection = sg.wrap(async (args: ClimInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  if (!args.start_date || !args.end_date) throw new Error('start_date and end_date required')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&start_date=${args.start_date}&end_date=${args.end_date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=EC_Earth3P_HR`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, model: 'EC_Earth3P_HR' }
}, { method: 'get_climate_projection' })

export { getClimateProjection }

console.log('settlegrid-climate-projection MCP server ready')
console.log('Methods: get_climate_projection')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
