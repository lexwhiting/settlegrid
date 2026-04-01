/**
 * settlegrid-geohash-tools — Geohash Encoding/Decoding MCP Server
 *
 * Encodes/decodes geohash strings for geographic coordinates.
 * Provides neighbor calculation and precision information.
 *
 * Methods:
 *   encode(lat, lon, precision?)  — Encode coordinates to geohash   (1c)
 *   decode(geohash)               — Decode geohash to coordinates   (1c)
 *   neighbors(geohash)            — Get adjacent geohashes          (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface EncodeInput { lat: number; lon: number; precision?: number }
interface DecodeInput { geohash: string }
interface NeighborsInput { geohash: string }

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

function encodeGeohash(lat: number, lon: number, precision: number): string {
  let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180
  let hash = '', bit = 0, ch = 0, isLon = true
  while (hash.length < precision) {
    if (isLon) {
      const mid = (minLon + maxLon) / 2
      if (lon >= mid) { ch |= (1 << (4 - bit)); minLon = mid } else { maxLon = mid }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat >= mid) { ch |= (1 << (4 - bit)); minLat = mid } else { maxLat = mid }
    }
    isLon = !isLon
    if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0 }
  }
  return hash
}

function decodeGeohash(hash: string): { lat: number; lon: number; lat_err: number; lon_err: number } {
  let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180, isLon = true
  for (const c of hash) {
    const idx = BASE32.indexOf(c)
    if (idx === -1) throw new Error(`Invalid geohash character: ${c}`)
    for (let bit = 4; bit >= 0; bit--) {
      if (isLon) {
        const mid = (minLon + maxLon) / 2
        if (idx & (1 << bit)) minLon = mid; else maxLon = mid
      } else {
        const mid = (minLat + maxLat) / 2
        if (idx & (1 << bit)) minLat = mid; else maxLat = mid
      }
      isLon = !isLon
    }
  }
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2, lat_err: (maxLat - minLat) / 2, lon_err: (maxLon - minLon) / 2 }
}

const PRECISION_TABLE = [
  { precision: 1, lat_error_km: 2500, lon_error_km: 5000, description: 'Continental' },
  { precision: 2, lat_error_km: 630, lon_error_km: 1250, description: 'Large region' },
  { precision: 3, lat_error_km: 78, lon_error_km: 156, description: 'Large city' },
  { precision: 4, lat_error_km: 20, lon_error_km: 39, description: 'Town' },
  { precision: 5, lat_error_km: 2.4, lon_error_km: 4.9, description: 'Neighborhood' },
  { precision: 6, lat_error_km: 0.61, lon_error_km: 1.2, description: 'Street' },
  { precision: 7, lat_error_km: 0.076, lon_error_km: 0.153, description: 'Building' },
  { precision: 8, lat_error_km: 0.019, lon_error_km: 0.038, description: 'Room' },
]

const sg = settlegrid.init({
  toolSlug: 'geohash-tools',
  pricing: { defaultCostCents: 1, methods: {
    encode: { costCents: 1, displayName: 'Encode Geohash' },
    decode: { costCents: 1, displayName: 'Decode Geohash' },
    neighbors: { costCents: 1, displayName: 'Get Neighbors' },
  }},
})

const encode = sg.wrap(async (args: EncodeInput) => {
  if (!Number.isFinite(args.lat) || !Number.isFinite(args.lon)) throw new Error('lat and lon required')
  if (args.lat < -90 || args.lat > 90) throw new Error('lat must be -90 to 90')
  if (args.lon < -180 || args.lon > 180) throw new Error('lon must be -180 to 180')
  const precision = Math.min(Math.max(args.precision ?? 6, 1), 12)
  const hash = encodeGeohash(args.lat, args.lon, precision)
  const precInfo = PRECISION_TABLE.find(p => p.precision === precision)
  return { geohash: hash, lat: args.lat, lon: args.lon, precision, accuracy: precInfo ?? null }
}, { method: 'encode' })

const decode = sg.wrap(async (args: DecodeInput) => {
  if (!args.geohash) throw new Error('geohash required')
  const result = decodeGeohash(args.geohash.toLowerCase())
  return { geohash: args.geohash, latitude: Math.round(result.lat * 1000000) / 1000000, longitude: Math.round(result.lon * 1000000) / 1000000, precision: args.geohash.length, error_lat: result.lat_err, error_lon: result.lon_err }
}, { method: 'decode' })

const neighbors = sg.wrap(async (args: NeighborsInput) => {
  if (!args.geohash) throw new Error('geohash required')
  const center = decodeGeohash(args.geohash.toLowerCase())
  const latStep = center.lat_err * 2
  const lonStep = center.lon_err * 2
  const precision = args.geohash.length
  const dirs: Record<string, [number, number]> = { n: [latStep, 0], s: [-latStep, 0], e: [0, lonStep], w: [0, -lonStep], ne: [latStep, lonStep], nw: [latStep, -lonStep], se: [-latStep, lonStep], sw: [-latStep, -lonStep] }
  const result: Record<string, string> = {}
  for (const [dir, [dLat, dLon]] of Object.entries(dirs)) {
    result[dir] = encodeGeohash(center.lat + dLat, center.lon + dLon, precision)
  }
  return { geohash: args.geohash, center: { lat: center.lat, lon: center.lon }, neighbors: result }
}, { method: 'neighbors' })

export { encode, decode, neighbors }
console.log('settlegrid-geohash-tools MCP server ready')
console.log('Methods: encode, decode, neighbors')
console.log('Pricing: 1c per call | Powered by SettleGrid')
