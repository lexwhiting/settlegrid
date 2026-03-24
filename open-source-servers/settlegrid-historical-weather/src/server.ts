/**
 * settlegrid-historical-weather — Historical Weather MCP Server
 *
 * Wraps Open-Meteo Archive API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_historical_weather(lat, lon, start_date, end_date) — historical data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HistInput { lat: number; lon: number; start_date: string; end_date: string }

const API_BASE = 'https://archive-api.open-meteo.com/v1/archive'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'historical-weather',
  pricing: { defaultCostCents: 1, methods: { get_historical_weather: { costCents: 1, displayName: 'Historical Weather' } } },
})

const getHistoricalWeather = sg.wrap(async (args: HistInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  if (!args.start_date || !args.end_date) throw new Error('start_date and end_date required')
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&start_date=${args.start_date}&end_date=${args.end_date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, units: data.daily_units }
}, { method: 'get_historical_weather' })

export { getHistoricalWeather }

console.log('settlegrid-historical-weather MCP server ready')
console.log('Methods: get_historical_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
