/**
 * settlegrid-india-weather — India IMD Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Indian forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_india_weather(lat, lon, days?) — India weather (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

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
  toolSlug: 'india-weather',
  pricing: { defaultCostCents: 1, methods: { get_india_weather: { costCents: 1, displayName: 'India Weather' } } },
})

const getIndiaWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Asia/Kolkata`)
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_india_weather' })

export { getIndiaWeather }

console.log('settlegrid-india-weather MCP server ready')
console.log('Methods: get_india_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
