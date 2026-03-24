/**
 * settlegrid-distance-calc — Distance Calculator MCP Server
 *
 * Calculates distances locally using Haversine formula.
 * No API key needed.
 *
 * Methods:
 *   calc_distance(lat1, lon1, lat2, lon2) — distance calculation (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DistInput { lat1: number; lon1: number; lat2: number; lon2: number }

const sg = settlegrid.init({
  toolSlug: 'distance-calc',
  pricing: { defaultCostCents: 1, methods: { calc_distance: { costCents: 1, displayName: 'Calculate Distance' } } },
})

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

const calcDistance = sg.wrap(async (args: DistInput) => {
  if ([args.lat1, args.lon1, args.lat2, args.lon2].some(v => typeof v !== 'number')) {
    throw new Error('All coordinates (lat1, lon1, lat2, lon2) are required numbers')
  }
  const km = haversine(args.lat1, args.lon1, args.lat2, args.lon2)
  const deg = bearing(args.lat1, args.lon1, args.lat2, args.lon2)
  return {
    from: { lat: args.lat1, lon: args.lon1 },
    to: { lat: args.lat2, lon: args.lon2 },
    distance_km: Math.round(km * 100) / 100,
    distance_miles: Math.round(km * 0.621371 * 100) / 100,
    distance_nm: Math.round(km * 0.539957 * 100) / 100,
    bearing_degrees: Math.round(deg * 100) / 100,
  }
}, { method: 'calc_distance' })

export { calcDistance }

console.log('settlegrid-distance-calc MCP server ready')
console.log('Methods: calc_distance')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
