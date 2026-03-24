/**
 * settlegrid-sweden-scb — Swedish Statistics (SCB) MCP Server
 *
 * Wraps SCB (Statistics Sweden) API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_subjects()                        — List subjects (1¢)
 *   get_table_info(path)                   — Get table info (1¢)
 *   get_table_data(path)                   — Get table data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListSubjectsInput {}

interface GetTableInfoInput {
  path: string
}

interface GetTableDataInput {
  path: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.scb.se/OV0104/v1/doris/en/ssd'
const USER_AGENT = 'settlegrid-sweden-scb/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`SCB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sweden-scb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_subjects: { costCents: 1, displayName: 'List statistical subjects' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      get_table_data: { costCents: 1, displayName: 'Get table data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listSubjects = sg.wrap(async (_args: ListSubjectsInput) => {
  const data = await apiFetch<unknown[]>('/')
  return { subjects: data }
}, { method: 'list_subjects' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.path || typeof args.path !== 'string') {
    throw new Error('path is required (table path in hierarchy)')
  }
  const data = await apiFetch<unknown>(`/${args.path}`)
  return data
}, { method: 'get_table_info' })

const getTableData = sg.wrap(async (args: GetTableDataInput) => {
  if (!args.path || typeof args.path !== 'string') {
    throw new Error('path is required (table path)')
  }
  const info = await apiFetch<{ variables?: unknown[] }>(`/${args.path}`)
  const query = { query: [], response: { format: 'json' } }
  const data = await apiFetch<unknown>(`/${args.path}`, { method: 'POST', body: query })
  return data
}, { method: 'get_table_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listSubjects, getTableInfo, getTableData }

console.log('settlegrid-sweden-scb MCP server ready')
console.log('Methods: list_subjects, get_table_info, get_table_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
