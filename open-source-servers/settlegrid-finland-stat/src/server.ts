/**
 * settlegrid-finland-stat — Finnish Statistics MCP Server
 *
 * Wraps Statistics Finland PXWeb API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_databases()                       — List databases (1¢)
 *   get_table_info(path)                   — Get table info (1¢)
 *   search_tables(query)                   — Search tables (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListDatabasesInput {}

interface GetTableInfoInput {
  path: string
}

interface SearchTablesInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin'
const USER_AGENT = 'settlegrid-finland-stat/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : '/' + path}`
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Statistics Finland API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'finland-stat',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_databases: { costCents: 1, displayName: 'List database hierarchy' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      search_tables: { costCents: 1, displayName: 'Search statistical tables' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listDatabases = sg.wrap(async (_args: ListDatabasesInput) => {
  const data = await apiFetch<unknown[]>('/')
  return { databases: data }
}, { method: 'list_databases' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.path || typeof args.path !== 'string') {
    throw new Error('path is required (table path)')
  }
  const data = await apiFetch<unknown>(`/${args.path}`)
  return data
}, { method: 'get_table_info' })

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/')
  const items = Array.isArray(data) ? data.filter((d) => {
    const s = JSON.stringify(d).toLowerCase()
    return s.includes(args.query.toLowerCase())
  }) : []
  return { results: items, query: args.query }
}, { method: 'search_tables' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listDatabases, getTableInfo, searchTables }

console.log('settlegrid-finland-stat MCP server ready')
console.log('Methods: list_databases, get_table_info, search_tables')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
