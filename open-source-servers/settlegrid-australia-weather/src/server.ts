/**
 * settlegrid-australia-weather — Australian BOM Weather MCP Server
 *
 * Australian weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_australia_weather(lat, lon, days?) — Australia weather forecast (1¢)
 *   get_australia_city_weather(city) — Weather for major Australian cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  sydney: { lat: -33.8688, lon: 151.2093 },
  melbourne: { lat: -37.8136, lon: 144.9631 },
  brisbane: { lat: -27.4698, lon: 153.0251 },
  perth: { lat: -31.9505, lon: 115.8605 },
  adelaide: { lat: -34.9285, lon: 138.6007 },
  canberra: { lat: -35.2809, lon: 149.1300 },
  hobart: { lat: -42.8821, lon: 147.3272 },
  darwin: { lat: -12.4634, lon: 130.8456 },
  gold_coast: { lat: -28.0167, lon: 153.4000 },
  cairns: { lat: -16.9186, lon: 145.7781 },
  alice_springs: { lat: -23.6980, lon: 133.8807 },
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
  toolSlug: 'australia-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_australia_weather: { costCents: 1, displayName: 'Australia Weather' },
      get_australia_city_weather: { costCents: 1, displayName: 'Australia City Weather' },
    },
  },
})

const getAustraliaWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Australia/Sydney`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_australia_weather' })

const getAustraliaCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Australia/Sydney`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_australia_city_weather' })

export { getAustraliaWeather, getAustraliaCityWeather }

console.log('settlegrid-australia-weather MCP server ready')
console.log('Methods: get_australia_weather, get_australia_city_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
