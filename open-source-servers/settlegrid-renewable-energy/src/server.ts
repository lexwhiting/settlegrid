/**
 * settlegrid-renewable-energy — Renewable Energy Stats MCP Server
 *
 * Wraps Open-Meteo solar/wind data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_solar_potential(lat, lon, days?) — solar data (1¢)
 *   get_wind_potential(lat, lon, days?) — wind data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PotentialInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'renewable-energy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_solar_potential: { costCents: 1, displayName: 'Solar Potential' },
      get_wind_potential: { costCents: 1, displayName: 'Wind Potential' },
    },
  },
})

const getSolarPotential = sg.wrap(async (args: PotentialInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=shortwave_radiation_sum,sunshine_duration&hourly=direct_radiation,diffuse_radiation,direct_normal_irradiance&forecast_days=${days}&timezone=auto`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, hourly_sample: { time: data.hourly?.time?.slice(0, 24), direct: data.hourly?.direct_radiation?.slice(0, 24) } }
}, { method: 'get_solar_potential' })

const getWindPotential = sg.wrap(async (args: PotentialInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(`?latitude=${args.lat}&longitude=${args.lon}&daily=windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant&hourly=windspeed_10m,windspeed_80m,windspeed_120m,winddirection_10m&forecast_days=${days}&timezone=auto`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, hourly_sample: { time: data.hourly?.time?.slice(0, 24), speed_80m: data.hourly?.windspeed_80m?.slice(0, 24), speed_120m: data.hourly?.windspeed_120m?.slice(0, 24) } }
}, { method: 'get_wind_potential' })

export { getSolarPotential, getWindPotential }

console.log('settlegrid-renewable-energy MCP server ready')
console.log('Methods: get_solar_potential, get_wind_potential')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
