/**
 * settlegrid-india-data — India Open Data MCP Server
 *
 * Wraps the India Open Data API with SettleGrid billing.
 * Requires INDIA_DATA_API_KEY environment variable.
 *
 * Methods:
 *   get_resource(resourceId)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetResourceInput {
  resourceId: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.data.gov.in/resource'
const USER_AGENT = 'settlegrid-india-data/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.INDIA_DATA_API_KEY
  if (!key) throw new Error('INDIA_DATA_API_KEY environment variable is required')
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
  url.searchParams.set('api-key', getApiKey())
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
    throw new Error(`India Open Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'india-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_resource: { costCents: 1, displayName: 'Get data from a specific resource' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getResource = sg.wrap(async (args: GetResourceInput) => {
  if (!args.resourceId || typeof args.resourceId !== 'string') {
    throw new Error('resourceId is required (resource id from data.gov.in)')
  }

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.resourceId))}`, {
    params,
  })

  return data
}, { method: 'get_resource' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getResource }

console.log('settlegrid-india-data MCP server ready')
console.log('Methods: get_resource')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
