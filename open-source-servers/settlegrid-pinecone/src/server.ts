/**
 * settlegrid-pinecone — Pinecone Vector Database MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface QueryVectorsInput {
  indexHost: string
  vector: number[]
  topK?: number
  namespace?: string
  includeMetadata?: boolean
}

interface GetIndexStatsInput {
  indexHost: string
  namespace?: string
}

interface FetchVectorsInput {
  indexHost: string
  ids: string[]
  namespace?: string
}

interface ListVectorsInput {
  indexHost: string
  namespace?: string
  prefix?: string
  limit?: number
  paginationToken?: string
}

interface DeleteVectorsInput {
  indexHost: string
  ids: string[]
  namespace?: string
}

interface StartBulkImportInput {
  indexHost: string
  uri: string
  errorMode?: string
}

interface ListBulkImportsInput {
  indexHost: string
  limit?: number
  paginationToken?: string
}

interface DescribeBulkImportInput {
  indexHost: string
  id: string
}

function getApiKey(): string {
  const k = process.env.PINECONE_API_KEY
  if (!k) throw new Error('PINECONE_API_KEY environment variable is required')
  return k
}

function buildBaseUrl(indexHost: string): string {
  const host = indexHost.trim()
  if (!host) throw new Error('indexHost is required')
  return host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host.replace(/\/$/, '')}`
}

async function pineconeGet(indexHost: string, path: string): Promise<unknown> {
  const apiKey = getApiKey()
  const base = buildBaseUrl(indexHost)
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-pinecone/1.0',
    },
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Pinecone API error ${res.status}: ${errText}`)
  }
  return res.json()
}

async function pineconePost(indexHost: string, path: string, body: unknown): Promise<unknown> {
  const apiKey = getApiKey()
  const base = buildBaseUrl(indexHost)
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-pinecone/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Pinecone API error ${res.status}: ${errText}`)
  }
  return res.json()
}

async function pineconeDelete(indexHost: string, path: string, body?: unknown): Promise<unknown> {
  const apiKey = getApiKey()
  const base = buildBaseUrl(indexHost)
  const res = await fetch(`${base}${path}`, {
    method: 'DELETE',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-pinecone/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Pinecone API error ${res.status}: ${errText}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'pinecone',
  pricing: {
    defaultCostCents: 1,
    methods: {
      query_vectors: { costCents: 2, displayName: 'Query Vectors' },
      get_index_stats: { costCents: 1, displayName: 'Get Index Stats' },
      fetch_vectors: { costCents: 1, displayName: 'Fetch Vectors' },
      list_vectors: { costCents: 1, displayName: 'List Vectors' },
      delete_vectors: { costCents: 2, displayName: 'Delete Vectors' },
      start_bulk_import: { costCents: 5, displayName: 'Start Bulk Import' },
      list_bulk_imports: { costCents: 1, displayName: 'List Bulk Imports' },
      describe_bulk_import: { costCents: 1, displayName: 'Describe Bulk Import' },
    },
  },
})

const queryVectors = sg.wrap(async (args: QueryVectorsInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  if (!Array.isArray(args.vector) || args.vector.length === 0) throw new Error('vector is required and must be a non-empty array')
  const topK = Math.min(args.topK || 10, 100)
  const body: Record<string, unknown> = {
    vector: args.vector,
    topK,
    includeMetadata: args.includeMetadata ?? false,
    includeValues: false,
  }
  if (args.namespace) body.namespace = args.namespace
  return pineconePost(args.indexHost, '/query', body)
}, { method: 'query_vectors' })

const getIndexStats = sg.wrap(async (args: GetIndexStatsInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  const body: Record<string, unknown> = {}
  if (args.namespace) body.filter = { namespace: args.namespace }
  return pineconePost(args.indexHost, '/describe_index_stats', body)
}, { method: 'get_index_stats' })

const fetchVectors = sg.wrap(async (args: FetchVectorsInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  if (!Array.isArray(args.ids) || args.ids.length === 0) throw new Error('ids is required and must be a non-empty array')
  const params = new URLSearchParams()
  for (const id of args.ids) params.append('ids', id)
  if (args.namespace) params.set('namespace', args.namespace)
  return pineconeGet(args.indexHost, `/vectors/fetch?${params.toString()}`)
}, { method: 'fetch_vectors' })

const listVectors = sg.wrap(async (args: ListVectorsInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  const params = new URLSearchParams()
  if (args.namespace) params.set('namespace', args.namespace)
  if (args.prefix) params.set('prefix', args.prefix)
  const limit = Math.min(args.limit || 100, 100)
  params.set('limit', String(limit))
  if (args.paginationToken) params.set('paginationToken', args.paginationToken)
  return pineconeGet(args.indexHost, `/vectors/list?${params.toString()}`)
}, { method: 'list_vectors' })

const deleteVectors = sg.wrap(async (args: DeleteVectorsInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  if (!Array.isArray(args.ids) || args.ids.length === 0) throw new Error('ids is required and must be a non-empty array')
  const body: Record<string, unknown> = { ids: args.ids }
  if (args.namespace) body.namespace = args.namespace
  return pineconePost(args.indexHost, '/vectors/delete', body)
}, { method: 'delete_vectors' })

const startBulkImport = sg.wrap(async (args: StartBulkImportInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  if (!args.uri?.trim()) throw new Error('uri is required')
  const validErrorModes = ['CONTINUE', 'ABORT']
  const errorMode = args.errorMode ? args.errorMode.toUpperCase() : 'CONTINUE'
  if (!validErrorModes.includes(errorMode)) throw new Error(`errorMode must be one of: ${validErrorModes.join(', ')}`)
  const body: Record<string, unknown> = {
    uri: args.uri.trim(),
    errorMode: { onError: errorMode },
  }
  return pineconePost(args.indexHost, '/bulk/imports', body)
}, { method: 'start_bulk_import' })

const listBulkImports = sg.wrap(async (args: ListBulkImportsInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  const params = new URLSearchParams()
  const limit = Math.min(args.limit || 100, 100)
  params.set('limit', String(limit))
  if (args.paginationToken) params.set('paginationToken', args.paginationToken)
  return pineconeGet(args.indexHost, `/bulk/imports?${params.toString()}`)
}, { method: 'list_bulk_imports' })

const describeBulkImport = sg.wrap(async (args: DescribeBulkImportInput) => {
  if (!args.indexHost?.trim()) throw new Error('indexHost is required')
  if (!args.id?.trim()) throw new Error('id is required')
  return pineconeGet(args.indexHost, `/bulk/imports/${encodeURIComponent(args.id.trim())}`)
}, { method: 'describe_bulk_import' })

export {
  queryVectors,
  getIndexStats,
  fetchVectors,
  listVectors,
  deleteVectors,
  startBulkImport,
  listBulkImports,
  describeBulkImport,
}

console.log('settlegrid-pinecone MCP server ready')
console.log('Methods: query_vectors, get_index_stats, fetch_vectors, list_vectors, delete_vectors, start_bulk_import, list_bulk_imports, describe_bulk_import')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')