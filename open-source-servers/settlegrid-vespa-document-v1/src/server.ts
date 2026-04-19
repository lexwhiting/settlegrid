/**
 * settlegrid-vespa-document-v1 — Vespa Document API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

// ---------------------------------------------------------------------------
// Config helper — read at call time, not at module load
// ---------------------------------------------------------------------------
function getBaseUrl(): string {
  return process.env.VESPA_BASE_URL || 'http://localhost:8080'
}

// ---------------------------------------------------------------------------
// Input interfaces
// ---------------------------------------------------------------------------
interface GetDocumentInput {
  namespace: string
  documentType: string
  documentId: string
  fieldSet?: string
  cluster?: string
}

interface PutDocumentInput {
  namespace: string
  documentType: string
  documentId: string
  fields: Record<string, unknown>
  cluster?: string
  condition?: string
}

interface UpdateDocumentInput {
  namespace: string
  documentType: string
  documentId: string
  fields: Record<string, unknown>
  create?: boolean
  cluster?: string
  condition?: string
}

interface DeleteDocumentInput {
  namespace: string
  documentType: string
  documentId: string
  cluster?: string
  condition?: string
}

interface VisitDocumentsInput {
  namespace: string
  documentType: string
  wantedDocumentCount?: number
  selection?: string
  continuation?: string
  fieldSet?: string
  cluster?: string
}

interface VisitAllDocumentsInput {
  cluster: string
  wantedDocumentCount?: number
  selection?: string
  continuation?: string
  fieldSet?: string
}

interface DeleteBySelectionInput {
  namespace: string
  documentType: string
  selection: string
  cluster?: string
}

interface VisitGroupDocumentsInput {
  namespace: string
  documentType: string
  group: string
  wantedDocumentCount?: number
  selection?: string
  continuation?: string
  fieldSet?: string
  cluster?: string
}

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------
async function vespaFetch(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined> } = {}
): Promise<unknown> {
  const base = getBaseUrl()
  const url = new URL(path, base)
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v))
      }
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': 'settlegrid-vespa-document-v1/1.0',
    'Content-Type': 'application/json',
  }
  const init: RequestInit = {
    method: options.method || 'GET',
    headers,
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  const res = await fetch(url.toString(), init)
  if (!res.ok) {
    const text = (await res.text()).slice(0, 400)
    throw new Error(`Vespa API ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

function enc(s: string): string {
  return encodeURIComponent(s)
}

// ---------------------------------------------------------------------------
// SettleGrid init
// ---------------------------------------------------------------------------
const sg = settlegrid.init({
  toolSlug: 'vespa-document-v1',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_document:               { costCents: 1, displayName: 'Get Document' },
      put_document:               { costCents: 3, displayName: 'Put Document' },
      update_document:            { costCents: 3, displayName: 'Update Document' },
      delete_document:            { costCents: 2, displayName: 'Delete Document' },
      visit_documents:            { costCents: 2, displayName: 'Visit Documents' },
      visit_all_documents:        { costCents: 2, displayName: 'Visit All Documents' },
      delete_documents_by_selection: { costCents: 5, displayName: 'Delete Documents By Selection' },
      visit_group_documents:      { costCents: 2, displayName: 'Visit Group Documents' },
    },
  },
})

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
const getDocument = sg.wrap(async (args: GetDocumentInput) => {
  if (!args.namespace) throw new Error('namespace is required')
  if (!args.documentType) throw new Error('documentType is required')
  if (!args.documentId) throw new Error('documentId is required')
  return vespaFetch(
    `/document/v1/${enc(args.namespace)}/${enc(args.documentType)}/docid/${enc(args.documentId)}`,
    {
      query: {
        fieldSet: args.fieldSet,
        cluster: args.cluster,
      },
    }
  )
}, { method: 'get_document' })

const putDocument = sg.wrap(async (args: PutDocumentInput) => {
  if (!args.namespace) throw new Error('namespace is required')
  if (!args.documentType) throw new Error('documentType is required')
  if (!args.documentId) throw new Error('documentId is required')
  if (!args.fields || typeof args.fields !== 'object') throw new Error('fields must be a non-null object')
  return vespaFetch(
    `/document/v1/${enc(args.namespace)}/${enc(args.documentType)}/docid/${enc(args.documentId)}`,
    {
      method: 'POST',
      body: { fields: args.fields },
      query: {
        cluster: args.cluster,
        condition: args.condition,
      },
    }
  )
}, { method: 'put_document' })

const updateDocument = sg.wrap(async (args: UpdateDocumentInput) => {
  if (!args.namespace) throw new Error('namespace is required')
  if (!args.documentType) throw new Error('documentType is required')
  if (!args.documentId) throw new Error('documentId is required')
  if (!args.fields || typeof args.fields !== 'object') throw new Error('fields must be a non-null object')
  return vespaFetch(
    `/document/v1/${enc(args.namespace)}/${enc(args.documentType)}/docid/${enc(args.documentId)}`,
    {
      method: 'PUT',
      body: { fields: args.fields },
      query: {
        cluster: args.cluster,
        condition: args.condition,
        create: args.create,
      },
    }
  )
}, { method: 'update_document' })

const deleteDocument = sg.wrap(async (args: DeleteDocumentInput) => {
  if (!args.namespace) throw new Error('namespace is required')
  if (!args.documentType) throw new Error('documentType is required')
  if (!args.documentId) throw new Error('documentId is required')
  return vespaFetch(
    `/document/v1/${enc(args.namespace)}/${enc(args.documentType)}/docid/${enc(args.documentId)}`,
    {
      method: 'DELETE',
      query: {
        cluster: args.cluster,
        condition: args.condition,
      },
    }
  )
}, { method: 'delete_document' })

const visitDocuments = sg.wrap(async (args: VisitDocumentsInput) => {
  if (!args.namespace) throw new Error('namespace is required')
  if (!args.documentType) throw new Error('documentType is required')
  const count = args.wantedDocumentCount ? Math.min(args.wantedDocumentCount, 500) : undefined
  return vespaFetch(
    `/document/v1/${enc(args.namespace)}/${enc(args.documentType)}/docid/`,
    {
      query: {
        cluster: args.cluster,
        continuation: args.continuation,
        wantedDocumentCount: count,
        fieldSet: args.fieldSet,
        selection: args.selection,
      },
    }
  )
}, { method: 'visit_documents' })

const visitAllDocuments = sg.wrap(async (args: VisitAllDocumentsInput) => {
  if (!args.cluster) throw new Error('cluster is required')
  const count = args.wantedDocumentCount ? Math.min(args.wantedDocumentCount, 500) : undefined
  return vespaFetch(
    `/document/v1/`,
    {
      query: {
        cluster: args.cluster,
        continuation: args.continuation,
        wantedDocumentCount: count,
        fieldSet: args.fieldSet,
        selection: args.selection,
      },
    }
  )
}, { method: 'visit_all_documents' })

const deleteDocumentsBySelection = sg.wrap(async (args: DeleteBySelectionInput) => {
  if (!args.namespace) throw new Error('namespace is required')
  if (!args.documentType) throw new Error('documentType is required')
  if (!args.selection) throw new Error('selection is required')
  return vespaFetch(
    `/document/v1/${enc(args.namespace)}/${enc(args.documentType)}/docid/`,
    {
      method: 'DELETE',
      query: {
        cluster: args.cluster,
        selection: args.selection,
      },
    }
  )
}, { method: 'delete_documents_by_selection' })

const visitGroupDocuments = sg.wrap(async (args: VisitGroupDocumentsInput) => {
  if (!args.namespace) throw new Error('namespace is required')
  if (!args.documentType) throw new Error('documentType is required')
  if (!args.group) throw new Error('group is required')
  const count = args.wantedDocumentCount ? Math.min(args.wantedDocumentCount, 500) : undefined
  return vespaFetch(
    `/document/v1/${enc(args.namespace)}/${enc(args.documentType)}/group/${enc(args.group)}/`,
    {
      query: {
        cluster: args.cluster,
        continuation: args.continuation,
        wantedDocumentCount: count,
        fieldSet: args.fieldSet,
        selection: args.selection,
      },
    }
  )
}, { method: 'visit_group_documents' })

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  getDocument,
  putDocument,
  updateDocument,
  deleteDocument,
  visitDocuments,
  visitAllDocuments,
  deleteDocumentsBySelection,
  visitGroupDocuments,
}

console.log('settlegrid-vespa-document-v1 MCP server ready')
console.log('Methods: get_document, put_document, update_document, delete_document, visit_documents, visit_all_documents, delete_documents_by_selection, visit_group_documents')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')
