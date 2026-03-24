/**
 * settlegrid-coinstats — CoinStats MCP Server
 *
 * Wraps the CoinStats API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_coins()                              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCoinsInput {
  limit?: number
  currency?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.coinstats.app/public/v1'
const USER_AGENT = 'settlegrid-coinstats/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`CoinStats API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coinstats',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_coins: { costCents: 1, displayName: 'Get list of cryptocurrencies with prices' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCoins = sg.wrap(async (args: GetCoinsInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  if (args.currency !== undefined) params['currency'] = String(args.currency)

  const data = await apiFetch<Record<string, unknown>>('/coins', {
    params,
  })

  return data
}, { method: 'get_coins' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCoins }

console.log('settlegrid-coinstats MCP server ready')
console.log('Methods: get_coins')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
