/**
 * settlegrid-sba — SBA (Small Business) MCP Server
 *
 * Wraps the SBA (Small Business) API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_data(viewId)                         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  viewId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.sba.gov/api/views'
const USER_AGENT = 'settlegrid-sba/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`SBA (Small Business) API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sba',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 1, displayName: 'Get SBA dataset by view ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.viewId || typeof args.viewId !== 'string') {
    throw new Error('viewId is required (sba dataset view id)')
  }

  const params: Record<string, string> = {}
  params['viewId'] = String(args.viewId)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.viewId))}/rows.json`, {
    params,
  })

  return data
}, { method: 'get_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData }

console.log('settlegrid-sba MCP server ready')
console.log('Methods: get_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
