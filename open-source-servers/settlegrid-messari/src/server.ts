/**
 * settlegrid-messari — Messari MCP Server
 *
 * Wraps the Messari API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_asset(assetKey)                      (1¢)
 *   list_assets()                            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetAssetInput {
  assetKey: string
}

interface ListAssetsInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.messari.io/api/v1'
const USER_AGENT = 'settlegrid-messari/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Messari API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'messari',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_asset: { costCents: 1, displayName: 'Get asset profile and metrics' },
      list_assets: { costCents: 1, displayName: 'List all crypto assets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAsset = sg.wrap(async (args: GetAssetInput) => {
  if (!args.assetKey || typeof args.assetKey !== 'string') {
    throw new Error('assetKey is required (asset key (e.g. bitcoin, ethereum))')
  }

  const params: Record<string, string> = {}
  params['assetKey'] = String(args.assetKey)

  const data = await apiFetch<Record<string, unknown>>(`/assets/${encodeURIComponent(String(args.assetKey))}/metrics`, {
    params,
  })

  return data
}, { method: 'get_asset' })

const listAssets = sg.wrap(async (args: ListAssetsInput) => {

  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['limit'] = String(args.limit)

  const data = await apiFetch<Record<string, unknown>>('/assets', {
    params,
  })

  return data
}, { method: 'list_assets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAsset, listAssets }

console.log('settlegrid-messari MCP server ready')
console.log('Methods: get_asset, list_assets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
