/**
 * settlegrid-fear-greed — Fear & Greed Index MCP Server
 *
 * Wraps the Fear & Greed Index API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_index()                              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndexInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.alternative.me'
const USER_AGENT = 'settlegrid-fear-greed/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Fear & Greed Index API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fear-greed',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_index: { costCents: 1, displayName: 'Get current Fear & Greed Index' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndex = sg.wrap(async (args: GetIndexInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/fng/', {
    params,
  })

  return data
}, { method: 'get_index' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndex }

console.log('settlegrid-fear-greed MCP server ready')
console.log('Methods: get_index')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
