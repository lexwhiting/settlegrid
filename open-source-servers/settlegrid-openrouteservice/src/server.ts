/**
 * settlegrid-openrouteservice — OpenRouteService MCP Server
 *
 * Wraps the OpenRouteService API with SettleGrid billing.
 * Requires ORS_API_KEY environment variable.
 *
 * Methods:
 *   get_directions(profile, start, end)      (2¢)
 *   geocode(text)                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDirectionsInput {
  profile: string
  start: string
  end: string
}

interface GeocodeInput {
  text: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.openrouteservice.org'
const USER_AGENT = 'settlegrid-openrouteservice/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.ORS_API_KEY
  if (!key) throw new Error('ORS_API_KEY environment variable is required')
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
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Authorization': `${getApiKey()}`,
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
    throw new Error(`OpenRouteService API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openrouteservice',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_directions: { costCents: 2, displayName: 'Get driving/walking/cycling directions' },
      geocode: { costCents: 1, displayName: 'Geocode an address' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDirections = sg.wrap(async (args: GetDirectionsInput) => {
  if (!args.profile || typeof args.profile !== 'string') {
    throw new Error('profile is required (profile: driving-car, foot-walking, cycling-regular)')
  }
  if (!args.start || typeof args.start !== 'string') {
    throw new Error('start is required (start coordinates as lon,lat)')
  }
  if (!args.end || typeof args.end !== 'string') {
    throw new Error('end is required (end coordinates as lon,lat)')
  }

  const params: Record<string, string> = {}
  params['start'] = args.start
  params['end'] = args.end

  const data = await apiFetch<Record<string, unknown>>(`/v2/directions/${encodeURIComponent(String(args.profile))}`, {
    params,
  })

  return data
}, { method: 'get_directions' })

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required (address to geocode)')
  }

  const params: Record<string, string> = {}
  params['text'] = args.text

  const data = await apiFetch<Record<string, unknown>>('/geocode/search', {
    params,
  })

  return data
}, { method: 'geocode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDirections, geocode }

console.log('settlegrid-openrouteservice MCP server ready')
console.log('Methods: get_directions, geocode')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
