/**
 * settlegrid-here — HERE Maps MCP Server
 *
 * Wraps the HERE Maps API with SettleGrid billing.
 * Requires HERE_API_KEY environment variable.
 *
 * Methods:
 *   geocode(q)                               (1¢)
 *   reverse_geocode(at)                      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  q: string
}

interface ReverseGeocodeInput {
  at: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://geocode.search.hereapi.com/v1'
const USER_AGENT = 'settlegrid-here/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.HERE_API_KEY
  if (!key) throw new Error('HERE_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('apiKey', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HERE Maps API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'here',
  pricing: {
    defaultCostCents: 1,
    methods: {
      geocode: { costCents: 1, displayName: 'Geocode an address' },
      reverse_geocode: { costCents: 1, displayName: 'Reverse geocode coordinates' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (address to geocode)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q

  const data = await apiFetch<Record<string, unknown>>('/geocode', {
    params,
  })

  return data
}, { method: 'geocode' })

const reverseGeocode = sg.wrap(async (args: ReverseGeocodeInput) => {
  if (!args.at || typeof args.at !== 'string') {
    throw new Error('at is required (coordinates as lat,lng)')
  }

  const params: Record<string, string> = {}
  params['at'] = args.at

  const data = await apiFetch<Record<string, unknown>>('/revgeocode', {
    params,
  })

  return data
}, { method: 'reverse_geocode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, reverseGeocode }

console.log('settlegrid-here MCP server ready')
console.log('Methods: geocode, reverse_geocode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
