/**
 * settlegrid-can-i-use — Can I Use MCP Server
 *
 * Wraps the Can I Use API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_feature(feature)                     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFeatureInput {
  feature: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://raw.githubusercontent.com/nicedoc/browserl/main'
const USER_AGENT = 'settlegrid-can-i-use/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Can I Use API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'can-i-use',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_feature: { costCents: 1, displayName: 'Get browser compatibility for a feature' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFeature = sg.wrap(async (args: GetFeatureInput) => {
  if (!args.feature || typeof args.feature !== 'string') {
    throw new Error('feature is required (feature name (e.g. css-grid, flexbox, webgl))')
  }

  const params: Record<string, string> = {}
  params['feature'] = String(args.feature)

  const data = await apiFetch<Record<string, unknown>>(`/data/features/${encodeURIComponent(String(args.feature))}.json`, {
    params,
  })

  return data
}, { method: 'get_feature' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFeature }

console.log('settlegrid-can-i-use MCP server ready')
console.log('Methods: get_feature')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
