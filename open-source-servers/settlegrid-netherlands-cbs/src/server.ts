/**
 * settlegrid-netherlands-cbs — Dutch Statistics (CBS) MCP Server
 *
 * Wraps CBS OData v4 API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_tables(query)                   — Search tables (1¢)
 *   get_table_data(identifier, limit?)     — Get table data (1¢)
 *   list_themes()                          — List themes (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTablesInput {
  query: string
}

interface GetTableDataInput {
  identifier: string
  limit?: number
}

interface ListThemesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://odata4.cbs.nl/CBS'
const USER_AGENT = 'settlegrid-netherlands-cbs/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CBS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'netherlands-cbs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_tables: { costCents: 1, displayName: 'Search CBS tables' },
      get_table_data: { costCents: 1, displayName: 'Get table data' },
      list_themes: { costCents: 1, displayName: 'List statistical themes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/Datasets', {
    params: { '\$filter': `contains(Title,'\${args.query}')` },
  })
  return data
}, { method: 'search_tables' })

const getTableData = sg.wrap(async (args: GetTableDataInput) => {
  if (!args.identifier || typeof args.identifier !== 'string') {
    throw new Error('identifier is required (table ID)')
  }
  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['\$top'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(args.identifier)}/Observations`, { params })
  return data
}, { method: 'get_table_data' })

const listThemes = sg.wrap(async (_args: ListThemesInput) => {
  const data = await apiFetch<Record<string, unknown>>('/Themes')
  return data
}, { method: 'list_themes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTables, getTableData, listThemes }

console.log('settlegrid-netherlands-cbs MCP server ready')
console.log('Methods: search_tables, get_table_data, list_themes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
