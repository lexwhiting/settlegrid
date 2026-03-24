/**
 * settlegrid-zipcodeapi — US ZIP Code Data MCP Server
 *
 * Wraps the ZipCodeAPI with SettleGrid billing.
 * Requires a ZipCodeAPI key.
 *
 * Methods:
 *   get_zip_info(zip)          — ZIP code info       (2¢)
 *   get_distance(zip1, zip2)   — Distance between    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZipInput {
  zip: string
}

interface DistanceInput {
  zip1: string
  zip2: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ZIP_BASE = 'https://www.zipcodeapi.com/rest'
const API_KEY = process.env.ZIPCODE_API_KEY || ''

function validateZip(zip: string, field: string): string {
  const z = zip.trim()
  if (!/^\d{5}$/.test(z)) {
    throw new Error(`${field} must be a 5-digit US ZIP code`)
  }
  return z
}

async function zipFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('ZIPCODE_API_KEY environment variable is required')
  const res = await fetch(`${ZIP_BASE}/${API_KEY}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ZipCodeAPI ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'zipcodeapi',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_zip_info: { costCents: 2, displayName: 'ZIP Info' },
      get_distance: { costCents: 2, displayName: 'ZIP Distance' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getZipInfo = sg.wrap(async (args: ZipInput) => {
  const zip = validateZip(args.zip, 'zip')
  const data = await zipFetch<any>(`/info.json/${zip}/degrees`)
  return {
    zipCode: data.zip_code,
    lat: data.lat,
    lng: data.lng,
    city: data.city,
    state: data.state,
    timezone: data.timezone?.timezone_identifier,
    acceptable: data.acceptable_city_names || [],
  }
}, { method: 'get_zip_info' })

const getDistance = sg.wrap(async (args: DistanceInput) => {
  const z1 = validateZip(args.zip1, 'zip1')
  const z2 = validateZip(args.zip2, 'zip2')
  const data = await zipFetch<any>(`/distance.json/${z1}/${z2}/mile`)
  return {
    zip1: z1,
    zip2: z2,
    distanceMiles: data.distance,
    distanceKm: data.distance ? (data.distance * 1.60934).toFixed(2) : null,
  }
}, { method: 'get_distance' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getZipInfo, getDistance }

console.log('settlegrid-zipcodeapi MCP server ready')
console.log('Methods: get_zip_info, get_distance')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
