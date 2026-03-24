/**
 * settlegrid-japan-weather — Japan Meteorological Agency MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Japanese weather forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_japan_weather(lat, lon, days?) — Japan weather forecast (1¢)
 *   get_japan_city_weather(city) — Weather for major Japanese cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

const JAPAN_CITIES: Record<string, { lat: number; lon: number }> = {
  tokyo: { lat: 35.6762, lon: 139.6503 },
  osaka: { lat: 34.6937, lon: 135.5023 },
  yokohama: { lat: 35.4437, lon: 139.6380 },
  nagoya: { lat: 35.1815, lon: 136.9066 },
  sapporo: { lat: 43.0618, lon: 141.3545 },
  fukuoka: { lat: 33.5904, lon: 130.4017 },
  kobe: { lat: 34.6901, lon: 135.1956 },
  kyoto: { lat: 35.0116, lon: 135.7681 },
  sendai: { lat: 38.2682, lon: 140.8694 },
  hiroshima: { lat: 34.3853, lon: 132.4553 },
  naha: { lat: 26.3344, lon: 127.8056 },
  niigata: { lat: 37.9161, lon: 139.0364 },
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
  toolSlug: 'japan-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_japan_weather: { costCents: 1, displayName: 'Japan Weather' },
      get_japan_city_weather: { costCents: 1, displayName: 'Japan City Weather' },
    },
  },
})

const getJapanWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API_BASE}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m,precipitation&forecast_days=${days}&timezone=Asia/Tokyo`
  )
  return {
    location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation },
    daily: data.daily,
    hourly: data.hourly,
  }
}, { method: 'get_japan_weather' })

const getJapanCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim()
  const coords = JAPAN_CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(JAPAN_CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API_BASE}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=7&timezone=Asia/Tokyo`
  )
  return { city: key, location: coords, daily: data.daily, hourly: data.hourly }
}, { method: 'get_japan_city_weather' })

export { getJapanWeather, getJapanCityWeather }

console.log('settlegrid-japan-weather MCP server ready')
console.log('Methods: get_japan_weather, get_japan_city_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
