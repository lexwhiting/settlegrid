/**
 * settlegrid-timezone-db — TimezoneDB MCP Server
 *
 * Wraps the TimezoneDB API with SettleGrid billing.
 * Requires a free TimezoneDB API key.
 *
 * Methods:
 *   get_timezone_by_position(lat, lon)  — Timezone by coords   (1¢)
 *   get_timezone_by_zone(zone)          — Timezone by name     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PositionInput {
  lat: number
  lon: number
}

interface ZoneInput {
  zone: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TZ_BASE = 'https://api.timezonedb.com/v2.1'
const API_KEY = process.env.TIMEZONEDB_API_KEY || ''

async function tzFetch<T>(params: string): Promise<T> {
  if (!API_KEY) throw new Error('TIMEZONEDB_API_KEY environment variable is required')
  const res = await fetch(`${TZ_BASE}/get-time-zone?key=${API_KEY}&format=json&${params}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`TimezoneDB API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as any
  if (data.status === 'FAILED') throw new Error(`TimezoneDB: ${data.message}`)
  return data as T
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'timezone-db',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_timezone_by_position: { costCents: 1, displayName: 'Timezone by Position' },
      get_timezone_by_zone: { costCents: 1, displayName: 'Timezone by Zone' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTimezoneByPosition = sg.wrap(async (args: PositionInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await tzFetch<any>(`by=position&lat=${args.lat}&lng=${args.lon}`)
  return {
    zoneName: data.zoneName,
    abbreviation: data.abbreviation,
    gmtOffset: data.gmtOffset,
    dst: data.dst,
    timestamp: data.timestamp,
    formatted: data.formatted,
    countryCode: data.countryCode,
    countryName: data.countryName,
  }
}, { method: 'get_timezone_by_position' })

const getTimezoneByZone = sg.wrap(async (args: ZoneInput) => {
  if (!args.zone || typeof args.zone !== 'string') {
    throw new Error('zone is required (e.g. "America/New_York")')
  }
  const z = encodeURIComponent(args.zone.trim())
  const data = await tzFetch<any>(`by=zone&zone=${z}`)
  return {
    zoneName: data.zoneName,
    abbreviation: data.abbreviation,
    gmtOffset: data.gmtOffset,
    dst: data.dst,
    timestamp: data.timestamp,
    formatted: data.formatted,
    countryCode: data.countryCode,
    countryName: data.countryName,
  }
}, { method: 'get_timezone_by_zone' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTimezoneByPosition, getTimezoneByZone }

console.log('settlegrid-timezone-db MCP server ready')
console.log('Methods: get_timezone_by_position, get_timezone_by_zone')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
