/**
 * settlegrid-turkey-weather — Turkey Weather MCP Server
 *
 * Turkey weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_turkey_weather(lat, lon, days?) — Turkey weather forecast (1¢)
 *   get_turkey_weather_city(city) — Weather for major Turkey cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  istanbul: { lat: 41.0082, lon: 28.9784 },
  ankara: { lat: 39.9334, lon: 32.8597 },
  izmir: { lat: 38.4237, lon: 27.1428 },
  antalya: { lat: 36.8969, lon: 30.7133 },
  bursa: { lat: 40.1885, lon: 29.0610 },
  adana: { lat: 37.0000, lon: 35.3213 },
  trabzon: { lat: 41.0027, lon: 39.7168 },
  konya: { lat: 37.8746, lon: 32.4932 },
  gaziantep: { lat: 37.0662, lon: 37.3833 },
  diyarbakir: { lat: 37.9144, lon: 40.2306 },
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
  toolSlug: 'turkey-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_turkey_weather: { costCents: 1, displayName: 'Turkey Weather' },
      get_turkey_weather_city: { costCents: 1, displayName: 'Turkey City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Europe/Istanbul`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_turkey_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Europe/Istanbul`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_turkey_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-turkey-weather MCP server ready')
console.log('Methods: get_turkey_weather, get_turkey_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
