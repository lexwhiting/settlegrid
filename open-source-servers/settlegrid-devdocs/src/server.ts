/**
 * settlegrid-devdocs — DevDocs MCP Server
 *
 * Wraps the DevDocs API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   list_docs()                              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListDocsInput {
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://devdocs.io/api'
const USER_AGENT = 'settlegrid-devdocs/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`DevDocs API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'devdocs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_docs: { costCents: 1, displayName: 'List all available documentation sets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listDocs = sg.wrap(async (args: ListDocsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/docs', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { count: items.length, results: items }
}, { method: 'list_docs' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listDocs }

console.log('settlegrid-devdocs MCP server ready')
console.log('Methods: list_docs')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
