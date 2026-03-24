/**
 * settlegrid-nigeria-weather — Nigeria Weather MCP Server
 *
 * Nigeria weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_nigeria_weather(lat, lon, days?) — Nigeria weather forecast (1¢)
 *   get_nigeria_weather_city(city) — Weather for major Nigeria cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  lagos: { lat: 6.5244, lon: 3.3792 },
  abuja: { lat: 9.0765, lon: 7.3986 },
  kano: { lat: 12.0022, lon: 8.5920 },
  ibadan: { lat: 7.3775, lon: 3.9470 },
  port_harcourt: { lat: 4.8156, lon: 7.0498 },
  benin_city: { lat: 6.3350, lon: 5.6270 },
  kaduna: { lat: 10.5105, lon: 7.4165 },
  enugu: { lat: 6.4584, lon: 7.5464 },
  calabar: { lat: 4.9757, lon: 8.3417 },
  jos: { lat: 9.8965, lon: 8.8583 },
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
  toolSlug: 'nigeria-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_nigeria_weather: { costCents: 1, displayName: 'Nigeria Weather' },
      get_nigeria_weather_city: { costCents: 1, displayName: 'Nigeria City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Africa/Lagos`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_nigeria_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Africa/Lagos`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_nigeria_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-nigeria-weather MCP server ready')
console.log('Methods: get_nigeria_weather, get_nigeria_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
