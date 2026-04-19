/**
 * settlegrid-lancedb — LanceDB MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.lancedb.com'

interface DescribeTableInput { table_name: string }
interface SearchVectorsInput { table_name: string; vector: number[]; limit?: number; filter?: string }
interface QueryTableInput { table_name: string; filter?: string; limit?: number }
interface InsertRecordsInput { table_name: string; records: object[] }
interface UpdateRecordsInput { table_name: string; filter: string; updates: object }
interface DeleteRecordsInput { table_name: string; filter: string }
interface ListIndexesInput { table_name: string }

function getApiKey(): string {
  const k = process.env.LANCEDB_API_KEY
  if (!k) throw new Error('LANCEDB_API_KEY environment variable is required')
  return k
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'User-Agent': 'settlegrid-lancedb/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`LanceDB API ${res.status}: ${body.slice(0, 300)}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

const sg = settlegrid.init({
  toolSlug: 'lancedb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_tables: { costCents: 1, displayName: 'List Tables' },
      describe_table: { costCents: 1, displayName: 'Describe Table' },
      search_vectors: { costCents: 3, displayName: 'Vector Search' },
      query_table: { costCents: 2, displayName: 'Query Table' },
      insert_records: { costCents: 3, displayName: 'Insert Records' },
      update_records: { costCents: 3, displayName: 'Update Records' },
      delete_records: { costCents: 3, displayName: 'Delete Records' },
      list_indexes: { costCents: 1, displayName: 'List Indexes' },
    },
  },
})

const listTables = sg.wrap(async () => {
  const data = await apiFetch('/v1/table') as { tables?: string[] }
  return { tables: data.tables ?? data, count: Array.isArray(data.tables) ? data.tables.length : (Array.isArray(data) ? (data as unknown[]).length : 0) }
}, { method: 'list_tables' })

const describeTable = sg.wrap(async (args: DescribeTableInput) => {
  const name = args.table_name?.trim()
  if (!name) throw new Error('table_name is required')
  return apiFetch(`/v1/table/${encodeURIComponent(name)}/describe`, { method: 'POST' })
}, { method: 'describe_table' })

const searchVectors = sg.wrap(async (args: SearchVectorsInput) => {
  const name = args.table_name?.trim()
  if (!name) throw new Error('table_name is required')
  if (!Array.isArray(args.vector) || args.vector.length === 0) throw new Error('vector must be a non-empty array of numbers')
  const limit = Math.min(args.limit || 10, 100)
  const body: Record<string, unknown> = { vector: args.vector, limit }
  if (args.filter) body.filter = args.filter
  return apiFetch(`/v1/table/${encodeURIComponent(name)}/search`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'search_vectors' })

const queryTable = sg.wrap(async (args: QueryTableInput) => {
  const name = args.table_name?.trim()
  if (!name) throw new Error('table_name is required')
  const limit = Math.min(args.limit || 20, 100)
  const body: Record<string, unknown> = { limit }
  if (args.filter) body.filter = args.filter
  return apiFetch(`/v1/table/${encodeURIComponent(name)}/query`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'query_table' })

const insertRecords = sg.wrap(async (args: InsertRecordsInput) => {
  const name = args.table_name?.trim()
  if (!name) throw new Error('table_name is required')
  if (!Array.isArray(args.records) || args.records.length === 0) throw new Error('records must be a non-empty array')
  return apiFetch(`/v1/table/${encodeURIComponent(name)}/insert`, {
    method: 'POST',
    body: JSON.stringify({ data: args.records }),
  })
}, { method: 'insert_records' })

const updateRecords = sg.wrap(async (args: UpdateRecordsInput) => {
  const name = args.table_name?.trim()
  if (!name) throw new Error('table_name is required')
  if (!args.filter?.trim()) throw new Error('filter is required')
  if (!args.updates || typeof args.updates !== 'object') throw new Error('updates must be an object')
  return apiFetch(`/v1/table/${encodeURIComponent(name)}/update`, {
    method: 'POST',
    body: JSON.stringify({ filter: args.filter, updates: args.updates }),
  })
}, { method: 'update_records' })

const deleteRecords = sg.wrap(async (args: DeleteRecordsInput) => {
  const name = args.table_name?.trim()
  if (!name) throw new Error('table_name is required')
  if (!args.filter?.trim()) throw new Error('filter is required')
  return apiFetch(`/v1/table/${encodeURIComponent(name)}/delete`, {
    method: 'POST',
    body: JSON.stringify({ filter: args.filter }),
  })
}, { method: 'delete_records' })

const listIndexes = sg.wrap(async (args: ListIndexesInput) => {
  const name = args.table_name?.trim()
  if (!name) throw new Error('table_name is required')
  return apiFetch(`/v1/table/${encodeURIComponent(name)}/index/list`)
}, { method: 'list_indexes' })

export { listTables, describeTable, searchVectors, queryTable, insertRecords, updateRecords, deleteRecords, listIndexes }
console.log('settlegrid-lancedb MCP server ready')
console.log('Methods: list_tables, describe_table, search_vectors, query_table, insert_records, update_records, delete_records, list_indexes')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')