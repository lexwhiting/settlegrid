/**
 * settlegrid-norway-ssb — Norwegian Statistics (SSB) MCP Server
 *
 * Wraps SSB (Statistics Norway) API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_subjects()                        — List subjects (1¢)
 *   get_table_info(tableId)                — Get table info (1¢)
 *   search_tables(query)                   — Search tables (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListSubjectsInput {}

interface GetTableInfoInput {
  tableId: string
}

interface SearchTablesInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.ssb.no/api/v0/en/table'
const USER_AGENT = 'settlegrid-norway-ssb/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  body?: unknown
} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : '/' + path}`
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SSB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'norway-ssb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_subjects: { costCents: 1, displayName: 'List SSB subjects' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      search_tables: { costCents: 1, displayName: 'Search SSB tables' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listSubjects = sg.wrap(async (_args: ListSubjectsInput) => {
  const data = await apiFetch<unknown[]>('https://data.ssb.no/api/v0/en/table/')
  return { subjects: data }
}, { method: 'list_subjects' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.tableId || typeof args.tableId !== 'string') {
    throw new Error('tableId is required')
  }
  const data = await apiFetch<unknown>(`/${args.tableId}`)
  return data
}, { method: 'get_table_info' })

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('https://data.ssb.no/api/v0/en/table/?query=' + encodeURIComponent(args.query))
  return { results: data }
}, { method: 'search_tables' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listSubjects, getTableInfo, searchTables }

console.log('settlegrid-norway-ssb MCP server ready')
console.log('Methods: list_subjects, get_table_info, search_tables')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
