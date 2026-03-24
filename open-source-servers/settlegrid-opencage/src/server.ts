/**
 * settlegrid-opencage — OpenCage MCP Server
 *
 * Wraps the OpenCage API with SettleGrid billing.
 * Requires OPENCAGE_API_KEY environment variable.
 *
 * Methods:
 *   geocode(q)                               (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  q: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.opencagedata.com/geocode/v1'
const USER_AGENT = 'settlegrid-opencage/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.OPENCAGE_API_KEY
  if (!key) throw new Error('OPENCAGE_API_KEY environment variable is required')
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
  url.searchParams.set('key', getApiKey())
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
    throw new Error(`OpenCage API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'opencage',
  pricing: {
    defaultCostCents: 1,
    methods: {
      geocode: { costCents: 1, displayName: 'Geocode an address to coordinates' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (address or place name)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/json', {
    params,
  })

  return data
}, { method: 'geocode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode }

console.log('settlegrid-opencage MCP server ready')
console.log('Methods: geocode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
