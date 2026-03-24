/**
 * settlegrid-mexico-weather — Mexico SMN Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Mexican forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_mexico_weather(lat, lon, days?) — Mexico weather (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'mexico-weather',
  pricing: { defaultCostCents: 1, methods: { get_mexico_weather: { costCents: 1, displayName: 'Mexico Weather' } } },
})

const getMexicoWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=${days}&timezone=America/Mexico_City`)
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, units: data.daily_units }
}, { method: 'get_mexico_weather' })

export { getMexicoWeather }

console.log('settlegrid-mexico-weather MCP server ready')
console.log('Methods: get_mexico_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
