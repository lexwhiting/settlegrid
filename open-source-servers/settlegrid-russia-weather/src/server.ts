/**
 * settlegrid-russia-weather — Russia Weather MCP Server
 *
 * Russia weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_russia_weather(lat, lon, days?) — Russia weather forecast (1¢)
 *   get_russia_weather_city(city) — Weather for major Russia cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  moscow: { lat: 55.7558, lon: 37.6173 },
  saint_petersburg: { lat: 59.9343, lon: 30.3351 },
  novosibirsk: { lat: 55.0084, lon: 82.9357 },
  yekaterinburg: { lat: 56.8389, lon: 60.6057 },
  kazan: { lat: 55.7961, lon: 49.1064 },
  nizhny_novgorod: { lat: 56.2965, lon: 43.9361 },
  chelyabinsk: { lat: 55.1644, lon: 61.4368 },
  samara: { lat: 53.1959, lon: 50.1002 },
  vladivostok: { lat: 43.1332, lon: 131.9113 },
  sochi: { lat: 43.5855, lon: 39.7231 },
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
  toolSlug: 'russia-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_russia_weather: { costCents: 1, displayName: 'Russia Weather' },
      get_russia_weather_city: { costCents: 1, displayName: 'Russia City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Europe/Moscow`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_russia_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Europe/Moscow`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_russia_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-russia-weather MCP server ready')
console.log('Methods: get_russia_weather, get_russia_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
