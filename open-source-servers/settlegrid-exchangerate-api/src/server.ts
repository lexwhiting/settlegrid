/**
 * settlegrid-exchangerate-api — ExchangeRate-API MCP Server
 *
 * Wraps the ExchangeRate-API API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_latest(base)                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetLatestInput {
  base: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://open.er-api.com/v6'
const USER_AGENT = 'settlegrid-exchangerate-api/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`ExchangeRate-API API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'exchangerate-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest: { costCents: 1, displayName: 'Get latest exchange rates for a base currency' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: GetLatestInput) => {
  if (!args.base || typeof args.base !== 'string') {
    throw new Error('base is required (base currency code (e.g. usd))')
  }

  const params: Record<string, string> = {}
  params['base'] = String(args.base)

  const data = await apiFetch<Record<string, unknown>>(`/latest/${encodeURIComponent(String(args.base))}`, {
    params,
  })

  return data
}, { method: 'get_latest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest }

console.log('settlegrid-exchangerate-api MCP server ready')
console.log('Methods: get_latest')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
