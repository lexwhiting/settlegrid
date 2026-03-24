/**
 * settlegrid-south-africa-weather — South Africa Weather MCP Server
 *
 * South Africa weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_south_africa_weather(lat, lon, days?) — South Africa weather forecast (1¢)
 *   get_south_africa_weather_city(city) — Weather for major South Africa cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  johannesburg: { lat: -26.2041, lon: 28.0473 },
  cape_town: { lat: -33.9249, lon: 18.4241 },
  durban: { lat: -29.8587, lon: 31.0218 },
  pretoria: { lat: -25.7479, lon: 28.2293 },
  port_elizabeth: { lat: -33.9608, lon: 25.6022 },
  bloemfontein: { lat: -29.0852, lon: 26.1596 },
  east_london: { lat: -33.0292, lon: 27.8546 },
  kimberley: { lat: -28.7282, lon: 24.7499 },
  polokwane: { lat: -23.9045, lon: 29.4689 },
  nelspruit: { lat: -25.4753, lon: 30.9694 },
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
  toolSlug: 'south-africa-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_south_africa_weather: { costCents: 1, displayName: 'South Africa Weather' },
      get_south_africa_weather_city: { costCents: 1, displayName: 'South Africa City Weather' },
    },
  },
})

const getWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Africa/Johannesburg`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_south_africa_weather' })

const getCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim().replace(/\s+/g, '_')
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Africa/Johannesburg`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_south_africa_weather_city' })

export { getWeather, getCityWeather }

console.log('settlegrid-south-africa-weather MCP server ready')
console.log('Methods: get_south_africa_weather, get_south_africa_weather_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
