/**
 * settlegrid-brazil-weather — Brazil INMET Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Brazilian forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_brazil_weather(lat, lon, days?) — Brazil weather (1¢)
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
  toolSlug: 'brazil-weather',
  pricing: { defaultCostCents: 1, methods: { get_brazil_weather: { costCents: 1, displayName: 'Brazil Weather' } } },
})

const getBrazilWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&forecast_days=${days}&timezone=America/Sao_Paulo`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, units: data.daily_units }
}, { method: 'get_brazil_weather' })

export { getBrazilWeather }

console.log('settlegrid-brazil-weather MCP server ready')
console.log('Methods: get_brazil_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
