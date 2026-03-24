/**
 * settlegrid-france-weather — France Weather MCP Server
 *
 * France weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_france_weather(lat, lon, days?) — France weather forecast (1¢)
 *   get_france_weather_city(city) — Weather for major France cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  paris: { lat: 48.8566, lon: 2.3522 },
  marseille: { lat: 43.2965, lon: 5.3698 },
  lyon: { lat: 45.7640, lon: 4.8357 },
  toulouse: { lat: 43.6047, lon: 1.4442 },
  nice: { lat: 43.7102, lon: 7.2620 },
  nantes: { lat: 47.2184, lon: -1.5536 },
  strasbourg: { lat: 48.5734, lon: 7.7521 },
  bordeaux: { lat: 44.8378, lon: -0.5792 },
  lille: { lat: 50.6292, lon: 3.0573 },
  montpellier: { lat: 43.6108, lon: 3.8767 },
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
  toolSlug: 'france-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_france_weather: { costCents: 1, displayName: 'France Weather' },
      get_france_weather_city: { costCents: 1, displayName: 'France City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Europe/Paris`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_france_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Europe/Paris`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_france_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-france-weather MCP server ready')
console.log('Methods: get_france_weather, get_france_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
