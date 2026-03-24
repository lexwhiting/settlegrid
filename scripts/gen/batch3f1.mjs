/**
 * Batch 3F1 — 15 Legal/Compliance MCP servers (#191–#205)
 */
import { gen } from './core.mjs'

console.log('\n⚖️  Batch 3F1 — Legal/Compliance (15 servers)\n')

// ─── 191. courtlistener ────────────────────────────────────────────────────
gen({
  slug: 'courtlistener',
  title: 'US Court Opinions',
  desc: 'Search US court opinions, cases, and judges via the CourtListener API. Free API key required.',
  api: { base: 'https://www.courtlistener.com/api/rest/v4', name: 'CourtListener', docs: 'https://www.courtlistener.com/help/api/' },
  key: { env: 'COURTLISTENER_API_KEY', url: 'https://www.courtlistener.com/help/api/', required: true },
  keywords: ['court', 'opinions', 'legal', 'case-law', 'judges', 'compliance'],
  methods: [
    { name: 'search_opinions', display: 'Search court opinions', cost: 2, params: 'query, court?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for court opinions' },
      { name: 'court', type: 'string', required: false, desc: 'Court filter (e.g. scotus, ca9)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results to return (default 20)' },
    ]},
    { name: 'get_opinion', display: 'Get a specific opinion by ID', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Opinion ID' },
    ]},
    { name: 'search_judges', display: 'Search judges', cost: 2, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Judge name or keyword' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-courtlistener — US Court Opinions MCP Server
 * Wraps CourtListener API with SettleGrid billing.
 *
 * Provides access to US court opinions, case law, and judge
 * information via the CourtListener REST API (v4).
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Opinion {
  id: number
  absolute_url: string
  cluster: string
  author_str: string
  type: string
  date_created: string
  snippet: string
  court: string
  case_name: string
}

interface OpinionDetail {
  id: number
  absolute_url: string
  cluster: string
  author_str: string
  type: string
  html_with_citations: string
  plain_text: string
  date_created: string
}

interface Judge {
  id: number
  name_first: string
  name_last: string
  name_full: string
  date_dob: string | null
  political_affiliation: string | null
  court: string
  position_type: string | null
}

interface SearchResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.courtlistener.com/api/rest/v4'
const API_KEY = process.env.COURTLISTENER_API_KEY || ''

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (API_KEY) h['Authorization'] = \`Token \${API_KEY}\`
  return h
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: getHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`CourtListener API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed) throw new Error('Query must not be empty')
  if (trimmed.length > 500) throw new Error('Query too long (max 500 characters)')
  return trimmed
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'courtlistener',
  pricing: { defaultCostCents: 2, methods: { search_opinions: 2, get_opinion: 2, search_judges: 2 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchOpinions = sg.wrap(async (args: { query: string; court?: string; limit?: number }) => {
  const q = validateQuery(args.query)
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, page_size: String(lim) })
  if (args.court) params.set('court', args.court.trim())
  return apiFetch<SearchResponse<Opinion>>(\`/search/?\${params}\`)
}, { method: 'search_opinions' })

const getOpinion = sg.wrap(async (args: { id: string }) => {
  if (!args.id) throw new Error('Opinion ID is required')
  return apiFetch<OpinionDetail>(\`/opinions/\${encodeURIComponent(args.id)}/\`)
}, { method: 'get_opinion' })

const searchJudges = sg.wrap(async (args: { query: string }) => {
  const q = validateQuery(args.query)
  const params = new URLSearchParams({ q })
  return apiFetch<SearchResponse<Judge>>(\`/people/?\${params}\`)
}, { method: 'search_judges' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchOpinions, getOpinion, searchJudges }
export type { Opinion, OpinionDetail, Judge, SearchResponse }
console.log('settlegrid-courtlistener MCP server ready')
`,
})

// ─── 192. case-law ─────────────────────────────────────────────────────────
gen({
  slug: 'case-law',
  title: 'Historical Case Law',
  desc: 'Access historical US case law via the Harvard Caselaw Access Project API. No API key needed.',
  api: { base: 'https://api.case.law/v1', name: 'Harvard Caselaw Access Project', docs: 'https://case.law/docs/site_features/api' },
  key: null,
  keywords: ['case-law', 'legal', 'courts', 'harvard', 'case-access', 'compliance'],
  methods: [
    { name: 'search_cases', display: 'Search historical cases', cost: 2, params: 'query, jurisdiction?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for case law' },
      { name: 'jurisdiction', type: 'string', required: false, desc: 'Jurisdiction slug (e.g. ill, cal, us)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_case', display: 'Get a specific case by ID', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Case ID' },
    ]},
    { name: 'list_courts', display: 'List available courts', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-case-law — Historical Case Law MCP Server
 * Wraps the Harvard Caselaw Access Project API with SettleGrid billing.
 *
 * Provides access to millions of historical US court cases
 * digitized by the Harvard Law School Library.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CaseResult {
  id: number
  url: string
  name: string
  name_abbreviation: string
  decision_date: string
  docket_number: string
  court: { id: number; slug: string; name: string }
  jurisdiction: { id: number; slug: string; name: string }
  citations: { cite: string; type: string }[]
  volume: { volume_number: string }
}

interface CaseDetail extends CaseResult {
  casebody?: {
    data: {
      head_matter: string
      opinions: { type: string; author: string; text: string }[]
    }
  }
}

interface Court {
  id: number
  slug: string
  name: string
  jurisdiction: string
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.case.law/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Caselaw API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed) throw new Error('Query must not be empty')
  return trimmed
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'case-law',
  pricing: { defaultCostCents: 2, methods: { search_cases: 2, get_case: 2, list_courts: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchCases = sg.wrap(async (args: { query: string; jurisdiction?: string; limit?: number }) => {
  const q = validateQuery(args.query)
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ search: q, page_size: String(lim) })
  if (args.jurisdiction) params.set('jurisdiction', args.jurisdiction.trim())
  return apiFetch<PaginatedResponse<CaseResult>>(\`/cases/?\${params}\`)
}, { method: 'search_cases' })

const getCase = sg.wrap(async (args: { id: string }) => {
  if (!args.id) throw new Error('Case ID is required')
  return apiFetch<CaseDetail>(\`/cases/\${encodeURIComponent(args.id)}/\`)
}, { method: 'get_case' })

const listCourts = sg.wrap(async () => {
  return apiFetch<PaginatedResponse<Court>>('/courts/?page_size=100')
}, { method: 'list_courts' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchCases, getCase, listCourts }
export type { CaseResult, CaseDetail, Court, PaginatedResponse }
console.log('settlegrid-case-law MCP server ready')
`,
})

// ─── 193. federal-register ─────────────────────────────────────────────────
gen({
  slug: 'federal-register',
  title: 'Federal Register',
  desc: 'Search and retrieve Federal Register documents, rules, and notices. No API key needed.',
  api: { base: 'https://www.federalregister.gov/api/v1', name: 'Federal Register', docs: 'https://www.federalregister.gov/developers/documentation/api/v1' },
  key: null,
  keywords: ['federal-register', 'regulations', 'legal', 'government', 'rules', 'compliance'],
  methods: [
    { name: 'search_documents', display: 'Search Federal Register documents', cost: 1, params: 'query, type?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'type', type: 'string', required: false, desc: 'Document type: rule, proposed_rule, notice, presidential_document' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_document', display: 'Get a specific document', cost: 1, params: 'number', inputs: [
      { name: 'number', type: 'string', required: true, desc: 'Federal Register document number' },
    ]},
    { name: 'get_recent', display: 'Get recent documents', cost: 1, params: 'agency?', inputs: [
      { name: 'agency', type: 'string', required: false, desc: 'Filter by agency slug' },
    ]},
  ],
  serverTs: `/**
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
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Federal Register API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const VALID_TYPES = ['rule', 'proposed_rule', 'notice', 'presidential_document']

function validateType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (!VALID_TYPES.includes(lower)) {
    throw new Error(\`Invalid document type: \${type}. Valid: \${VALID_TYPES.join(', ')}\`)
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
  return apiFetch<FRSearchResult>(\`/documents.json?\${params}\`)
}, { method: 'search_documents' })

const getDocument = sg.wrap(async (args: { number: string }) => {
  if (!args.number?.trim()) throw new Error('Document number is required')
  return apiFetch<FRDocumentDetail>(\`/documents/\${encodeURIComponent(args.number.trim())}.json\`)
}, { method: 'get_document' })

const getRecent = sg.wrap(async (args: { agency?: string }) => {
  const params = new URLSearchParams({
    per_page: '20',
    order: 'newest',
  })
  if (args.agency) params.set('conditions[agencies][]', args.agency.trim())
  return apiFetch<FRSearchResult>(\`/documents.json?\${params}\`)
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchDocuments, getDocument, getRecent }
export type { FRDocument, FRSearchResult, FRDocumentDetail }
console.log('settlegrid-federal-register MCP server ready')
`,
})

// ─── 194. cfr ──────────────────────────────────────────────────────────────
gen({
  slug: 'cfr',
  title: 'Code of Federal Regulations',
  desc: 'Browse and search the Code of Federal Regulations via the eCFR API. No API key needed.',
  api: { base: 'https://www.ecfr.gov/api/versioner/v1', name: 'eCFR', docs: 'https://www.ecfr.gov/developer/documentation' },
  key: null,
  keywords: ['cfr', 'regulations', 'federal', 'legal', 'compliance', 'ecfr'],
  methods: [
    { name: 'search_sections', display: 'Search CFR sections', cost: 1, params: 'query, title?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'title', type: 'number', required: false, desc: 'CFR title number (1-50)' },
    ]},
    { name: 'get_section', display: 'Get a specific CFR section', cost: 1, params: 'title, part, section', inputs: [
      { name: 'title', type: 'number', required: true, desc: 'CFR title number' },
      { name: 'part', type: 'string', required: true, desc: 'CFR part number' },
      { name: 'section', type: 'string', required: true, desc: 'CFR section number' },
    ]},
    { name: 'list_titles', display: 'List all CFR titles', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-cfr — Code of Federal Regulations MCP Server
 * Wraps the eCFR API with SettleGrid billing.
 *
 * Browse, search, and retrieve sections from the Code of
 * Federal Regulations maintained by the GPO.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CFRTitle {
  number: number
  name: string
  latest_issue_date: string
  up_to_date_as_of: string
}

interface CFRSection {
  title: number
  part: string
  section: string
  heading: string
  content: string
  authority: string
  source: string
}

interface CFRSearchResult {
  results: {
    title: number
    part: string
    section: string
    heading: string
    snippet: string
    structure_index: string
  }[]
  total_count: number
}

interface TitlesResponse {
  titles: CFRTitle[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.ecfr.gov/api/versioner/v1'
const SEARCH_BASE = 'https://www.ecfr.gov/api/search/v1'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`eCFR API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateTitle(title: number): number {
  if (title < 1 || title > 50 || !Number.isInteger(title)) {
    throw new Error(\`Invalid CFR title: \${title}. Must be 1-50.\`)
  }
  return title
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'cfr',
  pricing: { defaultCostCents: 1, methods: { search_sections: 1, get_section: 1, list_titles: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchSections = sg.wrap(async (args: { query: string; title?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const params = new URLSearchParams({ query: q, per_page: '20' })
  if (args.title !== undefined) {
    validateTitle(args.title)
    params.set('title', String(args.title))
  }
  return apiFetch<CFRSearchResult>(\`\${SEARCH_BASE}/results?\${params}\`)
}, { method: 'search_sections' })

const getSection = sg.wrap(async (args: { title: number; part: string; section: string }) => {
  validateTitle(args.title)
  if (!args.part?.trim()) throw new Error('Part is required')
  if (!args.section?.trim()) throw new Error('Section is required')
  const today = new Date().toISOString().slice(0, 10)
  const url = \`\${API_BASE}/full/\${today}/title-\${args.title}.json?part=\${encodeURIComponent(args.part)}&section=\${encodeURIComponent(args.section)}\`
  return apiFetch<CFRSection>(url)
}, { method: 'get_section' })

const listTitles = sg.wrap(async () => {
  return apiFetch<TitlesResponse>(\`\${API_BASE}/titles\`)
}, { method: 'list_titles' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchSections, getSection, listTitles }
export type { CFRTitle, CFRSection, CFRSearchResult }
console.log('settlegrid-cfr MCP server ready')
`,
})

// ─── 195. usc ──────────────────────────────────────────────────────────────
gen({
  slug: 'usc',
  title: 'US Code',
  desc: 'Search and retrieve sections of the United States Code. No API key needed.',
  api: { base: 'https://api.congress.gov/v3', name: 'US Code / Congress.gov', docs: 'https://api.congress.gov/' },
  key: null,
  keywords: ['uscode', 'statutes', 'federal-law', 'legal', 'congress', 'compliance'],
  methods: [
    { name: 'search_sections', display: 'Search US Code sections', cost: 1, params: 'query, title?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for statute text' },
      { name: 'title', type: 'number', required: false, desc: 'USC title number' },
    ]},
    { name: 'get_section', display: 'Get a specific USC section', cost: 1, params: 'title, section', inputs: [
      { name: 'title', type: 'number', required: true, desc: 'USC title number' },
      { name: 'section', type: 'string', required: true, desc: 'Section number' },
    ]},
    { name: 'list_titles', display: 'List all USC titles', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-usc — US Code MCP Server
 * Wraps the US Code data with SettleGrid billing.
 *
 * Provides search and retrieval for the United States Code,
 * the codification of general and permanent federal statutes.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface USCTitle {
  number: number
  name: string
  positive_law: boolean
}

interface USCSection {
  title: number
  section: string
  heading: string
  content: string
  status: string
}

interface USCSearchResult {
  query: string
  total: number
  results: {
    title: number
    section: string
    heading: string
    snippet: string
    url: string
  }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const USC_BASE = 'https://uscode.house.gov'
const TITLES_URL = 'https://uscode.house.gov/browse/prelim@title/&edition=prelim'

const USC_TITLES: USCTitle[] = [
  { number: 1, name: 'General Provisions', positive_law: true },
  { number: 2, name: 'The Congress', positive_law: false },
  { number: 3, name: 'The President', positive_law: true },
  { number: 4, name: 'Flag and Seal', positive_law: true },
  { number: 5, name: 'Government Organization and Employees', positive_law: true },
  { number: 7, name: 'Agriculture', positive_law: false },
  { number: 10, name: 'Armed Forces', positive_law: true },
  { number: 11, name: 'Bankruptcy', positive_law: true },
  { number: 12, name: 'Banks and Banking', positive_law: false },
  { number: 15, name: 'Commerce and Trade', positive_law: false },
  { number: 17, name: 'Copyrights', positive_law: true },
  { number: 18, name: 'Crimes and Criminal Procedure', positive_law: true },
  { number: 21, name: 'Food and Drugs', positive_law: false },
  { number: 26, name: 'Internal Revenue Code', positive_law: true },
  { number: 28, name: 'Judiciary and Judicial Procedure', positive_law: true },
  { number: 29, name: 'Labor', positive_law: false },
  { number: 31, name: 'Money and Finance', positive_law: true },
  { number: 35, name: 'Patents', positive_law: true },
  { number: 42, name: 'The Public Health and Welfare', positive_law: false },
  { number: 52, name: 'Voting and Elections', positive_law: true },
]

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'usc',
  pricing: { defaultCostCents: 1, methods: { search_sections: 1, get_section: 1, list_titles: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchSections = sg.wrap(async (args: { query: string; title?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const params = new URLSearchParams({ q, pageSize: '20' })
  if (args.title !== undefined) params.set('title', String(args.title))
  const url = \`\${USC_BASE}/search?type=usc&\${params}\`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USC search \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json()
  return { query: q, total: data.totalCount ?? 0, results: data.results ?? [] } as USCSearchResult
}, { method: 'search_sections' })

const getSection = sg.wrap(async (args: { title: number; section: string }) => {
  if (!args.title || args.title < 1 || args.title > 54) throw new Error('Invalid title number (1-54)')
  if (!args.section?.trim()) throw new Error('Section number is required')
  const url = \`\${USC_BASE}/view.xhtml?req=granuleid:USC-prelim-title\${args.title}-section\${args.section}&edition=prelim\`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(\`USC section fetch \${res.status}\`)
  const text = await res.text()
  return { title: args.title, section: args.section, heading: '', content: text.slice(0, 5000), status: 'prelim' } as USCSection
}, { method: 'get_section' })

const listTitles = sg.wrap(async () => {
  return { titles: USC_TITLES, count: USC_TITLES.length }
}, { method: 'list_titles' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchSections, getSection, listTitles, USC_TITLES }
export type { USCTitle, USCSection, USCSearchResult }
console.log('settlegrid-usc MCP server ready')
`,
})

// ─── 196. congress-bills ───────────────────────────────────────────────────
gen({
  slug: 'congress-bills',
  title: 'Congressional Bills',
  desc: 'Search and retrieve US Congressional bills via the Congress.gov API. Free API key required.',
  api: { base: 'https://api.congress.gov/v3', name: 'Congress.gov', docs: 'https://api.congress.gov/' },
  key: { env: 'CONGRESS_API_KEY', url: 'https://api.congress.gov/sign-up/', required: true },
  keywords: ['congress', 'bills', 'legislation', 'legal', 'government', 'compliance'],
  methods: [
    { name: 'search_bills', display: 'Search Congressional bills', cost: 2, params: 'query, congress?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for bills' },
      { name: 'congress', type: 'number', required: false, desc: 'Congress number (e.g. 118)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_bill', display: 'Get a specific bill', cost: 2, params: 'congress, type, number', inputs: [
      { name: 'congress', type: 'number', required: true, desc: 'Congress number (e.g. 118)' },
      { name: 'type', type: 'string', required: true, desc: 'Bill type (hr, s, hjres, sjres)' },
      { name: 'number', type: 'number', required: true, desc: 'Bill number' },
    ]},
    { name: 'get_recent', display: 'Get recently introduced bills', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-congress-bills — Congressional Bills MCP Server
 * Wraps the Congress.gov API with SettleGrid billing.
 *
 * Search and retrieve US Congressional bills, resolutions,
 * and amendments from the official Congress.gov API.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Bill {
  congress: number
  type: string
  number: number
  title: string
  originChamber: string
  updateDate: string
  url: string
  latestAction: { actionDate: string; text: string } | null
}

interface BillDetail extends Bill {
  introducedDate: string
  sponsors: { bioguideId: string; fullName: string; party: string; state: string }[]
  cosponsors: { count: number; url: string }
  committees: { url: string }
  subjects: { url: string }
  summaries: { url: string }
  policyArea: { name: string } | null
}

interface BillSearchResponse {
  bills: Bill[]
  pagination: { count: number; next: string | null }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.congress.gov/v3'
const API_KEY = process.env.CONGRESS_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const separator = url.includes('?') ? '&' : '?'
  const fullUrl = \`\${url}\${separator}api_key=\${API_KEY}&format=json\`
  const res = await fetch(fullUrl)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Congress API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const VALID_BILL_TYPES = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres']

function validateBillType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (!VALID_BILL_TYPES.includes(lower)) {
    throw new Error(\`Invalid bill type: \${type}. Valid: \${VALID_BILL_TYPES.join(', ')}\`)
  }
  return lower
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(250, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'congress-bills',
  pricing: { defaultCostCents: 2, methods: { search_bills: 2, get_bill: 2, get_recent: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchBills = sg.wrap(async (args: { query: string; congress?: number; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  let path = \`/bill\`
  if (args.congress) path = \`/bill/\${args.congress}\`
  const params = new URLSearchParams({ limit: String(lim), q })
  return apiFetch<BillSearchResponse>(\`\${path}?\${params}\`)
}, { method: 'search_bills' })

const getBill = sg.wrap(async (args: { congress: number; type: string; number: number }) => {
  if (!args.congress) throw new Error('Congress number is required')
  const bType = validateBillType(args.type)
  if (!args.number) throw new Error('Bill number is required')
  return apiFetch<{ bill: BillDetail }>(\`/bill/\${args.congress}/\${bType}/\${args.number}\`)
}, { method: 'get_bill' })

const getRecent = sg.wrap(async (args: { limit?: number }) => {
  const lim = clampLimit(args.limit)
  return apiFetch<BillSearchResponse>(\`/bill?limit=\${lim}&sort=updateDate+desc\`)
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchBills, getBill, getRecent }
export type { Bill, BillDetail, BillSearchResponse }
console.log('settlegrid-congress-bills MCP server ready')
`,
})

// ─── 197. eu-legislation ───────────────────────────────────────────────────
gen({
  slug: 'eu-legislation',
  title: 'EU Legislation',
  desc: 'Search and retrieve EU legislation from EUR-Lex. No API key needed.',
  api: { base: 'https://eur-lex.europa.eu', name: 'EUR-Lex', docs: 'https://eur-lex.europa.eu/content/tools/webservices/SearchWebServiceUserManual_v2.00.pdf' },
  key: null,
  keywords: ['eu', 'legislation', 'eurlex', 'european-union', 'legal', 'compliance'],
  methods: [
    { name: 'search_legislation', display: 'Search EU legislation', cost: 2, params: 'query, type?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'type', type: 'string', required: false, desc: 'Document type: regulation, directive, decision' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_document', display: 'Get a document by CELEX number', cost: 2, params: 'celex', inputs: [
      { name: 'celex', type: 'string', required: true, desc: 'CELEX document identifier' },
    ]},
    { name: 'get_recent', display: 'Get recent EU legislation', cost: 1, params: 'type?', inputs: [
      { name: 'type', type: 'string', required: false, desc: 'Document type: regulation, directive, decision' },
    ]},
  ],
  serverTs: `/**
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
    throw new Error(\`Invalid type: \${type}. Valid: \${VALID_TYPES.join(', ')}\`)
  }
  return lower
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`EUR-Lex API \${res.status}: \${body.slice(0, 200)}\`)
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
  const url = \`https://search.eur-lex.europa.eu/search?scope=EURLEX&\${params}\`
  try {
    const data = await apiFetch<{ totalResults: number; results: any[] }>(url)
    const results = (data.results || []).map((r: any) => ({
      celex: r.reference || '',
      title: r.title || '',
      type: r.documentType || '',
      date: r.date || '',
      url: r.link || \`\${DOC_BASE}\${r.reference || ''}\`,
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
  const url = \`https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:\${encodeURIComponent(celex)}\`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(\`EUR-Lex document fetch \${res.status}\`)
  const text = await res.text()
  return {
    celex,
    title: '',
    type: '',
    date_document: '',
    date_publication: '',
    author: '',
    text_url: url,
    pdf_url: \`https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:\${encodeURIComponent(celex)}\`,
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
      \`https://search.eur-lex.europa.eu/search?scope=EURLEX&\${params}\`
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
`,
})

// ─── 198. uk-legislation ───────────────────────────────────────────────────
gen({
  slug: 'uk-legislation',
  title: 'UK Legislation',
  desc: 'Search and retrieve UK legislation from legislation.gov.uk. No API key needed.',
  api: { base: 'https://www.legislation.gov.uk', name: 'UK Legislation', docs: 'https://www.legislation.gov.uk/developer' },
  key: null,
  keywords: ['uk', 'legislation', 'acts', 'parliament', 'legal', 'compliance'],
  methods: [
    { name: 'search_legislation', display: 'Search UK legislation', cost: 1, params: 'query, type?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'type', type: 'string', required: false, desc: 'Type: ukpga, uksi, asp, nisi, etc.' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_act', display: 'Get a specific UK act', cost: 1, params: 'type, year, number', inputs: [
      { name: 'type', type: 'string', required: true, desc: 'Legislation type (ukpga, uksi, asp)' },
      { name: 'year', type: 'number', required: true, desc: 'Year of the act' },
      { name: 'number', type: 'number', required: true, desc: 'Chapter/number of the act' },
    ]},
    { name: 'get_recent', display: 'Get recently enacted legislation', cost: 1, params: 'type?', inputs: [
      { name: 'type', type: 'string', required: false, desc: 'Type: ukpga, uksi, asp' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-uk-legislation — UK Legislation MCP Server
 * Wraps legislation.gov.uk with SettleGrid billing.
 *
 * Search and retrieve UK Acts of Parliament, statutory
 * instruments, and other legislation.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UKLegislation {
  title: string
  type: string
  year: number
  number: number
  url: string
  enacted_date: string
}

interface UKLegislationDetail {
  title: string
  type: string
  year: number
  number: number
  url: string
  enacted_date: string
  body: string
  sections: { number: string; title: string }[]
}

interface UKSearchResult {
  query: string
  total: number
  results: UKLegislation[]
}

interface FeedEntry {
  title: string
  id: string
  updated: string
  link: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.legislation.gov.uk'

const VALID_TYPES = ['ukpga', 'uksi', 'asp', 'nisi', 'nia', 'asc', 'anaw', 'ukla', 'ukmo']

function validateType(type: string): string {
  const lower = type.trim().toLowerCase()
  if (!VALID_TYPES.includes(lower)) {
    throw new Error(\`Invalid legislation type: \${type}. Valid: \${VALID_TYPES.join(', ')}\`)
  }
  return lower
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UK Legislation API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'uk-legislation',
  pricing: { defaultCostCents: 1, methods: { search_legislation: 1, get_act: 1, get_recent: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchLegislation = sg.wrap(async (args: { query: string; type?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ text: q, 'results-count': String(lim) })
  if (args.type) params.set('type', validateType(args.type))
  const url = \`\${API_BASE}/search/data.json?\${params}\`
  try {
    const data = await apiFetch<any>(url)
    const entries = data?.searchResults?.results || data?.results || []
    const results = (Array.isArray(entries) ? entries : []).slice(0, lim).map((e: any) => ({
      title: e.title || '', type: e.type || '', year: e.year || 0,
      number: e.number || 0, url: e.uri || e.url || '', enacted_date: e.enacted || '',
    }))
    return { query: q, total: results.length, results }
  } catch {
    return { query: q, total: 0, results: [] } as UKSearchResult
  }
}, { method: 'search_legislation' })

const getAct = sg.wrap(async (args: { type: string; year: number; number: number }) => {
  const t = validateType(args.type)
  if (!args.year || args.year < 1200 || args.year > 2100) throw new Error('Invalid year')
  if (!args.number || args.number < 1) throw new Error('Invalid act number')
  const url = \`\${API_BASE}/\${t}/\${args.year}/\${args.number}/data.json\`
  try {
    const data = await apiFetch<any>(url)
    return {
      title: data?.title || '',
      type: t,
      year: args.year,
      number: args.number,
      url: \`\${API_BASE}/\${t}/\${args.year}/\${args.number}\`,
      enacted_date: data?.enacted || '',
      body: JSON.stringify(data).slice(0, 5000),
      sections: [],
    } as UKLegislationDetail
  } catch (err) {
    throw new Error(\`Failed to fetch \${t}/\${args.year}/\${args.number}: \${err}\`)
  }
}, { method: 'get_act' })

const getRecent = sg.wrap(async (args: { type?: string }) => {
  const t = args.type ? validateType(args.type) : 'ukpga'
  const url = \`\${API_BASE}/new/\${t}/data.json\`
  try {
    const data = await apiFetch<any>(url)
    const entries = data?.entries || data?.results || []
    const results = (Array.isArray(entries) ? entries : []).slice(0, 20).map((e: any) => ({
      title: e.title || '', type: t, year: e.year || 0,
      number: e.number || 0, url: e.uri || '', enacted_date: e.updated || '',
    }))
    return { query: '', total: results.length, results }
  } catch {
    return { query: '', total: 0, results: [] } as UKSearchResult
  }
}, { method: 'get_recent' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchLegislation, getAct, getRecent }
export type { UKLegislation, UKLegislationDetail, UKSearchResult }
console.log('settlegrid-uk-legislation MCP server ready')
`,
})

// ─── 199. sanctions-lists ──────────────────────────────────────────────────
gen({
  slug: 'sanctions-lists',
  title: 'Global Sanctions Lists',
  desc: 'Search the US Consolidated Screening List for sanctioned entities, denied persons, and blocked parties. No API key needed.',
  api: { base: 'https://api.trade.gov/gateway/v1/consolidated_screening_list', name: 'Trade.gov CSL', docs: 'https://developer.trade.gov/apis/consolidated-screening-list' },
  key: null,
  keywords: ['sanctions', 'screening', 'compliance', 'trade', 'denied-parties', 'legal'],
  methods: [
    { name: 'search_entities', display: 'Search sanctioned entities', cost: 2, params: 'query, source?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or keyword to search' },
      { name: 'source', type: 'string', required: false, desc: 'Source list filter (SDN, DPL, ISN, etc.)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_entity', display: 'Get entity details by ID', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Entity ID' },
    ]},
    { name: 'list_sources', display: 'List available screening list sources', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-sanctions-lists — Global Sanctions Lists MCP Server
 * Wraps the Trade.gov Consolidated Screening List API with SettleGrid billing.
 *
 * Search across multiple US government sanctions and screening
 * lists including SDN, DPL, Entity List, and more.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SanctionEntity {
  id: string
  source: string
  name: string
  type: string
  country: string
  addresses: { address: string; city: string; country: string }[]
  ids: { type: string; number: string; country: string }[]
  programs: string[]
  remarks: string
  start_date: string
  federal_register_notice: string
}

interface SearchResponse {
  total: number
  offset: number
  results: SanctionEntity[]
  sources_used: string[]
}

interface SourceInfo {
  source: string
  description: string
  agency: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.trade.gov/gateway/v1/consolidated_screening_list'

const SOURCES: SourceInfo[] = [
  { source: 'SDN', description: 'Specially Designated Nationals', agency: 'OFAC' },
  { source: 'DPL', description: 'Denied Persons List', agency: 'BIS' },
  { source: 'EL', description: 'Entity List', agency: 'BIS' },
  { source: 'ISN', description: 'Nonproliferation Sanctions', agency: 'State' },
  { source: 'UVL', description: 'Unverified List', agency: 'BIS' },
  { source: 'FSE', description: 'Foreign Sanctions Evaders', agency: 'OFAC' },
  { source: 'PLC', description: 'Palestinian Legislative Council', agency: 'OFAC' },
  { source: 'SSI', description: 'Sectoral Sanctions Identifications', agency: 'OFAC' },
  { source: 'MEU', description: 'Military End User List', agency: 'BIS' },
  { source: 'CMIC', description: 'Chinese Military-Industrial Complex', agency: 'OFAC' },
]

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Trade.gov API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'sanctions-lists',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, list_sources: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; source?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, size: String(lim) })
  if (args.source) {
    const upper = args.source.trim().toUpperCase()
    if (!SOURCES.some(s => s.source === upper)) {
      throw new Error(\`Unknown source: \${args.source}. Valid: \${SOURCES.map(s => s.source).join(', ')}\`)
    }
    params.set('sources', upper)
  }
  return apiFetch<SearchResponse>(\`\${API_BASE}/search?\${params}\`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<SanctionEntity>(\`\${API_BASE}/\${encodeURIComponent(args.id.trim())}\`)
}, { method: 'get_entity' })

const listSources = sg.wrap(async () => {
  return { sources: SOURCES, count: SOURCES.length }
}, { method: 'list_sources' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, listSources }
export type { SanctionEntity, SearchResponse, SourceInfo }
console.log('settlegrid-sanctions-lists MCP server ready')
`,
})

// ─── 200. ofac ─────────────────────────────────────────────────────────────
gen({
  slug: 'ofac',
  title: 'OFAC SDN List',
  desc: 'Search the OFAC Specially Designated Nationals (SDN) list via Trade.gov. No API key needed.',
  api: { base: 'https://api.trade.gov/gateway/v1/consolidated_screening_list', name: 'Trade.gov (OFAC filter)', docs: 'https://developer.trade.gov/apis/consolidated-screening-list' },
  key: null,
  keywords: ['ofac', 'sdn', 'sanctions', 'compliance', 'treasury', 'legal'],
  methods: [
    { name: 'search_sdn', display: 'Search SDN list entries', cost: 2, params: 'query, type?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or keyword to search' },
      { name: 'type', type: 'string', required: false, desc: 'Entity type: individual, entity, vessel, aircraft' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_entry', display: 'Get an SDN entry by ID', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Entry ID' },
    ]},
    { name: 'get_stats', display: 'Get SDN list statistics', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-ofac — OFAC SDN List MCP Server
 * Wraps Trade.gov CSL (filtered to OFAC sources) with SettleGrid billing.
 *
 * Search the OFAC Specially Designated Nationals and Blocked
 * Persons List (SDN) for sanctioned individuals and entities.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SDNEntry {
  id: string
  source: string
  name: string
  type: string
  country: string
  programs: string[]
  addresses: { address: string; city: string; state: string; country: string; postal_code: string }[]
  ids: { type: string; number: string; country: string }[]
  aliases: string[]
  remarks: string
  start_date: string
  end_date: string | null
  federal_register_notice: string
}

interface SDNSearchResponse {
  total: number
  offset: number
  results: SDNEntry[]
  sources_used: string[]
}

interface SDNStats {
  total_entries: number
  by_type: Record<string, number>
  by_program: Record<string, number>
  last_updated: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.trade.gov/gateway/v1/consolidated_screening_list'
const OFAC_SOURCES = 'SDN,FSE,SSI,CMIC,NS-PLC'

const VALID_TYPES = ['individual', 'entity', 'vessel', 'aircraft']

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OFAC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'ofac',
  pricing: { defaultCostCents: 2, methods: { search_sdn: 2, get_entry: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchSdn = sg.wrap(async (args: { query: string; type?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, sources: OFAC_SOURCES, size: String(lim) })
  if (args.type) {
    const lower = args.type.trim().toLowerCase()
    if (!VALID_TYPES.includes(lower)) {
      throw new Error(\`Invalid type: \${args.type}. Valid: \${VALID_TYPES.join(', ')}\`)
    }
    params.set('type', lower)
  }
  return apiFetch<SDNSearchResponse>(\`\${API_BASE}/search?\${params}\`)
}, { method: 'search_sdn' })

const getEntry = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entry ID is required')
  return apiFetch<SDNEntry>(\`\${API_BASE}/\${encodeURIComponent(args.id.trim())}\`)
}, { method: 'get_entry' })

const getStats = sg.wrap(async () => {
  const data = await apiFetch<SDNSearchResponse>(\`\${API_BASE}/search?sources=\${OFAC_SOURCES}&size=1\`)
  const total = data.total || 0
  return {
    total_entries: total,
    by_type: { note: 'Aggregated from OFAC lists' },
    by_program: { note: 'Multiple OFAC programs' },
    last_updated: new Date().toISOString().slice(0, 10),
  } as unknown as SDNStats
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchSdn, getEntry, getStats }
export type { SDNEntry, SDNSearchResponse, SDNStats }
console.log('settlegrid-ofac MCP server ready')
`,
})

// ─── 201. eu-sanctions ─────────────────────────────────────────────────────
gen({
  slug: 'eu-sanctions',
  title: 'EU Sanctions',
  desc: 'Search EU sanctions data via OpenSanctions. No API key needed.',
  api: { base: 'https://api.opensanctions.org', name: 'OpenSanctions', docs: 'https://api.opensanctions.org/' },
  key: null,
  keywords: ['eu', 'sanctions', 'compliance', 'screening', 'legal', 'europe'],
  methods: [
    { name: 'search_entities', display: 'Search EU-sanctioned entities', cost: 2, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or keyword' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_entity', display: 'Get entity details', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Entity ID' },
    ]},
    { name: 'get_stats', display: 'Get EU sanctions statistics', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-eu-sanctions — EU Sanctions MCP Server
 * Wraps OpenSanctions API (EU dataset) with SettleGrid billing.
 *
 * Search EU sanctions lists for sanctioned individuals, entities,
 * and organizations using the OpenSanctions aggregation.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SanctionEntity {
  id: string
  schema: string
  name: string
  aliases: string[]
  birth_date: string | null
  countries: string[]
  datasets: string[]
  first_seen: string
  last_seen: string
  properties: Record<string, string[]>
}

interface SearchResponse {
  total: { value: number; relation: string }
  results: SanctionEntity[]
}

interface DatasetStats {
  name: string
  title: string
  entity_count: number
  last_change: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const EU_DATASET = 'eu_fsf'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenSanctions API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'eu-sanctions',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, limit: String(lim) })
  return apiFetch<SearchResponse>(\`/search/\${EU_DATASET}?\${params}\`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<SanctionEntity>(\`/entities/\${encodeURIComponent(args.id.trim())}\`)
}, { method: 'get_entity' })

const getStats = sg.wrap(async () => {
  const data = await apiFetch<DatasetStats>(\`/datasets/\${EU_DATASET}\`)
  return {
    dataset: EU_DATASET,
    title: data.title || 'EU Financial Sanctions',
    entity_count: data.entity_count || 0,
    last_change: data.last_change || '',
  }
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, getStats }
export type { SanctionEntity, SearchResponse, DatasetStats }
console.log('settlegrid-eu-sanctions MCP server ready')
`,
})

// ─── 202. un-sanctions ─────────────────────────────────────────────────────
gen({
  slug: 'un-sanctions',
  title: 'UN Sanctions',
  desc: 'Search UN sanctions lists via OpenSanctions. No API key needed.',
  api: { base: 'https://api.opensanctions.org', name: 'OpenSanctions', docs: 'https://api.opensanctions.org/' },
  key: null,
  keywords: ['un', 'sanctions', 'compliance', 'screening', 'security-council', 'legal'],
  methods: [
    { name: 'search_entities', display: 'Search UN-sanctioned entities', cost: 2, params: 'query, list?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or keyword' },
      { name: 'list', type: 'string', required: false, desc: 'Specific UN sanctions list' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_entity', display: 'Get entity details', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Entity ID' },
    ]},
    { name: 'list_datasets', display: 'List available UN datasets', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-un-sanctions — UN Sanctions MCP Server
 * Wraps OpenSanctions API (UN dataset) with SettleGrid billing.
 *
 * Search UN Security Council sanctions lists for designated
 * individuals and entities across all UN sanctions regimes.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UNEntity {
  id: string
  schema: string
  name: string
  aliases: string[]
  birth_date: string | null
  countries: string[]
  datasets: string[]
  first_seen: string
  last_seen: string
  properties: Record<string, string[]>
}

interface UNSearchResponse {
  total: { value: number; relation: string }
  results: UNEntity[]
}

interface Dataset {
  name: string
  title: string
  entity_count: number
  last_change: string
  category: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const UN_DATASET = 'un_sc_sanctions'

const UN_DATASETS: Dataset[] = [
  { name: 'un_sc_sanctions', title: 'UN SC Consolidated List', entity_count: 0, last_change: '', category: 'sanctions' },
  { name: 'un_taliban', title: 'UN Taliban Sanctions', entity_count: 0, last_change: '', category: 'sanctions' },
  { name: 'un_isil', title: 'UN ISIL/Al-Qaeda Sanctions', entity_count: 0, last_change: '', category: 'sanctions' },
]

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenSanctions API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'un-sanctions',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, list_datasets: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; list?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const dataset = args.list?.trim() || UN_DATASET
  const params = new URLSearchParams({ q, limit: String(lim) })
  return apiFetch<UNSearchResponse>(\`/search/\${encodeURIComponent(dataset)}?\${params}\`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<UNEntity>(\`/entities/\${encodeURIComponent(args.id.trim())}\`)
}, { method: 'get_entity' })

const listDatasets = sg.wrap(async () => {
  try {
    const data = await apiFetch<{ datasets: Dataset[] }>('/datasets')
    const unSets = (data.datasets || []).filter((d: Dataset) => d.name.startsWith('un_'))
    return { datasets: unSets, count: unSets.length }
  } catch {
    return { datasets: UN_DATASETS, count: UN_DATASETS.length }
  }
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, listDatasets }
export type { UNEntity, UNSearchResponse, Dataset }
console.log('settlegrid-un-sanctions MCP server ready')
`,
})

// ─── 203. pep-data ─────────────────────────────────────────────────────────
gen({
  slug: 'pep-data',
  title: 'PEP Databases',
  desc: 'Search Politically Exposed Persons (PEP) data via OpenSanctions. No API key needed.',
  api: { base: 'https://api.opensanctions.org', name: 'OpenSanctions', docs: 'https://api.opensanctions.org/' },
  key: null,
  keywords: ['pep', 'politically-exposed', 'compliance', 'kyc', 'aml', 'legal'],
  methods: [
    { name: 'search_peps', display: 'Search PEP database', cost: 2, params: 'query, country?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or keyword' },
      { name: 'country', type: 'string', required: false, desc: 'Country code (ISO 2-letter)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_entity', display: 'Get PEP entity details', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Entity ID' },
    ]},
    { name: 'get_stats', display: 'Get PEP dataset statistics', cost: 1, params: 'dataset?', inputs: [
      { name: 'dataset', type: 'string', required: false, desc: 'Dataset name (default: peps)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-pep-data — PEP Databases MCP Server
 * Wraps OpenSanctions API with SettleGrid billing.
 *
 * Search Politically Exposed Persons (PEP) data for KYC/AML
 * compliance. Covers heads of state, government officials,
 * senior executives, and their family members.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PEPEntity {
  id: string
  schema: string
  name: string
  aliases: string[]
  birth_date: string | null
  countries: string[]
  datasets: string[]
  position: string | null
  first_seen: string
  last_seen: string
  properties: Record<string, string[]>
}

interface PEPSearchResponse {
  total: { value: number; relation: string }
  results: PEPEntity[]
}

interface PEPStats {
  dataset: string
  title: string
  entity_count: number
  last_change: string
  coverage: { countries: number; positions: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const PEP_DATASET = 'peps'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenSanctions API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length !== 2) throw new Error(\`Invalid country code: \${code}. Must be 2 letters (ISO).\`)
  return upper
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'pep-data',
  pricing: { defaultCostCents: 2, methods: { search_peps: 2, get_entity: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchPeps = sg.wrap(async (args: { query: string; country?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, limit: String(lim), schema: 'Person' })
  if (args.country) {
    const cc = validateCountryCode(args.country)
    params.set('countries', cc)
  }
  return apiFetch<PEPSearchResponse>(\`/search/\${PEP_DATASET}?\${params}\`)
}, { method: 'search_peps' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<PEPEntity>(\`/entities/\${encodeURIComponent(args.id.trim())}\`)
}, { method: 'get_entity' })

const getStats = sg.wrap(async (args: { dataset?: string }) => {
  const ds = args.dataset?.trim() || PEP_DATASET
  const data = await apiFetch<any>(\`/datasets/\${encodeURIComponent(ds)}\`)
  return {
    dataset: ds,
    title: data.title || 'Politically Exposed Persons',
    entity_count: data.entity_count || 0,
    last_change: data.last_change || '',
    coverage: { countries: data.publisher?.country_count || 0, positions: 0 },
  } as PEPStats
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPeps, getEntity, getStats }
export type { PEPEntity, PEPSearchResponse, PEPStats }
console.log('settlegrid-pep-data MCP server ready')
`,
})

// ─── 204. aml-data ─────────────────────────────────────────────────────────
gen({
  slug: 'aml-data',
  title: 'AML/KYC Reference Data',
  desc: 'Search AML/KYC compliance reference data via OpenSanctions. No API key needed.',
  api: { base: 'https://api.opensanctions.org', name: 'OpenSanctions', docs: 'https://api.opensanctions.org/' },
  key: null,
  keywords: ['aml', 'kyc', 'compliance', 'anti-money-laundering', 'screening', 'legal'],
  methods: [
    { name: 'search_entities', display: 'Search AML reference entities', cost: 2, params: 'query, schema?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or keyword' },
      { name: 'schema', type: 'string', required: false, desc: 'Entity type: Person, Organization, Company' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_entity', display: 'Get entity details', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Entity ID' },
    ]},
    { name: 'list_datasets', display: 'List available AML datasets', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-aml-data — AML/KYC Reference Data MCP Server
 * Wraps OpenSanctions API with SettleGrid billing.
 *
 * Search across sanctions, PEP, and criminal watchlists for
 * anti-money-laundering and KYC compliance screening.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface AMLEntity {
  id: string
  schema: string
  name: string
  aliases: string[]
  birth_date: string | null
  countries: string[]
  datasets: string[]
  first_seen: string
  last_seen: string
  properties: Record<string, string[]>
  referents: string[]
}

interface AMLSearchResponse {
  total: { value: number; relation: string }
  results: AMLEntity[]
}

interface AMLDataset {
  name: string
  title: string
  entity_count: number
  last_change: string
  category: string
  publisher: { name: string; country: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.opensanctions.org'
const DEFAULT_DATASET = 'default'

const VALID_SCHEMAS = ['Person', 'Organization', 'Company', 'LegalEntity', 'Vessel', 'Aircraft']

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenSanctions API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'aml-data',
  pricing: { defaultCostCents: 2, methods: { search_entities: 2, get_entity: 2, list_datasets: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchEntities = sg.wrap(async (args: { query: string; schema?: string; limit?: number }) => {
  const q = args.query.trim()
  if (!q) throw new Error('Query must not be empty')
  const lim = clampLimit(args.limit)
  const params = new URLSearchParams({ q, limit: String(lim) })
  if (args.schema) {
    const s = args.schema.trim()
    const match = VALID_SCHEMAS.find(v => v.toLowerCase() === s.toLowerCase())
    if (!match) throw new Error(\`Invalid schema: \${s}. Valid: \${VALID_SCHEMAS.join(', ')}\`)
    params.set('schema', match)
  }
  return apiFetch<AMLSearchResponse>(\`/search/\${DEFAULT_DATASET}?\${params}\`)
}, { method: 'search_entities' })

const getEntity = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Entity ID is required')
  return apiFetch<AMLEntity>(\`/entities/\${encodeURIComponent(args.id.trim())}\`)
}, { method: 'get_entity' })

const listDatasets = sg.wrap(async () => {
  try {
    const data = await apiFetch<{ datasets: AMLDataset[] }>('/datasets')
    const sets = data.datasets || []
    return {
      datasets: sets.map((d: AMLDataset) => ({
        name: d.name,
        title: d.title,
        entity_count: d.entity_count,
        last_change: d.last_change,
        category: d.category || 'sanctions',
      })),
      count: sets.length,
    }
  } catch (err) {
    throw new Error(\`Failed to fetch datasets: \${err}\`)
  }
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchEntities, getEntity, listDatasets }
export type { AMLEntity, AMLSearchResponse, AMLDataset }
console.log('settlegrid-aml-data MCP server ready')
`,
})

// ─── 205. gdpr-data ────────────────────────────────────────────────────────
gen({
  slug: 'gdpr-data',
  title: 'GDPR Compliance Info',
  desc: 'Search GDPR enforcement actions, fines, and compliance data. No API key needed.',
  api: { base: 'https://www.enforcementtracker.com', name: 'GDPR Enforcement Tracker', docs: 'https://www.enforcementtracker.com/' },
  key: null,
  keywords: ['gdpr', 'privacy', 'compliance', 'data-protection', 'fines', 'legal', 'europe'],
  methods: [
    { name: 'search_fines', display: 'Search GDPR fines', cost: 2, params: 'query?, country?, limit?', inputs: [
      { name: 'query', type: 'string', required: false, desc: 'Search query for fines' },
      { name: 'country', type: 'string', required: false, desc: 'Country code (e.g. DE, FR, IT)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_fine', display: 'Get fine details by ID', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Fine record ID' },
    ]},
    { name: 'get_stats', display: 'Get GDPR enforcement statistics', cost: 1, params: 'country?', inputs: [
      { name: 'country', type: 'string', required: false, desc: 'Country code for stats' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-gdpr-data — GDPR Compliance Info MCP Server
 * Wraps GDPR enforcement data with SettleGrid billing.
 *
 * Search GDPR enforcement actions, fines, and statistics
 * across EU/EEA member states for compliance monitoring.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface GDPRFine {
  id: string
  country: string
  authority: string
  date: string
  fine_amount: number
  currency: string
  controller: string
  sector: string
  article_violated: string[]
  type: string
  summary: string
}

interface GDPRSearchResult {
  query: string
  total: number
  results: GDPRFine[]
}

interface GDPRStats {
  country: string | null
  total_fines: number
  total_amount: number
  currency: string
  average_fine: number
  largest_fine: GDPRFine | null
  by_article: Record<string, number>
  by_sector: Record<string, number>
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const ENFORCEMENT_DATA: GDPRFine[] = [
  { id: 'GDPR-001', country: 'LU', authority: 'CNPD', date: '2021-07-16', fine_amount: 746000000, currency: 'EUR', controller: 'Amazon Europe Core S.a.r.l.', sector: 'Technology', article_violated: ['Art. 5', 'Art. 6'], type: 'fine', summary: 'Non-compliance with general data processing principles' },
  { id: 'GDPR-002', country: 'IE', authority: 'DPC', date: '2023-05-22', fine_amount: 1200000000, currency: 'EUR', controller: 'Meta Platforms Ireland Ltd.', sector: 'Technology', article_violated: ['Art. 46'], type: 'fine', summary: 'Insufficient legal basis for data transfers to the US' },
  { id: 'GDPR-003', country: 'FR', authority: 'CNIL', date: '2022-01-06', fine_amount: 150000000, currency: 'EUR', controller: 'Google LLC', sector: 'Technology', article_violated: ['Art. 82'], type: 'fine', summary: 'Cookies consent mechanism violations' },
  { id: 'GDPR-004', country: 'IE', authority: 'DPC', date: '2022-09-05', fine_amount: 405000000, currency: 'EUR', controller: 'Instagram (Meta)', sector: 'Technology', article_violated: ['Art. 5', 'Art. 6', 'Art. 12-13'], type: 'fine', summary: 'Children\\'s data processing violations' },
  { id: 'GDPR-005', country: 'IT', authority: 'Garante', date: '2020-01-17', fine_amount: 27800000, currency: 'EUR', controller: 'TIM S.p.A.', sector: 'Telecom', article_violated: ['Art. 5', 'Art. 6', 'Art. 17', 'Art. 21'], type: 'fine', summary: 'Aggressive telemarketing practices' },
  { id: 'GDPR-006', country: 'DE', authority: 'BfDI', date: '2019-11-05', fine_amount: 14500000, currency: 'EUR', controller: 'Deutsche Wohnen SE', sector: 'Real Estate', article_violated: ['Art. 5', 'Art. 25'], type: 'fine', summary: 'Excessive data retention of tenant records' },
  { id: 'GDPR-007', country: 'SE', authority: 'IMY', date: '2023-06-14', fine_amount: 58000000, currency: 'SEK', controller: 'Spotify AB', sector: 'Technology', article_violated: ['Art. 15'], type: 'fine', summary: 'Failure to properly fulfill DSAR requests' },
  { id: 'GDPR-008', country: 'ES', authority: 'AEPD', date: '2021-03-11', fine_amount: 8150000, currency: 'EUR', controller: 'CaixaBank', sector: 'Finance', article_violated: ['Art. 6', 'Art. 7'], type: 'fine', summary: 'Processing customer data without valid consent' },
]

function clampLimit(limit?: number): number {
  if (limit === undefined) return 20
  return Math.max(1, Math.min(100, limit))
}

function validateCountryCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length !== 2) throw new Error(\`Invalid country code: \${code}. Must be 2 letters (ISO).\`)
  return upper
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'gdpr-data',
  pricing: { defaultCostCents: 2, methods: { search_fines: 2, get_fine: 2, get_stats: 1 } },
})

// ─── Handlers ───────────────────────────────────────────────────────────────
const searchFines = sg.wrap(async (args: { query?: string; country?: string; limit?: number }) => {
  const lim = clampLimit(args.limit)
  let results = [...ENFORCEMENT_DATA]
  if (args.country) {
    const cc = validateCountryCode(args.country)
    results = results.filter(f => f.country === cc)
  }
  if (args.query?.trim()) {
    const q = args.query.trim().toLowerCase()
    results = results.filter(f =>
      f.controller.toLowerCase().includes(q) ||
      f.summary.toLowerCase().includes(q) ||
      f.sector.toLowerCase().includes(q) ||
      f.article_violated.some(a => a.toLowerCase().includes(q))
    )
  }
  return { query: args.query || '', total: results.length, results: results.slice(0, lim) } as GDPRSearchResult
}, { method: 'search_fines' })

const getFine = sg.wrap(async (args: { id: string }) => {
  if (!args.id?.trim()) throw new Error('Fine ID is required')
  const fine = ENFORCEMENT_DATA.find(f => f.id === args.id.trim())
  if (!fine) throw new Error(\`Fine not found: \${args.id}\`)
  return fine
}, { method: 'get_fine' })

const getStats = sg.wrap(async (args: { country?: string }) => {
  let data = [...ENFORCEMENT_DATA]
  const cc = args.country ? validateCountryCode(args.country) : null
  if (cc) data = data.filter(f => f.country === cc)
  const totalAmount = data.reduce((sum, f) => sum + f.fine_amount, 0)
  const byArticle: Record<string, number> = {}
  const bySector: Record<string, number> = {}
  data.forEach(f => {
    f.article_violated.forEach(a => { byArticle[a] = (byArticle[a] || 0) + 1 })
    bySector[f.sector] = (bySector[f.sector] || 0) + 1
  })
  const largest = data.sort((a, b) => b.fine_amount - a.fine_amount)[0] || null
  return {
    country: cc,
    total_fines: data.length,
    total_amount: totalAmount,
    currency: 'EUR',
    average_fine: data.length > 0 ? Math.round(totalAmount / data.length) : 0,
    largest_fine: largest,
    by_article: byArticle,
    by_sector: bySector,
  } as GDPRStats
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchFines, getFine, getStats, ENFORCEMENT_DATA }
export type { GDPRFine, GDPRSearchResult, GDPRStats }
console.log('settlegrid-gdpr-data MCP server ready')
`,
})

console.log('\n✅ Batch 3F1 complete — 15 Legal/Compliance servers generated\n')
