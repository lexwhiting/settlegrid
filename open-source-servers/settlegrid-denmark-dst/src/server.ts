/**
 * settlegrid-denmark-dst — Danish Statistics (DST) MCP Server
 *
 * Wraps StatBank Denmark API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_subjects(subject_id?)             — List subjects (1¢)
 *   get_table_info(id)                     — Get table info (1¢)
 *   get_table_data(table, variables)       — Get data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListSubjectsInput {
  subject_id?: string
}

interface GetTableInfoInput {
  id: string
}

interface GetTableDataInput {
  table: string
  variables: Record<string, string[]>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.statbank.dk/v1'
const USER_AGENT = 'settlegrid-denmark-dst/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  body?: unknown
} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'POST', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
  }
  const res = await fetch(url, fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`StatBank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'denmark-dst',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_subjects: { costCents: 1, displayName: 'List subject areas' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      get_table_data: { costCents: 1, displayName: 'Get table data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listSubjects = sg.wrap(async (args: ListSubjectsInput) => {
  const body: Record<string, unknown> = { format: 'JSON', lang: 'en', recursive: false }
  if (args.subject_id) body['subjects'] = [args.subject_id]
  const data = await apiFetch<unknown[]>('/subjects', { body })
  return { subjects: data }
}, { method: 'list_subjects' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (table ID)')
  }
  const data = await apiFetch<unknown>('/tableinfo', { body: { table: args.id, format: 'JSON', lang: 'en' } })
  return data
}, { method: 'get_table_info' })

const getTableData = sg.wrap(async (args: GetTableDataInput) => {
  if (!args.table || typeof args.table !== 'string') {
    throw new Error('table is required (table ID)')
  }
  if (!args.variables || typeof args.variables !== 'object') {
    throw new Error('variables is required (variable selections)')
  }
  const vars = Object.entries(args.variables).map(([code, values]) => ({
    code,
    values: Array.isArray(values) ? values : [values],
  }))
  const body = { table: args.table, format: 'JSON', lang: 'en', variables: vars }
  const data = await apiFetch<unknown>('/data', { body })
  return data
}, { method: 'get_table_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listSubjects, getTableInfo, getTableData }

console.log('settlegrid-denmark-dst MCP server ready')
console.log('Methods: list_subjects, get_table_info, get_table_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
