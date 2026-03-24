/**
 * settlegrid-germany-weather — Germany Weather MCP Server
 *
 * Germany weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_germany_weather(lat, lon, days?) — Germany weather forecast (1¢)
 *   get_germany_weather_city(city) — Weather for major Germany cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  berlin: { lat: 52.5200, lon: 13.4050 },
  munich: { lat: 48.1351, lon: 11.5820 },
  hamburg: { lat: 53.5511, lon: 9.9937 },
  frankfurt: { lat: 50.1109, lon: 8.6821 },
  cologne: { lat: 50.9375, lon: 6.9603 },
  stuttgart: { lat: 48.7758, lon: 9.1829 },
  dusseldorf: { lat: 51.2277, lon: 6.7735 },
  leipzig: { lat: 51.3397, lon: 12.3731 },
  dresden: { lat: 51.0504, lon: 13.7373 },
  nuremberg: { lat: 49.4521, lon: 11.0767 },
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
  toolSlug: 'germany-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_germany_weather: { costCents: 1, displayName: 'Germany Weather' },
      get_germany_weather_city: { costCents: 1, displayName: 'Germany City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Europe/Berlin`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_germany_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Europe/Berlin`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_germany_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-germany-weather MCP server ready')
console.log('Methods: get_germany_weather, get_germany_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
