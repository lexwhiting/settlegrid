/**
 * settlegrid-italy-weather — Italy Weather MCP Server
 *
 * Italy weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_italy_weather(lat, lon, days?) — Italy weather forecast (1¢)
 *   get_italy_weather_city(city) — Weather for major Italy cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  rome: { lat: 41.9028, lon: 12.4964 },
  milan: { lat: 45.4642, lon: 9.1900 },
  naples: { lat: 40.8518, lon: 14.2681 },
  turin: { lat: 45.0703, lon: 7.6869 },
  florence: { lat: 43.7696, lon: 11.2558 },
  venice: { lat: 45.4408, lon: 12.3155 },
  bologna: { lat: 44.4949, lon: 11.3426 },
  palermo: { lat: 38.1157, lon: 13.3615 },
  genoa: { lat: 44.4056, lon: 8.9463 },
  cagliari: { lat: 39.2238, lon: 9.1217 },
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'italy-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_italy_weather: { costCents: 1, displayName: 'Italy Weather' },
      get_italy_weather_city: { costCents: 1, displayName: 'Italy City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Europe/Rome`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_italy_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Europe/Rome`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_italy_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-italy-weather MCP server ready')
console.log('Methods: get_italy_weather, get_italy_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
