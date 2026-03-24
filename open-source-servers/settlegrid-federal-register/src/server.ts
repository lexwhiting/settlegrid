/**
 * settlegrid-federal-register — Federal Register MCP Server
 * Wraps the Federal Register API with SettleGrid billing.
 *
 * Provides full-text search and retrieval of Federal Register
 * documents including rules, proposed rules, notices, and
 * presidential documents.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FRDocument {
  document_number: string
  title: string
  type: string
  abstract: string
  citation: string
  publication_date: string
  agencies: { name: string; slug: string }[]
  html_url: string
  pdf_url: string
  page_length: number
}

interface FRSearchResult {
  count: number
  total_pages: number
  results: FRDocument[]
}

interface FRDocumentDetail extends FRDocument {
  body_html_url: string
  full_text_xml_url: string
  raw_text_url: string
  action: string
  dates: string
  effective_on: string | null
  significant: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.federalregister.gov/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Federal Register API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const VALID_TYPES = ['rule', 'proposed_rule', 'notice', 'presidential_document']

function validateType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (!VALID_TYPES.includes(lower)) {
    throw new Error(`Invalid document type: ${type}. Valid: ${VALID_TYPES.join(', ')}`)
  }
  return lower
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'federal-register',
  pricing: { defaultCostCents: 1, methods: { search_documents: 1, get_document: 1, get_recent: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchDocuments = sg.wrap(async (args: { query: string; type?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({
    'conditions[term]': q,
    per_page: String(lim),
  })
  if (args.type) params.set('conditions[type][]', validateType(args.type))
  return apiFetch<FRSearchResult>(`/documents.json?${params}`)
}, { method: 'search_documents' })

const getDocument = sg.wrap(async (args: { number: string }) => {
  if (!args.number?.trim()) throw new Error('Document number is required')
  return apiFetch<FRDocumentDetail>(`/documents/${encodeURIComponent(args.number.trim())}.json`)
}, { method: 'get_document' })

const getRecent = sg.wrap(async (args: { agency?: string }) => {
  const params = new URLSearchParams({
    per_page: '20',
    order: 'newest',
  })
  if (args.agency) params.set('conditions[agencies][]', args.agency.trim())
  return apiFetch<FRSearchResult>(`/documents.json?${params}`)
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchDocuments, getDocument, getRecent }
export type { FRDocument, FRSearchResult, FRDocumentDetail }
console.log('settlegrid-federal-register MCP server ready')
