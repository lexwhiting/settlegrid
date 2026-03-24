/**
 * settlegrid-ipinfo — IP Geolocation MCP Server
 *
 * Wraps the IPinfo API with SettleGrid billing.
 * Optional token for higher limits.
 *
 * Methods:
 *   lookup_ip(ip)    — Geolocate an IP address  (1¢)
 *   get_my_ip()      — Geolocate current IP     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupInput {
  ip: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const IPINFO_BASE = 'https://ipinfo.io'
const TOKEN = process.env.IPINFO_TOKEN || ''

async function ipFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`
  const res = await fetch(`${IPINFO_BASE}${path}`, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IPinfo API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ipinfo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_ip: { costCents: 1, displayName: 'Lookup IP' },
      get_my_ip: { costCents: 1, displayName: 'Get My IP' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupIp = sg.wrap(async (args: LookupInput) => {
  if (!args.ip || typeof args.ip !== 'string') {
    throw new Error('ip is required (IPv4 or IPv6 address)')
  }
  const ip = args.ip.trim()
  if (!/^[\d.:a-fA-F]+$/.test(ip)) {
    throw new Error('Invalid IP address format')
  }
  const data = await ipFetch<any>(`/${ip}/json`)
  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country,
    loc: data.loc,
    org: data.org,
    postal: data.postal,
    timezone: data.timezone,
    hostname: data.hostname,
  }
}, { method: 'lookup_ip' })

const getMyIp = sg.wrap(async () => {
  const data = await ipFetch<any>('/json')
  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country,
    loc: data.loc,
    org: data.org,
    timezone: data.timezone,
  }
}, { method: 'get_my_ip' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupIp, getMyIp }

console.log('settlegrid-ipinfo MCP server ready')
console.log('Methods: lookup_ip, get_my_ip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
