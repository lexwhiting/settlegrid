/**
 * settlegrid-spain-weather — Spain Weather MCP Server
 *
 * Spain weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_spain_weather(lat, lon, days?) — Spain weather forecast (1¢)
 *   get_spain_weather_city(city) — Weather for major Spain cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  madrid: { lat: 40.4168, lon: -3.7038 },
  barcelona: { lat: 41.3874, lon: 2.1686 },
  valencia: { lat: 39.4699, lon: -0.3763 },
  seville: { lat: 37.3891, lon: -5.9845 },
  bilbao: { lat: 43.2627, lon: -2.9253 },
  malaga: { lat: 36.7213, lon: -4.4213 },
  zaragoza: { lat: 41.6488, lon: -0.8891 },
  palma: { lat: 39.5696, lon: 2.6502 },
  las_palmas: { lat: 28.1235, lon: -15.4363 },
  tenerife: { lat: 28.4636, lon: -16.2518 },
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
  toolSlug: 'spain-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_spain_weather: { costCents: 1, displayName: 'Spain Weather' },
      get_spain_weather_city: { costCents: 1, displayName: 'Spain City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Europe/Madrid`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_spain_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Europe/Madrid`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_spain_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-spain-weather MCP server ready')
console.log('Methods: get_spain_weather, get_spain_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
