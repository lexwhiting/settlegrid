/**
 * settlegrid-haversine-distance — Geographic Distance Calculator MCP Server
 *
 * Calculates distances between geographic coordinates using the Haversine
 * formula. Supports multiple units and midpoint calculation.
 *
 * Methods:
 *   calculate(lat1, lon1, lat2, lon2)  — Distance between points   (1c)
 *   midpoint(lat1, lon1, lat2, lon2)   — Geographic midpoint       (1c)
 *   bearing(lat1, lon1, lat2, lon2)    — Initial bearing           (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CalcInput { lat1: number; lon1: number; lat2: number; lon2: number; unit?: string }
interface MidpointInput { lat1: number; lon1: number; lat2: number; lon2: number }
interface BearingInput { lat1: number; lon1: number; lat2: number; lon2: number }

const EARTH_RADIUS_KM = 6371
const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLon = (lon2 - lon1) * DEG_TO_RAD
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

const UNIT_FACTORS: Record<string, { factor: number; name: string }> = {
  km: { factor: 1, name: 'kilometers' },
  mi: { factor: 0.621371, name: 'miles' },
  nm: { factor: 0.539957, name: 'nautical miles' },
  m: { factor: 1000, name: 'meters' },
  ft: { factor: 3280.84, name: 'feet' },
}

const sg = settlegrid.init({
  toolSlug: 'haversine-distance',
  pricing: { defaultCostCents: 1, methods: {
    calculate: { costCents: 1, displayName: 'Calculate Distance' },
    midpoint: { costCents: 1, displayName: 'Calculate Midpoint' },
    bearing: { costCents: 1, displayName: 'Calculate Bearing' },
  }},
})

const calculate = sg.wrap(async (args: CalcInput) => {
  if (!Number.isFinite(args.lat1) || !Number.isFinite(args.lon1) || !Number.isFinite(args.lat2) || !Number.isFinite(args.lon2)) throw new Error('lat1, lon1, lat2, lon2 required')
  const km = haversine(args.lat1, args.lon1, args.lat2, args.lon2)
  const unit = (args.unit ?? 'km').toLowerCase()
  const u = UNIT_FACTORS[unit]
  if (!u) throw new Error(`Unknown unit. Available: ${Object.keys(UNIT_FACTORS).join(', ')}`)
  return {
    from: { lat: args.lat1, lon: args.lon1 },
    to: { lat: args.lat2, lon: args.lon2 },
    distance: Math.round(km * u.factor * 100) / 100,
    unit: u.name,
    distance_km: Math.round(km * 100) / 100,
    distance_mi: Math.round(km * 0.621371 * 100) / 100,
  }
}, { method: 'calculate' })

const midpoint = sg.wrap(async (args: MidpointInput) => {
  if (!Number.isFinite(args.lat1) || !Number.isFinite(args.lon1) || !Number.isFinite(args.lat2) || !Number.isFinite(args.lon2)) throw new Error('lat1, lon1, lat2, lon2 required')
  const lat1 = args.lat1 * DEG_TO_RAD, lon1 = args.lon1 * DEG_TO_RAD
  const lat2 = args.lat2 * DEG_TO_RAD, lon2 = args.lon2 * DEG_TO_RAD
  const dLon = lon2 - lon1
  const bx = Math.cos(lat2) * Math.cos(dLon)
  const by = Math.cos(lat2) * Math.sin(dLon)
  const midLat = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + bx) * (Math.cos(lat1) + bx) + by * by))
  const midLon = lon1 + Math.atan2(by, Math.cos(lat1) + bx)
  return {
    midpoint: { lat: Math.round(midLat * RAD_TO_DEG * 100000) / 100000, lon: Math.round(midLon * RAD_TO_DEG * 100000) / 100000 },
    from: { lat: args.lat1, lon: args.lon1 },
    to: { lat: args.lat2, lon: args.lon2 },
  }
}, { method: 'midpoint' })

const bearing = sg.wrap(async (args: BearingInput) => {
  if (!Number.isFinite(args.lat1) || !Number.isFinite(args.lon1) || !Number.isFinite(args.lat2) || !Number.isFinite(args.lon2)) throw new Error('lat1, lon1, lat2, lon2 required')
  const lat1 = args.lat1 * DEG_TO_RAD, lat2 = args.lat2 * DEG_TO_RAD
  const dLon = (args.lon2 - args.lon1) * DEG_TO_RAD
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const deg = ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360
  const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]
  return { bearing_degrees: Math.round(deg * 100) / 100, compass_direction: compass, from: { lat: args.lat1, lon: args.lon1 }, to: { lat: args.lat2, lon: args.lon2 } }
}, { method: 'bearing' })

export { calculate, midpoint, bearing }
console.log('settlegrid-haversine-distance MCP server ready')
console.log('Methods: calculate, midpoint, bearing')
console.log('Pricing: 1c per call | Powered by SettleGrid')
