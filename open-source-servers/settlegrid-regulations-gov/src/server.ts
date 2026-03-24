/**
 * settlegrid-regulations-gov — Regulations.gov MCP Server
 *
 * Wraps the Regulations.gov API with SettleGrid billing.
 * Requires REGULATIONS_GOV_API_KEY environment variable.
 *
 * Methods:
 *   search_documents(filter[searchTerm])     (2¢)
 *   get_document(documentId)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDocumentsInput {
  filter[searchTerm]: string
  page[size]?: number
}

interface GetDocumentInput {
  documentId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.regulations.gov/v4'
const USER_AGENT = 'settlegrid-regulations-gov/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.REGULATIONS_GOV_API_KEY
  if (!key) throw new Error('REGULATIONS_GOV_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('api_key', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Regulations.gov API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'regulations-gov',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_documents: { costCents: 2, displayName: 'Search federal regulatory documents' },
      get_document: { costCents: 1, displayName: 'Get a specific regulatory document' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDocuments = sg.wrap(async (args: SearchDocumentsInput) => {
  if (!args.filter[searchTerm] || typeof args.filter[searchTerm] !== 'string') {
    throw new Error('filter[searchTerm] is required (search term)')
  }

  const params: Record<string, string> = {}
  params['filter[searchTerm]'] = args.filter[searchTerm]
  if (args.page[size] !== undefined) params['page[size]'] = String(args.page[size])

  const data = await apiFetch<Record<string, unknown>>('/documents', {
    params,
  })

  return data
}, { method: 'search_documents' })

const getDocument = sg.wrap(async (args: GetDocumentInput) => {
  if (!args.documentId || typeof args.documentId !== 'string') {
    throw new Error('documentId is required (document id)')
  }

  const params: Record<string, string> = {}
  params['documentId'] = String(args.documentId)

  const data = await apiFetch<Record<string, unknown>>(`/documents/${encodeURIComponent(String(args.documentId))}`, {
    params,
  })

  return data
}, { method: 'get_document' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDocuments, getDocument }

console.log('settlegrid-regulations-gov MCP server ready')
console.log('Methods: search_documents, get_document')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
