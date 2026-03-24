/**
 * settlegrid-ip-geolocation — IP Geolocation MCP Server
 *
 * Wraps the free ip-api.com service with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   lookup(ip)                — Geolocate a single IP address   (1¢)
 *   lookup_batch(ips)         — Geolocate multiple IPs at once  (1¢/ip)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupInput {
  ip: string
}

interface BatchLookupInput {
  ips: string[]
}

interface IpApiResponse {
  status: string
  message?: string
  country: string
  countryCode: string
  region: string
  regionName: string
  city: string
  zip: string
  lat: number
  lon: number
  timezone: string
  isp: string
  org: string
  as: string
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

function validateIp(ip: string): string {
  const trimmed = ip.trim()
  if (!IPV4_REGEX.test(trimmed) && !IPV6_REGEX.test(trimmed)) {
    throw new Error(`Invalid IP address: "${ip}". Provide a valid IPv4 or IPv6 address.`)
  }
  return trimmed
}

function formatResult(data: IpApiResponse) {
  if (data.status === 'fail') {
    throw new Error(`Lookup failed for ${data.query}: ${data.message ?? 'unknown error'}`)
  }
  return {
    ip: data.query,
    country: data.country,
    countryCode: data.countryCode,
    region: data.regionName,
    regionCode: data.region,
    city: data.city,
    zip: data.zip,
    coordinates: { lat: data.lat, lon: data.lon },
    timezone: data.timezone,
    isp: data.isp,
    organization: data.org,
    asn: data.as,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ip-geolocation',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup: { costCents: 1, displayName: 'IP Lookup' },
      lookup_batch: { costCents: 1, displayName: 'Batch IP Lookup (per IP)' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookup = sg.wrap(async (args: LookupInput) => {
  if (!args.ip || typeof args.ip !== 'string') {
    throw new Error('ip is required (e.g. "8.8.8.8")')
  }
  const ip = validateIp(args.ip)

  const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`)
  if (!res.ok) {
    throw new Error(`ip-api.com returned ${res.status}`)
  }
  const data = await res.json() as IpApiResponse

  return formatResult(data)
}, { method: 'lookup' })

const lookupBatch = sg.wrap(async (args: BatchLookupInput) => {
  if (!Array.isArray(args.ips) || args.ips.length === 0) {
    throw new Error('ips must be a non-empty array of IP addresses')
  }
  if (args.ips.length > 100) {
    throw new Error('Maximum 100 IPs per batch request')
  }

  const validIps = args.ips.map((ip, i) => {
    if (typeof ip !== 'string') throw new Error(`ips[${i}] must be a string`)
    return validateIp(ip)
  })

  // ip-api.com supports batch POST requests
  const res = await fetch('http://ip-api.com/batch?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validIps),
  })

  if (!res.ok) {
    throw new Error(`ip-api.com batch returned ${res.status}`)
  }
  const results = await res.json() as IpApiResponse[]

  return {
    count: results.length,
    results: results.map((data) => {
      if (data.status === 'fail') {
        return { ip: data.query, error: data.message ?? 'lookup failed' }
      }
      return formatResult(data)
    }),
  }
}, { method: 'lookup_batch' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookup, lookupBatch }

// ─── REST Alternative (uncomment to serve as HTTP) ──────────────────────────
//
// import { settlegridMiddleware } from '@settlegrid/mcp'
// const middleware = settlegridMiddleware({
//   toolSlug: 'ip-geolocation',
//   pricing: { defaultCostCents: 1 },
//   routes: { ... },
// })

console.log('settlegrid-ip-geolocation MCP server ready')
console.log('Methods: lookup, lookup_batch')
console.log('Pricing: 1¢ per IP | Powered by SettleGrid')
