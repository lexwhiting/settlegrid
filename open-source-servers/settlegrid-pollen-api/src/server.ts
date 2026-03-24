/**
 * settlegrid-pollen-api — Ambee Pollen & Allergy MCP Server
 *
 * Pollen counts, allergy risk, and air quality via Ambee.
 *
 * Methods:
 *   get_pollen_data(lat, lng)     — Get real-time pollen count and risk by coordinates  (2¢)
 *   get_air_quality(lat, lng)     — Get current air quality index by coordinates  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetPollenDataInput {
  lat: number
  lng: number
}

interface GetAirQualityInput {
  lat: number
  lng: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.ambeedata.com'
const API_KEY = process.env.AMBEE_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-pollen-api/1.0', 'x-api-key': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ambee Pollen & Allergy API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pollen-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_pollen_data: { costCents: 2, displayName: 'Pollen Data' },
      get_air_quality: { costCents: 2, displayName: 'Air Quality' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPollenData = sg.wrap(async (args: GetPollenDataInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lng !== 'number') throw new Error('lng is required and must be a number')
  const lng = args.lng
  const data = await apiFetch<any>(`/latest/pollen/by-lat-lng?lat=${lat}&lng=${lng}`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        Count: item.Count,
        Risk: item.Risk,
        Species: item.Species,
        updatedAt: item.updatedAt,
    })),
  }
}, { method: 'get_pollen_data' })

const getAirQuality = sg.wrap(async (args: GetAirQualityInput) => {
  if (typeof args.lat !== 'number') throw new Error('lat is required and must be a number')
  const lat = args.lat
  if (typeof args.lng !== 'number') throw new Error('lng is required and must be a number')
  const lng = args.lng
  const data = await apiFetch<any>(`/latest/by-lat-lng?lat=${lat}&lng=${lng}`)
  const items = (data.stations ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        CO: item.CO,
        NO2: item.NO2,
        OZONE: item.OZONE,
        PM25: item.PM25,
        AQI: item.AQI,
        aqiInfo: item.aqiInfo,
    })),
  }
}, { method: 'get_air_quality' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPollenData, getAirQuality }

console.log('settlegrid-pollen-api MCP server ready')
console.log('Methods: get_pollen_data, get_air_quality')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
