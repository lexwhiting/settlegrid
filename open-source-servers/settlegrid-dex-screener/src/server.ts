/**
 * settlegrid-dex-screener — DEX Screener MCP Server
 *
 * Wraps the DEX Screener API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_pairs(q)                          (1¢)
 *   get_token_pairs(address)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPairsInput {
  q: string
}

interface GetTokenPairsInput {
  address: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dexscreener.com/latest/dex'
const USER_AGENT = 'settlegrid-dex-screener/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`DEX Screener API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dex-screener',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_pairs: { costCents: 1, displayName: 'Search for trading pairs by token name or address' },
      get_token_pairs: { costCents: 1, displayName: 'Get all pairs for a specific token address' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPairs = sg.wrap(async (args: SearchPairsInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query (token name or address))')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q

  const data = await apiFetch<Record<string, unknown>>('/search', {
    params,
  })

  return data
}, { method: 'search_pairs' })

const getTokenPairs = sg.wrap(async (args: GetTokenPairsInput) => {
  if (!args.address || typeof args.address !== 'string') {
    throw new Error('address is required (token contract address)')
  }

  const params: Record<string, string> = {}
  params['address'] = String(args.address)

  const data = await apiFetch<Record<string, unknown>>(`/tokens/${encodeURIComponent(String(args.address))}`, {
    params,
  })

  return data
}, { method: 'get_token_pairs' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPairs, getTokenPairs }

console.log('settlegrid-dex-screener MCP server ready')
console.log('Methods: search_pairs, get_token_pairs')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
