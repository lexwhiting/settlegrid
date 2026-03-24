/**
 * settlegrid-breezometer — BreezoMeter Air Quality MCP Server
 *
 * Real-time air quality index, pollutants, and pollen data by location.
 *
 * Methods:
 *   get_air_quality(lat, lng)     — Get current air quality index and pollutants for a location  (2¢)
 *   get_pollen(lat, lng)          — Get pollen count and forecast for a location  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAirQualityInput {
  lat: number
  lng: number
}

interface GetPollenInput {
  lat: number
  lng: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.breezometer.com'
const API_KEY = process.env.BREEZOMETER_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-breezometer/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`BreezoMeter Air Quality API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'breezometer',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_air_quality: { costCents: 2, displayName: 'Air Quality' },
      get_pollen: { costCents: 2, displayName: 'Pollen Forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAirQuality = sg.wrap(async (args: GetAirQualityInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lng !== 'number') throw new Error('lng is required and must be a number')
  const lng = args.lng
  const data = await apiFetch<any>(`/air-quality/v2/current-conditions?lat=${lat}&lon=${lng}&features=breezometer_aqi,pollutants&key=${API_KEY}`)
  return {
    breezometer_aqi: data.breezometer_aqi,
    datetime: data.datetime,
    data_available: data.data_available,
  }
}, { method: 'get_air_quality' })

const getPollen = sg.wrap(async (args: GetPollenInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lng !== 'number') throw new Error('lng is required and must be a number')
  const lng = args.lng
  const data = await apiFetch<any>(`/pollen/v2/forecast/daily?lat=${lat}&lon=${lng}&days=3&key=${API_KEY}`)
  const items = (data.data ?? []).slice(0, 3)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        date: item.date,
        types: item.types,
        plants_index: item.plants_index,
    })),
  }
}, { method: 'get_pollen' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAirQuality, getPollen }

console.log('settlegrid-breezometer MCP server ready')
console.log('Methods: get_air_quality, get_pollen')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
