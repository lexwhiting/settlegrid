/**
 * settlegrid-chemspider — ChemSpider MCP Server
 *
 * Wraps the ChemSpider API with SettleGrid billing.
 * Requires CHEMSPIDER_API_KEY environment variable.
 *
 * Methods:
 *   search(name)                             (2¢)
 *   get_details(recordId)                    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  name: string
}

interface GetDetailsInput {
  recordId: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.rsc.org'
const USER_AGENT = 'settlegrid-chemspider/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.CHEMSPIDER_API_KEY
  if (!key) throw new Error('CHEMSPIDER_API_KEY environment variable is required')
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
    'apikey': `${getApiKey()}`,
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
    throw new Error(`ChemSpider API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chemspider',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search: { costCents: 2, displayName: 'Search for chemical compounds' },
      get_details: { costCents: 1, displayName: 'Get compound details by record ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (chemical compound name)')
  }

  const body: Record<string, unknown> = {}
  body['name'] = args.name

  const data = await apiFetch<Record<string, unknown>>('/compounds/v1/filter/name', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'search' })

const getDetails = sg.wrap(async (args: GetDetailsInput) => {
  if (typeof args.recordId !== 'number' || isNaN(args.recordId)) {
    throw new Error('recordId must be a number')
  }

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>(`/compounds/v1/records/${encodeURIComponent(String(args.recordId))}/details`, {
    params,
  })

  return data
}, { method: 'get_details' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { search, getDetails }

console.log('settlegrid-chemspider MCP server ready')
console.log('Methods: search, get_details')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
