/**
 * settlegrid-kma-weather — South Korea KMA Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Korean forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_korea_weather(lat, lon, days?) — Korea weather (1¢)
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
  toolSlug: 'kma-weather',
  pricing: { defaultCostCents: 1, methods: { get_korea_weather: { costCents: 1, displayName: 'Korea Weather' } } },
})

const getKoreaWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&hourly=temperature_2m,precipitation&forecast_days=${days}&timezone=Asia/Seoul`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_korea_weather' })

export { getKoreaWeather }

console.log('settlegrid-kma-weather MCP server ready')
console.log('Methods: get_korea_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
