/**
 * settlegrid-eu-legislation — EU Legislation MCP Server
 * Wraps EUR-Lex with SettleGrid billing.
 *
 * Search and retrieve EU legislation including regulations,
 * directives, and decisions from the official EUR-Lex portal.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EUDocument {
  celex: string
  title: string
  type: string
  date: string
  url: string
  author: string
  summary: string
}

interface EUDocumentDetail {
  celex: string
  title: string
  type: string
  date_document: string
  date_publication: string
  author: string
  text_url: string
  pdf_url: string
  oj_reference: string
  subject_matter: string[]
}

interface EUSearchResult {
  query: string
  total: number
  results: EUDocument[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const SEARCH_BASE = 'https://eur-lex.europa.eu/search.html'
const DOC_BASE = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:'

const VALID_TYPES = ['regulation', 'directive', 'decision']

function validateType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (!VALID_TYPES.includes(lower)) {
    throw new Error(`Invalid type: ${type}. Valid: ${VALID_TYPES.join(', ')}`)
  }
  return lower
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`EUR-Lex API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'eu-legislation',
  pricing: { defaultCostCents: 2, methods: { search_legislation: 2, get_document: 2, get_recent: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchLegislation = sg.wrap(async (args: { query: string; type?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({
    textScope: 'ti-te',
    qid: Date.now().toString(),
    DTS_DOM: 'EU_LAW',
    type: 'named',
    page: '1',
    pageSize: String(lim),
    lang: 'en',
    SUBDOM_INIT: 'LEGISLATION',
    text: q,
  })
  if (args.type) params.set('DT', validateType(args.type).toUpperCase())
  const url = `https://search.eur-lex.europa.eu/search?scope=EURLEX&${params}`
  try {
    const data = await apiFetch<{ totalResults: number; results: any[] }>(url)
    const results = (data.results || []).map((r: any) => ({
      celex: r.reference || '',
      title: r.title || '',
      type: r.documentType || '',
      date: r.date || '',
      url: r.link || `${DOC_BASE}${r.reference || ''}`,
      author: r.author || '',
      summary: r.summary || '',
    }))
    return { query: q, total: data.totalResults || 0, results }
  } catch {
    return { query: q, total: 0, results: [] } as EUSearchResult
  }
}, { method: 'search_legislation' })

const getDocument = sg.wrap(async (args: { celex: string }) => {
  const celex = args.celex?.trim()
  if (!celex) throw new Error('CELEX number is required')
  const url = `https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:${encodeURIComponent(celex)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`EUR-Lex document fetch ${res.status}`)
  const text = await res.text()
  return {
    celex,
    title: '',
    type: '',
    date_document: '',
    date_publication: '',
    author: '',
    text_url: url,
    pdf_url: `https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:${encodeURIComponent(celex)}`,
    oj_reference: '',
    subject_matter: [],
  } as EUDocumentDetail
}, { method: 'get_document' })

const getRecent = sg.wrap(async (args: { type?: string }) => {
  const params = new URLSearchParams({
    DTS_DOM: 'EU_LAW',
    SUBDOM_INIT: 'LEGISLATION',
    page: '1',
    pageSize: '20',
    lang: 'en',
    type: 'named',
    sortOne: 'DD_DATE',
    sortOneDir: 'DESC',
  })
  if (args.type) params.set('DT', validateType(args.type).toUpperCase())
  try {
    const data = await apiFetch<{ totalResults: number; results: any[] }>(
      `https://search.eur-lex.europa.eu/search?scope=EURLEX&${params}`
    )
    const results = (data.results || []).map((r: any) => ({
      celex: r.reference || '', title: r.title || '', type: r.documentType || '',
      date: r.date || '', url: r.link || '', author: r.author || '', summary: r.summary || '',
    }))
    return { query: '', total: data.totalResults || 0, results }
  } catch {
    return { query: '', total: 0, results: [] } as EUSearchResult
  }
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchLegislation, getDocument, getRecent }
export type { EUDocument, EUDocumentDetail, EUSearchResult }
console.log('settlegrid-eu-legislation MCP server ready')
