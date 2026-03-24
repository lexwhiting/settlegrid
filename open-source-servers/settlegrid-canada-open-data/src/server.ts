/**
 * settlegrid-canada-open-data — Canada Open Data MCP Server
 *
 * Wraps the Canada Open Data API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_datasets(q)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  q: string
  rows?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://open.canada.ca/data/api/3'
const USER_AGENT = 'settlegrid-canada-open-data/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Canada Open Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'canada-open-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Canadian open datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.rows !== undefined) params['rows'] = String(args.rows)

  const data = await apiFetch<Record<string, unknown>>('/action/package_search', {
    params,
  })

  return data
}, { method: 'search_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets }

console.log('settlegrid-canada-open-data MCP server ready')
console.log('Methods: search_datasets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
