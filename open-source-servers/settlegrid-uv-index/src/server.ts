/**
 * settlegrid-uv-index — OpenUV MCP Server
 *
 * Wraps the OpenUV API with SettleGrid billing.
 * Requires OPENUV_API_KEY environment variable.
 *
 * Methods:
 *   get_uv(lat, lng)                         (1¢)
 *   get_protection(lat, lng)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetUvInput {
  lat: number
  lng: number
}

interface GetProtectionInput {
  lat: number
  lng: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.openuv.io/api/v1'
const USER_AGENT = 'settlegrid-uv-index/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.OPENUV_API_KEY
  if (!key) throw new Error('OPENUV_API_KEY environment variable is required')
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
    'x-access-token': `${getApiKey()}`,
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
    throw new Error(`OpenUV API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uv-index',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_uv: { costCents: 1, displayName: 'Get real-time UV index for coordinates' },
      get_protection: { costCents: 1, displayName: 'Get sun protection window times' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getUv = sg.wrap(async (args: GetUvInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lng !== 'number' || isNaN(args.lng)) {
    throw new Error('lng must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lng'] = String(args.lng)

  const data = await apiFetch<Record<string, unknown>>('/uv', {
    params,
  })

  return data
}, { method: 'get_uv' })

const getProtection = sg.wrap(async (args: GetProtectionInput) => {
  if (typeof args.lat !== 'number' || isNaN(args.lat)) {
    throw new Error('lat must be a number')
  }
  if (typeof args.lng !== 'number' || isNaN(args.lng)) {
    throw new Error('lng must be a number')
  }

  const params: Record<string, string> = {}
  params['lat'] = String(args.lat)
  params['lng'] = String(args.lng)

  const data = await apiFetch<Record<string, unknown>>('/protection', {
    params,
  })

  return data
}, { method: 'get_protection' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getUv, getProtection }

console.log('settlegrid-uv-index MCP server ready')
console.log('Methods: get_uv, get_protection')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
