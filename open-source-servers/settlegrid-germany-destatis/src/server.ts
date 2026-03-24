/**
 * settlegrid-germany-destatis — German Statistics (DESTATIS) MCP Server
 *
 * Wraps DESTATIS GENESIS API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_tables(query)                   — Search tables (1¢)
 *   get_table(name)                        — Get table metadata (1¢)
 *   list_statistics()                      — List statistics (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTablesInput {
  query: string
}

interface GetTableInput {
  name: string
}

interface ListStatisticsInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www-genesis.destatis.de/genesisWS/rest/2020'
const USER_AGENT = 'settlegrid-germany-destatis/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  url.searchParams.set('username', 'GUEST')
  url.searchParams.set('password', '')
  url.searchParams.set('language', 'en')
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
    throw new Error(`DESTATIS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'germany-destatis',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_tables: { costCents: 1, displayName: 'Search DESTATIS tables' },
      get_table: { costCents: 1, displayName: 'Get table metadata' },
      list_statistics: { costCents: 1, displayName: 'List available statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/find/find', {
    params: { term: args.query, category: 'tables' },
  })
  return data
}, { method: 'search_tables' })

const getTable = sg.wrap(async (args: GetTableInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (table code)')
  }
  const data = await apiFetch<Record<string, unknown>>('/catalogue/tables', {
    params: { selection: args.name },
  })
  return data
}, { method: 'get_table' })

const listStatistics = sg.wrap(async (_args: ListStatisticsInput) => {
  const data = await apiFetch<Record<string, unknown>>('/catalogue/statistics')
  return data
}, { method: 'list_statistics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTables, getTable, listStatistics }

console.log('settlegrid-germany-destatis MCP server ready')
console.log('Methods: search_tables, get_table, list_statistics')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
