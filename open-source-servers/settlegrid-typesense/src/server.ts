/**
 * settlegrid-typesense — Typesense Search Engine MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

// --- Input interfaces ---
interface ListCollectionsInput { limit?: number; offset?: number }
interface GetCollectionInput { collectionName: string }
interface CreateCollectionInput { name: string; fields: object[]; defaultSortingField?: string }
interface DeleteCollectionInput { collectionName: string }
interface SearchDocumentsInput {
  collectionName: string
  q: string
  queryBy: string
  filterBy?: string
  sortBy?: string
  page?: number
  perPage?: number
}
interface IndexDocumentInput { collectionName: string; document: object; action?: string }
interface DeleteDocumentsInput { collectionName: string; filterBy: string; batchSize?: number }
interface UpdateDocumentsInput { collectionName: string; filterBy: string; fields: object }

// --- Lazy config helpers ---
function getApiKey(): string {
  const k = process.env.TYPESENSE_API_KEY
  if (!k) throw new Error('TYPESENSE_API_KEY environment variable is required')
  return k
}

function getBaseUrl(): string {
  const protocol = process.env.TYPESENSE_PROTOCOL || 'http'
  const hostname = process.env.TYPESENSE_HOST || 'localhost'
  const port = process.env.TYPESENSE_PORT || '8108'
  return `${protocol}://${hostname}:${port}`
}

// --- Fetch helper ---
async function tsRequest(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<unknown> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  let url = `${base}${path}`
  if (queryParams && Object.keys(queryParams).length > 0) {
    const qs = new URLSearchParams(queryParams).toString()
    url += `?${qs}`
  }
  const headers: Record<string, string> = {
    'X-TYPESENSE-API-KEY': apiKey,
    'User-Agent': 'settlegrid-typesense/1.0',
    'Content-Type': 'application/json',
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Typesense API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// --- SettleGrid init ---
const sg = settlegrid.init({
  toolSlug: 'typesense',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_collections:  { costCents: 1, displayName: 'List Collections' },
      get_collection:    { costCents: 1, displayName: 'Get Collection' },
      create_collection: { costCents: 3, displayName: 'Create Collection' },
      delete_collection: { costCents: 5, displayName: 'Delete Collection' },
      search_documents:  { costCents: 2, displayName: 'Search Documents' },
      index_document:    { costCents: 2, displayName: 'Index Document' },
      delete_documents:  { costCents: 4, displayName: 'Delete Documents' },
      update_documents:  { costCents: 3, displayName: 'Update Documents' },
    },
  },
})

// --- Method implementations ---

const listCollections = sg.wrap(async (args: ListCollectionsInput) => {
  const limit = Math.min(args.limit || 20, 100)
  const params: Record<string, string> = { limit: String(limit) }
  if (args.offset !== undefined) params.offset = String(args.offset)
  return tsRequest('GET', '/collections', undefined, params)
}, { method: 'list_collections' })

const getCollection = sg.wrap(async (args: GetCollectionInput) => {
  const name = args.collectionName?.trim()
  if (!name) throw new Error('collectionName is required')
  return tsRequest('GET', `/collections/${encodeURIComponent(name)}`)
}, { method: 'get_collection' })

const createCollection = sg.wrap(async (args: CreateCollectionInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  if (!Array.isArray(args.fields) || args.fields.length === 0) {
    throw new Error('fields must be a non-empty array of field definitions')
  }
  const body: Record<string, unknown> = { name, fields: args.fields }
  if (args.defaultSortingField) body.default_sorting_field = args.defaultSortingField
  return tsRequest('POST', '/collections', body)
}, { method: 'create_collection' })

const deleteCollection = sg.wrap(async (args: DeleteCollectionInput) => {
  const name = args.collectionName?.trim()
  if (!name) throw new Error('collectionName is required')
  return tsRequest('DELETE', `/collections/${encodeURIComponent(name)}`)
}, { method: 'delete_collection' })

const searchDocuments = sg.wrap(async (args: SearchDocumentsInput) => {
  const name = args.collectionName?.trim()
  if (!name) throw new Error('collectionName is required')
  const q = args.q?.trim()
  if (!q) throw new Error('q (search query) is required')
  const queryBy = args.queryBy?.trim()
  if (!queryBy) throw new Error('queryBy is required')
  const perPage = Math.min(args.perPage || 10, 50)
  const page = Math.max(args.page || 1, 1)
  const params: Record<string, string> = {
    q: encodeURIComponent(q),
    query_by: queryBy,
    per_page: String(perPage),
    page: String(page),
  }
  if (args.filterBy) params.filter_by = args.filterBy
  if (args.sortBy) params.sort_by = args.sortBy
  return tsRequest('GET', `/collections/${encodeURIComponent(name)}/documents/search`, undefined, params)
}, { method: 'search_documents' })

const indexDocument = sg.wrap(async (args: IndexDocumentInput) => {
  const name = args.collectionName?.trim()
  if (!name) throw new Error('collectionName is required')
  if (!args.document || typeof args.document !== 'object') {
    throw new Error('document must be a valid object')
  }
  const validActions = ['create', 'upsert', 'update', 'emplace']
  const action = args.action && validActions.includes(args.action) ? args.action : 'create'
  return tsRequest('POST', `/collections/${encodeURIComponent(name)}/documents`, args.document, { action })
}, { method: 'index_document' })

const deleteDocuments = sg.wrap(async (args: DeleteDocumentsInput) => {
  const name = args.collectionName?.trim()
  if (!name) throw new Error('collectionName is required')
  const filterBy = args.filterBy?.trim()
  if (!filterBy) throw new Error('filterBy is required')
  const batchSize = Math.min(args.batchSize || 40, 1000)
  return tsRequest('DELETE', `/collections/${encodeURIComponent(name)}/documents`, undefined, {
    filter_by: filterBy,
    batch_size: String(batchSize),
  })
}, { method: 'delete_documents' })

const updateDocuments = sg.wrap(async (args: UpdateDocumentsInput) => {
  const name = args.collectionName?.trim()
  if (!name) throw new Error('collectionName is required')
  const filterBy = args.filterBy?.trim()
  if (!filterBy) throw new Error('filterBy is required')
  if (!args.fields || typeof args.fields !== 'object') {
    throw new Error('fields must be a valid object')
  }
  return tsRequest('PATCH', `/collections/${encodeURIComponent(name)}/documents`, args.fields, {
    filter_by: filterBy,
  })
}, { method: 'update_documents' })

export {
  listCollections,
  getCollection,
  createCollection,
  deleteCollection,
  searchDocuments,
  indexDocument,
  deleteDocuments,
  updateDocuments,
}

console.log('settlegrid-typesense MCP server ready')
console.log('Methods: list_collections, get_collection, create_collection, delete_collection, search_documents, index_document, delete_documents, update_documents')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')
