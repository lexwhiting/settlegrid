/**
 * settlegrid-korea-weather — Korea KMA Weather MCP Server
 *
 * Korean weather forecasts via Open-Meteo. No API key needed.
 *
 * Methods:
 *   get_korea_weather(lat, lon, days?) — Korea weather forecast (1¢)
 *   get_korea_city_weather(city) — Weather for major Korean cities (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }
interface CityInput { city: string }

const API = 'https://api.open-meteo.com/v1/forecast'

const CITIES: Record<string, { lat: number; lon: number }> = {
  seoul: { lat: 37.5665, lon: 126.9780 },
  busan: { lat: 35.1796, lon: 129.0756 },
  incheon: { lat: 37.4563, lon: 126.7052 },
  daegu: { lat: 35.8714, lon: 128.6014 },
  daejeon: { lat: 36.3504, lon: 127.3845 },
  gwangju: { lat: 35.1595, lon: 126.8526 },
  suwon: { lat: 37.2636, lon: 127.0286 },
  ulsan: { lat: 35.5384, lon: 129.3114 },
  jeju: { lat: 33.4996, lon: 126.5312 },
  gangneung: { lat: 37.7519, lon: 128.8761 },
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
  toolSlug: 'korea-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_korea_weather: { costCents: 1, displayName: 'Korea Weather' },
      get_korea_city_weather: { costCents: 1, displayName: 'Korea City Weather' },
    },
  },
})

const getKoreaWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(
    `${API}?latitude=${args.lat}&longitude=${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=${days}&timezone=Asia/Seoul`
  )
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_korea_weather' })

const getKoreaCityWeather = sg.wrap(async (args: CityInput) => {
  const key = (args.city || '').toLowerCase().trim()
  const coords = CITIES[key]
  if (!coords) throw new Error(`Unknown city. Available: ${Object.keys(CITIES).join(', ')}`)
  const data = await apiFetch<any>(
    `${API}?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=7&timezone=Asia/Seoul`
  )
  return { city: key, location: coords, daily: data.daily }
}, { method: 'get_korea_city_weather' })

export { getKoreaWeather, getKoreaCityWeather }

console.log('settlegrid-korea-weather MCP server ready')
console.log('Methods: get_korea_weather, get_korea_city_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
