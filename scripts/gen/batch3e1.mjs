/**
 * Batch 3E1 — 20 Academic/Research MCP servers (#141–#160)
 */
import { gen } from './core.mjs'

console.log('\n📚 Batch 3E1 — Academic/Research (20 servers)\n')

// ─── 141. google-scholar ────────────────────────────────────────────────────
gen({
  slug: 'google-scholar',
  title: 'Google Scholar Search',
  desc: 'Search academic papers, retrieve metadata, and find citations via Semantic Scholar API. No API key needed.',
  api: { base: 'https://api.semanticscholar.org/graph/v1', name: 'Semantic Scholar', docs: 'https://api.semanticscholar.org/' },
  key: null,
  keywords: ['scholar', 'papers', 'academic', 'research', 'citations'],
  methods: [
    { name: 'search_papers', display: 'Search for academic papers', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for papers' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results to return (default: 10, max: 100)' },
    ]},
    { name: 'get_paper', display: 'Get paper details by ID', cost: 1, params: 'paperId', inputs: [
      { name: 'paperId', type: 'string', required: true, desc: 'Semantic Scholar paper ID, DOI, or ArXiv ID' },
    ]},
    { name: 'get_citations', display: 'Get citations for a paper', cost: 2, params: 'paperId, limit?', inputs: [
      { name: 'paperId', type: 'string', required: true, desc: 'Semantic Scholar paper ID' },
      { name: 'limit', type: 'number', required: false, desc: 'Max citations to return (default: 20, max: 1000)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-google-scholar — Google Scholar Search MCP Server
 * Wraps Semantic Scholar API with SettleGrid billing.
 *
 * Provides academic paper search, metadata retrieval, and citation
 * lookup via the free Semantic Scholar Graph API.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Paper {
  paperId: string
  title: string
  abstract: string | null
  year: number | null
  citationCount: number
  authors: { authorId: string; name: string }[]
  url: string
  venue: string | null
  externalIds: Record<string, string>
}

interface SearchResult {
  total: number
  offset: number
  data: Paper[]
}

interface Citation {
  citingPaper: Paper
}

interface CitationsResult {
  offset: number
  data: Citation[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.semanticscholar.org/graph/v1'
const FIELDS = 'paperId,title,abstract,year,citationCount,authors,url,venue,externalIds'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'google-scholar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<SearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<SearchResult>(\`/paper/search?query=\${q}&limit=\${l}&fields=\${FIELDS}\`)
  })
}

async function getPaper(paperId: string): Promise<Paper> {
  if (!paperId || typeof paperId !== 'string') throw new Error('paperId is required')
  const id = encodeURIComponent(paperId.trim())
  return sg.wrap('get_paper', async () => {
    return apiFetch<Paper>(\`/paper/\${id}?fields=\${FIELDS}\`)
  })
}

async function getCitations(paperId: string, limit?: number): Promise<CitationsResult> {
  if (!paperId || typeof paperId !== 'string') throw new Error('paperId is required')
  const id = encodeURIComponent(paperId.trim())
  const l = clamp(limit, 1, 1000, 20)
  return sg.wrap('get_citations', async () => {
    return apiFetch<CitationsResult>(
      \`/paper/\${id}/citations?limit=\${l}&fields=\${FIELDS}\`
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, getCitations }
export type { Paper, SearchResult, Citation, CitationsResult }
console.log('settlegrid-google-scholar server started')
`,
})

// ─── 142. core-api ──────────────────────────────────────────────────────────
gen({
  slug: 'core-api',
  title: 'CORE Open Access Papers',
  desc: 'Search and access millions of open access research papers and metadata via the CORE API.',
  api: { base: 'https://api.core.ac.uk/v3', name: 'CORE', docs: 'https://core.ac.uk/documentation/api' },
  key: { env: 'CORE_API_KEY', url: 'https://core.ac.uk/services/api', required: true },
  keywords: ['core', 'open-access', 'papers', 'academic', 'research'],
  methods: [
    { name: 'search_papers', display: 'Search open access papers', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 100)' },
    ]},
    { name: 'get_paper', display: 'Get paper by CORE ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'CORE paper ID or DOI' },
    ]},
    { name: 'search_journals', display: 'Search journals', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Journal name to search' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-core-api — CORE Open Access Papers MCP Server
 * Wraps CORE API with SettleGrid billing.
 *
 * CORE aggregates millions of open access research papers from
 * repositories and journals worldwide.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface CorePaper {
  id: string
  doi: string | null
  title: string
  authors: { name: string }[]
  abstract: string | null
  yearPublished: number | null
  downloadUrl: string | null
  sourceFulltextUrls: string[]
  language: string | null
}

interface CoreSearchResult {
  totalHits: number
  results: CorePaper[]
}

interface CoreJournal {
  id: string
  title: string
  identifiers: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.core.ac.uk/v3'
const API_KEY = process.env.CORE_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('CORE_API_KEY environment variable is required')
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'core-api' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<CoreSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<CoreSearchResult>(\`/search/works?q=\${q}&limit=\${l}\`)
  })
}

async function getPaper(id: string): Promise<CorePaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_paper', async () => {
    return apiFetch<CorePaper>(\`/works/\${cleanId}\`)
  })
}

async function searchJournals(query: string): Promise<{ results: CoreJournal[] }> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  return sg.wrap('search_journals', async () => {
    return apiFetch<{ results: CoreJournal[] }>(\`/journals/search?q=\${q}&limit=10\`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, searchJournals }
export type { CorePaper, CoreSearchResult, CoreJournal }
console.log('settlegrid-core-api server started')
`,
})

// ─── 143. doaj ──────────────────────────────────────────────────────────────
gen({
  slug: 'doaj',
  title: 'DOAJ Open Access Journals',
  desc: 'Search the Directory of Open Access Journals for articles, journals, and metadata. Free and open.',
  api: { base: 'https://doaj.org/api', name: 'DOAJ', docs: 'https://doaj.org/api/docs' },
  key: null,
  keywords: ['doaj', 'open-access', 'journals', 'articles', 'academic'],
  methods: [
    { name: 'search_articles', display: 'Search open access articles', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for articles' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 100)' },
    ]},
    { name: 'search_journals', display: 'Search open access journals', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for journals' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 100)' },
    ]},
    { name: 'get_journal', display: 'Get journal by ISSN', cost: 1, params: 'issn', inputs: [
      { name: 'issn', type: 'string', required: true, desc: 'Journal ISSN (e.g. 1234-5678)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-doaj — DOAJ Open Access Journals MCP Server
 * Wraps DOAJ API with SettleGrid billing.
 *
 * The Directory of Open Access Journals indexes quality-controlled
 * open access journals and articles across all disciplines.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DoajArticle {
  id: string
  bibjson: {
    title: string
    abstract: string | null
    author: { name: string }[]
    journal: { title: string; issns: string[] }
    year: string | null
    link: { url: string; type: string }[]
    identifier: { id: string; type: string }[]
  }
}

interface DoajJournal {
  id: string
  bibjson: {
    title: string
    publisher: { name: string }
    issns: string[]
    subject: { term: string; scheme: string }[]
    apc: { has_apc: boolean }
    language: string[]
  }
}

interface DoajSearchResult<T> {
  total: number
  page: number
  pageSize: number
  results: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://doaj.org/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function validateISSN(issn: string): string {
  const clean = issn.trim()
  if (!/^\\d{4}-?\\d{3}[\\dXx]$/.test(clean)) {
    throw new Error(\`Invalid ISSN format: \${issn}. Expected format: 1234-5678\`)
  }
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'doaj' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchArticles(query: string, limit?: number): Promise<DoajSearchResult<DoajArticle>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_articles', async () => {
    return apiFetch<DoajSearchResult<DoajArticle>>(\`/search/articles/\${q}?pageSize=\${l}\`)
  })
}

async function searchJournals(query: string, limit?: number): Promise<DoajSearchResult<DoajJournal>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_journals', async () => {
    return apiFetch<DoajSearchResult<DoajJournal>>(\`/search/journals/\${q}?pageSize=\${l}\`)
  })
}

async function getJournal(issn: string): Promise<DoajJournal> {
  const validIssn = validateISSN(issn)
  return sg.wrap('get_journal', async () => {
    const result = await apiFetch<DoajSearchResult<DoajJournal>>(
      \`/search/journals/issn:\${validIssn}\`
    )
    if (!result.results.length) throw new Error(\`No journal found with ISSN: \${validIssn}\`)
    return result.results[0]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchArticles, searchJournals, getJournal }
export type { DoajArticle, DoajJournal, DoajSearchResult }
console.log('settlegrid-doaj server started')
`,
})

// ─── 144. orcid ─────────────────────────────────────────────────────────────
gen({
  slug: 'orcid',
  title: 'ORCID Researcher Profiles',
  desc: 'Search and retrieve researcher profiles, works, and affiliations from the ORCID registry. No API key needed.',
  api: { base: 'https://pub.orcid.org/v3.0', name: 'ORCID', docs: 'https://info.orcid.org/documentation/api-tutorials/' },
  key: null,
  keywords: ['orcid', 'researchers', 'profiles', 'academic', 'identity'],
  methods: [
    { name: 'search_researchers', display: 'Search for researchers', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Name or keyword to search' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 50)' },
    ]},
    { name: 'get_profile', display: 'Get researcher profile', cost: 1, params: 'orcid', inputs: [
      { name: 'orcid', type: 'string', required: true, desc: 'ORCID iD (e.g. 0000-0002-1825-0097)' },
    ]},
    { name: 'get_works', display: 'Get works by a researcher', cost: 2, params: 'orcid, limit?', inputs: [
      { name: 'orcid', type: 'string', required: true, desc: 'ORCID iD' },
      { name: 'limit', type: 'number', required: false, desc: 'Max works to return (default: 20, max: 200)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-orcid — ORCID Researcher Profiles MCP Server
 * Wraps ORCID Public API with SettleGrid billing.
 *
 * ORCID provides unique persistent identifiers for researchers,
 * connecting them with their contributions and affiliations.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface OrcidProfile {
  orcid: string
  name: { givenNames: string; familyName: string } | null
  biography: string | null
  emails: string[]
  affiliations: { organization: string; role: string; startYear: number | null }[]
}

interface OrcidWork {
  putCode: number
  title: string
  type: string
  year: number | null
  doi: string | null
  journal: string | null
  url: string | null
}

interface OrcidSearchResult {
  total: number
  results: { orcid: string; givenNames: string; familyName: string }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://pub.orcid.org/v3.0'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateOrcid(orcid: string): string {
  const clean = orcid.trim()
  if (!/^\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]$/.test(clean)) {
    throw new Error(\`Invalid ORCID format: \${orcid}. Expected: 0000-0002-1825-0097\`)
  }
  return clean
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'orcid' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchResearchers(query: string, limit?: number): Promise<OrcidSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_researchers', async () => {
    const raw = await apiFetch<any>(\`/search/?q=\${q}&rows=\${l}\`)
    const results = (raw.result || []).map((r: any) => ({
      orcid: r['orcid-identifier']?.path || '',
      givenNames: r['orcid-identifier']?.['given-names'] || '',
      familyName: r['orcid-identifier']?.['family-name'] || '',
    }))
    return { total: raw['num-found'] || 0, results }
  })
}

async function getProfile(orcid: string): Promise<OrcidProfile> {
  const id = validateOrcid(orcid)
  return sg.wrap('get_profile', async () => {
    const raw = await apiFetch<any>(\`/\${id}/person\`)
    const name = raw.name ? {
      givenNames: raw.name['given-names']?.value || '',
      familyName: raw.name['family-name']?.value || '',
    } : null
    const biography = raw.biography?.content || null
    const emails = (raw.emails?.email || []).map((e: any) => e.email)
    return { orcid: id, name, biography, emails, affiliations: [] }
  })
}

async function getWorks(orcid: string, limit?: number): Promise<{ total: number; works: OrcidWork[] }> {
  const id = validateOrcid(orcid)
  const l = clamp(limit, 1, 200, 20)
  return sg.wrap('get_works', async () => {
    const raw = await apiFetch<any>(\`/\${id}/works\`)
    const groups = raw.group || []
    const works: OrcidWork[] = groups.slice(0, l).map((g: any) => {
      const ws = g['work-summary']?.[0] || {}
      return {
        putCode: ws['put-code'] || 0,
        title: ws.title?.title?.value || 'Untitled',
        type: ws.type || 'unknown',
        year: ws['publication-date']?.year?.value ? parseInt(ws['publication-date'].year.value) : null,
        doi: (ws['external-ids']?.['external-id'] || []).find((e: any) => e['external-id-type'] === 'doi')?.['external-id-value'] || null,
        journal: ws['journal-title']?.value || null,
        url: ws.url?.value || null,
      }
    })
    return { total: groups.length, works }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchResearchers, getProfile, getWorks }
export type { OrcidProfile, OrcidWork, OrcidSearchResult }
console.log('settlegrid-orcid server started')
`,
})

// ─── 145. ror ───────────────────────────────────────────────────────────────
gen({
  slug: 'ror',
  title: 'Research Organization Registry',
  desc: 'Search and retrieve metadata about research organizations worldwide via the ROR API. No API key needed.',
  api: { base: 'https://api.ror.org/v2/organizations', name: 'ROR', docs: 'https://ror.readme.io/docs' },
  key: null,
  keywords: ['ror', 'organizations', 'institutions', 'universities', 'research'],
  methods: [
    { name: 'search_organizations', display: 'Search research organizations', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Organization name or keyword' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 40)' },
    ]},
    { name: 'get_organization', display: 'Get organization details', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'ROR ID (e.g. https://ror.org/03yrm5c26 or 03yrm5c26)' },
    ]},
    { name: 'list_by_country', display: 'List organizations by country', cost: 1, params: 'country', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'ISO 3166-1 alpha-2 country code (e.g. US, GB, DE)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-ror — Research Organization Registry MCP Server
 * Wraps ROR API with SettleGrid billing.
 *
 * ROR is a community-led registry of open, sustainable, usable,
 * and unique identifiers for every research organization in the world.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RorOrganization {
  id: string
  names: { value: string; types: string[]; lang: string | null }[]
  locations: { geonames_details: { country_code: string; name: string; lat: number; lng: number } }[]
  types: string[]
  established: number | null
  links: { type: string; value: string }[]
  relationships: { type: string; id: string; label: string }[]
  status: string
}

interface RorSearchResult {
  number_of_results: number
  items: RorOrganization[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.ror.org/v2/organizations'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function normalizeRorId(id: string): string {
  const clean = id.trim()
  if (clean.startsWith('https://ror.org/')) return clean
  if (/^[0-9a-z]{9}$/.test(clean)) return \`https://ror.org/\${clean}\`
  throw new Error(\`Invalid ROR ID format: \${id}\`)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'ror' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchOrganizations(query: string, limit?: number): Promise<RorSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 40, 10)
  return sg.wrap('search_organizations', async () => {
    const result = await apiFetch<RorSearchResult>(\`?query=\${q}\`)
    result.items = result.items.slice(0, l)
    return result
  })
}

async function getOrganization(id: string): Promise<RorOrganization> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const rorId = normalizeRorId(id)
  return sg.wrap('get_organization', async () => {
    return apiFetch<RorOrganization>(\`/\${encodeURIComponent(rorId)}\`)
  })
}

async function listByCountry(country: string): Promise<RorSearchResult> {
  if (!country || typeof country !== 'string') throw new Error('country is required')
  const cc = country.trim().toUpperCase()
  if (cc.length !== 2) throw new Error('country must be a 2-letter ISO country code')
  return sg.wrap('list_by_country', async () => {
    return apiFetch<RorSearchResult>(\`?filter=locations.geonames_details.country_code:\${cc}\`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchOrganizations, getOrganization, listByCountry }
export type { RorOrganization, RorSearchResult }
console.log('settlegrid-ror server started')
`,
})

// ─── 146. datacite ──────────────────────────────────────────────────────────
gen({
  slug: 'datacite',
  title: 'DataCite DOI Metadata',
  desc: 'Retrieve and search DOI metadata for research datasets, publications, and other scholarly outputs via DataCite.',
  api: { base: 'https://api.datacite.org/dois', name: 'DataCite', docs: 'https://support.datacite.org/docs/api' },
  key: null,
  keywords: ['datacite', 'doi', 'metadata', 'datasets', 'research'],
  methods: [
    { name: 'get_doi', display: 'Get metadata for a DOI', cost: 1, params: 'doi', inputs: [
      { name: 'doi', type: 'string', required: true, desc: 'DOI identifier (e.g. 10.1234/example)' },
    ]},
    { name: 'search_dois', display: 'Search DOIs by query', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 100)' },
    ]},
    { name: 'get_stats', display: 'Get DOI registration statistics', cost: 1, params: 'client_id?', inputs: [
      { name: 'client_id', type: 'string', required: false, desc: 'DataCite client ID for institution-specific stats' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-datacite — DataCite DOI Metadata MCP Server
 * Wraps DataCite REST API with SettleGrid billing.
 *
 * DataCite is a global DOI registration agency providing persistent
 * identifiers for research data, publications, and other scholarly outputs.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DataciteDoi {
  id: string
  type: string
  attributes: {
    doi: string
    titles: { title: string }[]
    creators: { name: string; nameType: string }[]
    publicationYear: number | null
    types: { resourceTypeGeneral: string; resourceType: string }
    publisher: string | null
    url: string | null
    descriptions: { description: string; descriptionType: string }[]
    subjects: { subject: string }[]
    registered: string | null
  }
}

interface DataciteSearchResult {
  meta: { total: number; totalPages: number }
  data: DataciteDoi[]
}

interface DataciteStats {
  total: number
  byYear: Record<string, number>
  byType: Record<string, number>
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.datacite.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function validateDoi(doi: string): string {
  const clean = doi.trim().replace(/^https?:\\/\\/doi\\.org\\//, '')
  if (!clean.startsWith('10.')) throw new Error(\`Invalid DOI: \${doi}. Must start with 10.\`)
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'datacite' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getDoi(doi: string): Promise<DataciteDoi> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_doi', async () => {
    const result = await apiFetch<{ data: DataciteDoi }>(\`/dois/\${encodeURIComponent(cleanDoi)}\`)
    return result.data
  })
}

async function searchDois(query: string, limit?: number): Promise<DataciteSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_dois', async () => {
    return apiFetch<DataciteSearchResult>(\`/dois?query=\${q}&page[size]=\${l}\`)
  })
}

async function getStats(clientId?: string): Promise<DataciteStats> {
  return sg.wrap('get_stats', async () => {
    const filter = clientId ? \`&client-id=\${encodeURIComponent(clientId)}\` : ''
    const data = await apiFetch<any>(\`/dois?page[size]=0\${filter}\`)
    const meta = data.meta || {}
    return {
      total: meta.total || 0,
      byYear: meta['published'] || {},
      byType: meta['resource-types'] || {},
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getDoi, searchDois, getStats }
export type { DataciteDoi, DataciteSearchResult, DataciteStats }
console.log('settlegrid-datacite server started')
`,
})

// ─── 147. europe-pmc ────────────────────────────────────────────────────────
gen({
  slug: 'europe-pmc',
  title: 'Europe PMC',
  desc: 'Search and retrieve biomedical and life science articles from European PubMed Central. Free and open access.',
  api: { base: 'https://www.ebi.ac.uk/europepmc/webservices/rest', name: 'Europe PMC', docs: 'https://europepmc.org/RestfulWebService' },
  key: null,
  keywords: ['europepmc', 'pubmed', 'biomedical', 'life-sciences', 'articles'],
  methods: [
    { name: 'search_articles', display: 'Search biomedical articles', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query (supports EuropePMC syntax)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 100)' },
    ]},
    { name: 'get_article', display: 'Get article by ID', cost: 1, params: 'id, source?', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Article ID (PMID, PMC ID, or DOI)' },
      { name: 'source', type: 'string', required: false, desc: 'Source database: MED, PMC, or DOI (default: MED)' },
    ]},
    { name: 'get_citations', display: 'Get citations for an article', cost: 2, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'PubMed ID (PMID) of the article' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-europe-pmc — Europe PMC MCP Server
 * Wraps European PubMed Central API with SettleGrid billing.
 *
 * Europe PMC provides access to millions of biomedical and life science
 * publications from PubMed, PMC, patents, and other sources.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EpmcArticle {
  id: string
  source: string
  pmid: string | null
  pmcid: string | null
  doi: string | null
  title: string
  authorString: string
  journalTitle: string | null
  pubYear: string | null
  abstractText: string | null
  citedByCount: number
  isOpenAccess: string
}

interface EpmcSearchResult {
  hitCount: number
  resultList: { result: EpmcArticle[] }
}

interface EpmcCitation {
  id: string
  source: string
  title: string
  authorString: string
  journalAbbreviation: string | null
  pubYear: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'europe-pmc' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchArticles(query: string, limit?: number): Promise<EpmcSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_articles', async () => {
    return apiFetch<EpmcSearchResult>(
      \`/search?query=\${q}&resultType=core&pageSize=\${l}&format=json\`
    )
  })
}

async function getArticle(id: string, source?: string): Promise<EpmcArticle> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const src = (source || 'MED').toUpperCase()
  if (!['MED', 'PMC', 'DOI'].includes(src)) {
    throw new Error(\`Invalid source: \${source}. Must be MED, PMC, or DOI\`)
  }
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_article', async () => {
    const result = await apiFetch<EpmcSearchResult>(
      \`/search?query=\${src === 'DOI' ? 'DOI:' : 'EXT_ID:'}\${cleanId} SRC:\${src}&resultType=core&format=json\`
    )
    const articles = result.resultList?.result || []
    if (!articles.length) throw new Error(\`No article found with ID \${id} in \${src}\`)
    return articles[0]
  })
}

async function getCitations(id: string): Promise<{ total: number; citations: EpmcCitation[] }> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_citations', async () => {
    const data = await apiFetch<any>(
      \`/MED/\${cleanId}/citations?format=json&page=1&pageSize=25\`
    )
    return {
      total: data.hitCount || 0,
      citations: (data.citationList?.citation || []) as EpmcCitation[],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchArticles, getArticle, getCitations }
export type { EpmcArticle, EpmcSearchResult, EpmcCitation }
console.log('settlegrid-europe-pmc server started')
`,
})

// ─── 148. bioarxiv ──────────────────────────────────────────────────────────
gen({
  slug: 'bioarxiv',
  title: 'bioRxiv Biology Preprints',
  desc: 'Access biology preprints from bioRxiv including recent papers, search, and paper details. No API key needed.',
  api: { base: 'https://api.biorxiv.org/details/biorxiv', name: 'bioRxiv', docs: 'https://api.biorxiv.org/' },
  key: null,
  keywords: ['biorxiv', 'preprints', 'biology', 'life-sciences', 'research'],
  methods: [
    { name: 'get_recent', display: 'Get recent biology preprints', cost: 1, params: 'days?, limit?', inputs: [
      { name: 'days', type: 'number', required: false, desc: 'Number of days to look back (default: 7, max: 30)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20, max: 100)' },
    ]},
    { name: 'search_papers', display: 'Search biology preprints', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for biology papers' },
    ]},
    { name: 'get_paper', display: 'Get paper by DOI', cost: 1, params: 'doi', inputs: [
      { name: 'doi', type: 'string', required: true, desc: 'bioRxiv DOI (e.g. 10.1101/2024.01.01.123456)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-bioarxiv — bioRxiv Biology Preprints MCP Server
 * Wraps bioRxiv API with SettleGrid billing.
 *
 * bioRxiv is a free online archive and distribution service for
 * unpublished preprints in the life sciences.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface BiorxivPaper {
  doi: string
  title: string
  authors: string
  author_corresponding: string
  author_corresponding_institution: string
  date: string
  version: string
  type: string
  category: string
  jatsxml: string | null
  abstract: string
  published: string | null
}

interface BiorxivResponse {
  messages: { status: string; count: number; total: number }[]
  collection: BiorxivPaper[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.biorxiv.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'bioarxiv' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRecent(days?: number, limit?: number): Promise<BiorxivResponse> {
  const d = clamp(days, 1, 30, 7)
  const l = clamp(limit, 1, 100, 20)
  return sg.wrap('get_recent', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - d * 86400000)
    return apiFetch<BiorxivResponse>(
      \`/details/biorxiv/\${formatDate(start)}/\${formatDate(end)}/0/\${l}\`
    )
  })
}

async function searchPapers(query: string): Promise<BiorxivResponse> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_papers', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - 365 * 86400000)
    const data = await apiFetch<BiorxivResponse>(
      \`/details/biorxiv/\${formatDate(start)}/\${formatDate(end)}/0/50\`
    )
    const q = query.toLowerCase()
    data.collection = data.collection.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.abstract.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
    return data
  })
}

async function getPaper(doi: string): Promise<BiorxivPaper> {
  if (!doi || typeof doi !== 'string') throw new Error('doi is required')
  const cleanDoi = doi.trim().replace(/^https?:\\/\\/doi\\.org\\//, '')
  return sg.wrap('get_paper', async () => {
    const data = await apiFetch<BiorxivResponse>(
      \`/details/biorxiv/\${encodeURIComponent(cleanDoi)}\`
    )
    if (!data.collection || data.collection.length === 0) {
      throw new Error(\`No bioRxiv paper found for DOI: \${doi}\`)
    }
    return data.collection[data.collection.length - 1]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRecent, searchPapers, getPaper }
export type { BiorxivPaper, BiorxivResponse }
console.log('settlegrid-bioarxiv server started')
`,
})

// ─── 149. medrxiv ───────────────────────────────────────────────────────────
gen({
  slug: 'medrxiv',
  title: 'medRxiv Medical Preprints',
  desc: 'Access medical and health science preprints from medRxiv including recent papers, search, and details. No API key needed.',
  api: { base: 'https://api.biorxiv.org/details/medrxiv', name: 'medRxiv', docs: 'https://api.biorxiv.org/' },
  key: null,
  keywords: ['medrxiv', 'preprints', 'medical', 'health', 'clinical-research'],
  methods: [
    { name: 'get_recent', display: 'Get recent medical preprints', cost: 1, params: 'days?, limit?', inputs: [
      { name: 'days', type: 'number', required: false, desc: 'Days to look back (default: 7, max: 30)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20, max: 100)' },
    ]},
    { name: 'search_papers', display: 'Search medical preprints', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for medical papers' },
    ]},
    { name: 'get_paper', display: 'Get paper by DOI', cost: 1, params: 'doi', inputs: [
      { name: 'doi', type: 'string', required: true, desc: 'medRxiv DOI' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-medrxiv — medRxiv Medical Preprints MCP Server
 * Wraps medRxiv API with SettleGrid billing.
 *
 * medRxiv is a free online archive for complete but unpublished
 * manuscripts in the medical, clinical, and related health sciences.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MedrxivPaper {
  doi: string
  title: string
  authors: string
  author_corresponding: string
  author_corresponding_institution: string
  date: string
  version: string
  type: string
  category: string
  abstract: string
  published: string | null
}

interface MedrxivResponse {
  messages: { status: string; count: number; total: number }[]
  collection: MedrxivPaper[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.biorxiv.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'medrxiv' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRecent(days?: number, limit?: number): Promise<MedrxivResponse> {
  const d = clamp(days, 1, 30, 7)
  const l = clamp(limit, 1, 100, 20)
  return sg.wrap('get_recent', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - d * 86400000)
    return apiFetch<MedrxivResponse>(
      \`/details/medrxiv/\${formatDate(start)}/\${formatDate(end)}/0/\${l}\`
    )
  })
}

async function searchPapers(query: string): Promise<MedrxivResponse> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_papers', async () => {
    const end = new Date()
    const start = new Date(end.getTime() - 365 * 86400000)
    const data = await apiFetch<MedrxivResponse>(
      \`/details/medrxiv/\${formatDate(start)}/\${formatDate(end)}/0/50\`
    )
    const q = query.toLowerCase()
    data.collection = data.collection.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.abstract.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
    return data
  })
}

async function getPaper(doi: string): Promise<MedrxivPaper> {
  if (!doi || typeof doi !== 'string') throw new Error('doi is required')
  const cleanDoi = doi.trim().replace(/^https?:\\/\\/doi\\.org\\//, '')
  return sg.wrap('get_paper', async () => {
    const data = await apiFetch<MedrxivResponse>(
      \`/details/medrxiv/\${encodeURIComponent(cleanDoi)}\`
    )
    if (!data.collection || data.collection.length === 0) {
      throw new Error(\`No medRxiv paper found for DOI: \${doi}\`)
    }
    return data.collection[data.collection.length - 1]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRecent, searchPapers, getPaper }
export type { MedrxivPaper, MedrxivResponse }
console.log('settlegrid-medrxiv server started')
`,
})

// ─── 150. ssrn ──────────────────────────────────────────────────────────────
gen({
  slug: 'ssrn',
  title: 'SSRN Social Science Papers',
  desc: 'Search social science research papers, authors, and metadata via Semantic Scholar proxy. No API key needed.',
  api: { base: 'https://api.semanticscholar.org/graph/v1', name: 'Semantic Scholar', docs: 'https://api.semanticscholar.org/' },
  key: null,
  keywords: ['ssrn', 'social-science', 'economics', 'law', 'papers'],
  methods: [
    { name: 'search_papers', display: 'Search social science papers', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for social science papers' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 100)' },
    ]},
    { name: 'get_paper', display: 'Get paper by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Semantic Scholar paper ID, DOI, or SSRN ID' },
    ]},
    { name: 'get_author', display: 'Get author profile and papers', cost: 2, params: 'authorId', inputs: [
      { name: 'authorId', type: 'string', required: true, desc: 'Semantic Scholar author ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-ssrn — SSRN Social Science Papers MCP Server
 * Wraps Semantic Scholar API with SettleGrid billing.
 *
 * Provides access to social science research through Semantic Scholar,
 * including SSRN papers, economics, law, and management research.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SsrnPaper {
  paperId: string
  title: string
  abstract: string | null
  year: number | null
  citationCount: number
  authors: { authorId: string; name: string }[]
  url: string
  venue: string | null
  fieldsOfStudy: string[] | null
  externalIds: Record<string, string>
}

interface SsrnSearchResult {
  total: number
  offset: number
  data: SsrnPaper[]
}

interface SsrnAuthor {
  authorId: string
  name: string
  affiliations: string[]
  paperCount: number
  citationCount: number
  hIndex: number
  papers: SsrnPaper[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.semanticscholar.org/graph/v1'
const PAPER_FIELDS = 'paperId,title,abstract,year,citationCount,authors,url,venue,fieldsOfStudy,externalIds'
const AUTHOR_FIELDS = 'authorId,name,affiliations,paperCount,citationCount,hIndex'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'ssrn' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<SsrnSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 100, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<SsrnSearchResult>(
      \`/paper/search?query=\${q}&limit=\${l}&fields=\${PAPER_FIELDS}&fieldsOfStudy=Economics,Sociology,Political+Science,Law,Business\`
    )
  })
}

async function getPaper(id: string): Promise<SsrnPaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = encodeURIComponent(id.trim())
  return sg.wrap('get_paper', async () => {
    return apiFetch<SsrnPaper>(\`/paper/\${cleanId}?fields=\${PAPER_FIELDS}\`)
  })
}

async function getAuthor(authorId: string): Promise<SsrnAuthor> {
  if (!authorId || typeof authorId !== 'string') throw new Error('authorId is required')
  const cleanId = encodeURIComponent(authorId.trim())
  return sg.wrap('get_author', async () => {
    const author = await apiFetch<any>(\`/author/\${cleanId}?fields=\${AUTHOR_FIELDS}\`)
    const papersData = await apiFetch<any>(
      \`/author/\${cleanId}/papers?fields=\${PAPER_FIELDS}&limit=10\`
    )
    return { ...author, papers: papersData.data || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, getAuthor }
export type { SsrnPaper, SsrnSearchResult, SsrnAuthor }
console.log('settlegrid-ssrn server started')
`,
})

// ─── 151. repec ─────────────────────────────────────────────────────────────
gen({
  slug: 'repec',
  title: 'RePEc Economics Papers',
  desc: 'Search economics research papers, journals, and working papers via OpenAlex proxy. No API key needed.',
  api: { base: 'https://api.openalex.org/works', name: 'OpenAlex', docs: 'https://docs.openalex.org/' },
  key: null,
  keywords: ['repec', 'economics', 'working-papers', 'journals', 'finance'],
  methods: [
    { name: 'search_papers', display: 'Search economics papers', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for economics papers' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 50)' },
    ]},
    { name: 'get_paper', display: 'Get paper by OpenAlex ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'OpenAlex work ID or DOI' },
    ]},
    { name: 'list_journals', display: 'List economics journals', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20, max: 50)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-repec — RePEc Economics Papers MCP Server
 * Wraps OpenAlex API with SettleGrid billing for economics research.
 *
 * Provides access to economics working papers, journal articles,
 * and research via OpenAlex filtered for economics content.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EconPaper {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  authorships: { author: { id: string; display_name: string } }[]
  primary_location: { source: { display_name: string } | null } | null
  abstract_inverted_index: Record<string, number[]> | null
  type: string
  open_access: { is_oa: boolean; oa_url: string | null }
}

interface EconSearchResult {
  meta: { count: number; per_page: number; page: number }
  results: EconPaper[]
}

interface EconJournal {
  id: string
  display_name: string
  issn: string[] | null
  works_count: number
  cited_by_count: number
  type: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.openalex.org'
const ECON_CONCEPT = 'C162324750'
const EMAIL = 'contact@settlegrid.ai'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(\`\${url}\${sep}mailto=\${EMAIL}\`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function reconstructAbstract(index: Record<string, number[]> | null): string | null {
  if (!index) return null
  const words: [string, number][] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words.push([word, pos])
  }
  words.sort((a, b) => a[1] - b[1])
  return words.map(w => w[0]).join(' ')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'repec' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPapers(query: string, limit?: number): Promise<EconSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_papers', async () => {
    return apiFetch<EconSearchResult>(
      \`/works?search=\${q}&filter=concepts.id:\${ECON_CONCEPT}&per_page=\${l}&sort=cited_by_count:desc\`
    )
  })
}

async function getPaper(id: string): Promise<EconPaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = id.trim()
  return sg.wrap('get_paper', async () => {
    const path = cleanId.startsWith('10.') ? \`/works/doi:\${cleanId}\` : \`/works/\${cleanId}\`
    return apiFetch<EconPaper>(path)
  })
}

async function listJournals(limit?: number): Promise<{ results: EconJournal[] }> {
  const l = clamp(limit, 1, 50, 20)
  return sg.wrap('list_journals', async () => {
    return apiFetch<{ results: EconJournal[] }>(
      \`/sources?filter=concepts.id:\${ECON_CONCEPT},type:journal&per_page=\${l}&sort=cited_by_count:desc\`
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPapers, getPaper, listJournals }
export type { EconPaper, EconSearchResult, EconJournal }
console.log('settlegrid-repec server started')
`,
})

// ─── 152. math-genealogy ────────────────────────────────────────────────────
gen({
  slug: 'math-genealogy',
  title: 'Mathematics Genealogy',
  desc: 'Search mathematicians, their works, and academic lineage via OpenAlex API. No API key needed.',
  api: { base: 'https://api.openalex.org', name: 'OpenAlex', docs: 'https://docs.openalex.org/' },
  key: null,
  keywords: ['mathematics', 'genealogy', 'mathematicians', 'academic', 'research'],
  methods: [
    { name: 'search_mathematicians', display: 'Search mathematicians by name', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Mathematician name to search' },
    ]},
    { name: 'get_author', display: 'Get author profile', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'OpenAlex author ID' },
    ]},
    { name: 'get_works', display: 'Get works by an author', cost: 2, params: 'authorId, limit?', inputs: [
      { name: 'authorId', type: 'string', required: true, desc: 'OpenAlex author ID' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20, max: 50)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-math-genealogy — Mathematics Genealogy MCP Server
 * Wraps OpenAlex API with SettleGrid billing for mathematics research.
 *
 * Access mathematician profiles, their published works, and academic
 * connections via the OpenAlex scholarly database.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MathAuthor {
  id: string
  display_name: string
  works_count: number
  cited_by_count: number
  last_known_institutions: { id: string; display_name: string; country_code: string }[]
  x_concepts: { id: string; display_name: string; score: number }[]
  summary_stats: { h_index: number; i10_index: number } | null
}

interface MathWork {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  type: string
  primary_location: { source: { display_name: string } | null } | null
  authorships: { author: { id: string; display_name: string } }[]
  abstract_inverted_index: Record<string, number[]> | null
}

interface AuthorSearchResult {
  meta: { count: number }
  results: MathAuthor[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.openalex.org'
const MATH_CONCEPT = 'C33923547'
const EMAIL = 'contact@settlegrid.ai'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(\`\${url}\${sep}mailto=\${EMAIL}\`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'math-genealogy' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchMathematicians(name: string): Promise<AuthorSearchResult> {
  if (!name || typeof name !== 'string') throw new Error('name is required')
  const q = encodeURIComponent(name.trim())
  return sg.wrap('search_mathematicians', async () => {
    return apiFetch<AuthorSearchResult>(
      \`/authors?search=\${q}&filter=concepts.id:\${MATH_CONCEPT}&per_page=10&sort=cited_by_count:desc\`
    )
  })
}

async function getAuthor(id: string): Promise<MathAuthor> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  return sg.wrap('get_author', async () => {
    return apiFetch<MathAuthor>(\`/authors/\${encodeURIComponent(id.trim())}\`)
  })
}

async function getWorks(authorId: string, limit?: number): Promise<{ meta: { count: number }; results: MathWork[] }> {
  if (!authorId || typeof authorId !== 'string') throw new Error('authorId is required')
  const l = clamp(limit, 1, 50, 20)
  return sg.wrap('get_works', async () => {
    return apiFetch<{ meta: { count: number }; results: MathWork[] }>(
      \`/works?filter=authorships.author.id:\${encodeURIComponent(authorId.trim())}&per_page=\${l}&sort=publication_year:desc\`
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchMathematicians, getAuthor, getWorks }
export type { MathAuthor, MathWork, AuthorSearchResult }
console.log('settlegrid-math-genealogy server started')
`,
})

// ─── 153. retraction-watch ──────────────────────────────────────────────────
gen({
  slug: 'retraction-watch',
  title: 'Retraction Watch',
  desc: 'Search retracted papers and retraction statistics via OpenAlex filtered for retracted works. No API key needed.',
  api: { base: 'https://api.openalex.org/works?filter=is_retracted:true', name: 'OpenAlex', docs: 'https://docs.openalex.org/' },
  key: null,
  keywords: ['retractions', 'retracted', 'integrity', 'research', 'misconduct'],
  methods: [
    { name: 'search_retractions', display: 'Search retracted papers', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for retracted papers' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 50)' },
    ]},
    { name: 'get_retraction', display: 'Get retraction details', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'OpenAlex work ID or DOI' },
    ]},
    { name: 'get_stats', display: 'Get retraction statistics', cost: 1, params: 'year?', inputs: [
      { name: 'year', type: 'number', required: false, desc: 'Filter stats by year' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-retraction-watch — Retraction Watch MCP Server
 * Wraps OpenAlex API with SettleGrid billing for retracted papers.
 *
 * Search and analyze retracted research papers to help maintain
 * scientific integrity and identify problematic research.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RetractedPaper {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  is_retracted: boolean
  type: string
  authorships: { author: { id: string; display_name: string } }[]
  primary_location: { source: { display_name: string } | null } | null
  open_access: { is_oa: boolean; oa_url: string | null }
}

interface RetractionSearchResult {
  meta: { count: number; per_page: number; page: number }
  results: RetractedPaper[]
}

interface RetractionStats {
  totalRetracted: number
  year: number | null
  byType: Record<string, number>
  topJournals: { name: string; count: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.openalex.org'
const EMAIL = 'contact@settlegrid.ai'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(\`\${url}\${sep}mailto=\${EMAIL}\`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'retraction-watch' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchRetractions(query: string, limit?: number): Promise<RetractionSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_retractions', async () => {
    return apiFetch<RetractionSearchResult>(
      \`/works?search=\${q}&filter=is_retracted:true&per_page=\${l}&sort=publication_year:desc\`
    )
  })
}

async function getRetraction(id: string): Promise<RetractedPaper> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = id.trim()
  return sg.wrap('get_retraction', async () => {
    const path = cleanId.startsWith('10.') ? \`/works/doi:\${cleanId}\` : \`/works/\${cleanId}\`
    const paper = await apiFetch<RetractedPaper>(path)
    if (!paper.is_retracted) {
      console.warn(\`Note: Paper \${id} is not marked as retracted\`)
    }
    return paper
  })
}

async function getStats(year?: number): Promise<RetractionStats> {
  return sg.wrap('get_stats', async () => {
    const yearFilter = year ? \`,publication_year:\${year}\` : ''
    const data = await apiFetch<any>(
      \`/works?filter=is_retracted:true\${yearFilter}&group_by=type&per_page=0\`
    )
    const byType: Record<string, number> = {}
    for (const g of (data.group_by || [])) {
      byType[g.key] = g.count
    }
    return {
      totalRetracted: data.meta?.count || 0,
      year: year || null,
      byType,
      topJournals: [],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchRetractions, getRetraction, getStats }
export type { RetractedPaper, RetractionSearchResult, RetractionStats }
console.log('settlegrid-retraction-watch server started')
`,
})

// ─── 154. altmetric ─────────────────────────────────────────────────────────
gen({
  slug: 'altmetric',
  title: 'Altmetric Research Impact',
  desc: 'Retrieve research impact and attention data including social media mentions, news, and policy citations via Altmetric.',
  api: { base: 'https://api.altmetric.com/v1', name: 'Altmetric', docs: 'https://www.altmetric.com/products/altmetric-api/' },
  key: { env: 'ALTMETRIC_API_KEY', url: 'https://www.altmetric.com/products/altmetric-api/', required: false },
  keywords: ['altmetric', 'impact', 'citations', 'social-media', 'research'],
  methods: [
    { name: 'get_article', display: 'Get altmetric data for a DOI', cost: 1, params: 'doi', inputs: [
      { name: 'doi', type: 'string', required: true, desc: 'Article DOI (e.g. 10.1038/nature12373)' },
    ]},
    { name: 'get_citations', display: 'Get citation breakdown for a DOI', cost: 2, params: 'doi', inputs: [
      { name: 'doi', type: 'string', required: true, desc: 'Article DOI' },
    ]},
    { name: 'search_articles', display: 'Search by keyword', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for articles with altmetric data' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-altmetric — Altmetric Research Impact MCP Server
 * Wraps Altmetric API with SettleGrid billing.
 *
 * Altmetric tracks the online attention that research outputs receive,
 * including mentions in news, social media, policy documents, and more.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface AltmetricArticle {
  altmetric_id: number
  doi: string
  title: string
  score: number
  cited_by_tweeters_count: number
  cited_by_fbwalls_count: number
  cited_by_feeds_count: number
  cited_by_policies_count: number
  cited_by_msm_count: number
  cited_by_wikipedia_count: number
  cited_by_posts_count: number
  details_url: string
  published_on: number | null
  journal: string | null
  authors: string[]
  subjects: string[]
}

interface AltmetricCitations {
  doi: string
  score: number
  twitter: number
  facebook: number
  news: number
  blogs: number
  policy: number
  wikipedia: number
  reddit: number
  total_posts: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.altmetric.com/v1'
const API_KEY = process.env.ALTMETRIC_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const sep = url.includes('?') ? '&' : '?'
  const keyParam = API_KEY ? \`\${sep}key=\${API_KEY}\` : ''
  const res = await fetch(\`\${url}\${keyParam}\`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateDoi(doi: string): string {
  const clean = doi.trim().replace(/^https?:\\/\\/doi\\.org\\//, '')
  if (!clean.startsWith('10.')) throw new Error(\`Invalid DOI: \${doi}. Must start with 10.\`)
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'altmetric' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getArticle(doi: string): Promise<AltmetricArticle> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_article', async () => {
    return apiFetch<AltmetricArticle>(\`/doi/\${cleanDoi}\`)
  })
}

async function getCitations(doi: string): Promise<AltmetricCitations> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_citations', async () => {
    const data = await apiFetch<any>(\`/doi/\${cleanDoi}\`)
    return {
      doi: cleanDoi,
      score: data.score || 0,
      twitter: data.cited_by_tweeters_count || 0,
      facebook: data.cited_by_fbwalls_count || 0,
      news: data.cited_by_msm_count || 0,
      blogs: data.cited_by_feeds_count || 0,
      policy: data.cited_by_policies_count || 0,
      wikipedia: data.cited_by_wikipedia_count || 0,
      reddit: data.cited_by_rdts_count || 0,
      total_posts: data.cited_by_posts_count || 0,
    }
  })
}

async function searchArticles(query: string): Promise<{ results: AltmetricArticle[] }> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_articles', async () => {
    const q = encodeURIComponent(query.trim())
    const data = await apiFetch<any>(\`/citations/1d?q=\${q}&num_results=10\`)
    return { results: data.results || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getArticle, getCitations, searchArticles }
export type { AltmetricArticle, AltmetricCitations }
console.log('settlegrid-altmetric server started')
`,
})

// ─── 155. dimensions ────────────────────────────────────────────────────────
gen({
  slug: 'dimensions',
  title: 'Dimensions Research Analytics',
  desc: 'Search publications, get research statistics, and analyze academic output via OpenAlex proxy. No API key needed.',
  api: { base: 'https://api.openalex.org', name: 'OpenAlex', docs: 'https://docs.openalex.org/' },
  key: null,
  keywords: ['dimensions', 'research', 'analytics', 'publications', 'academic'],
  methods: [
    { name: 'search_publications', display: 'Search scholarly publications', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for publications' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 50)' },
    ]},
    { name: 'get_publication', display: 'Get publication by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'OpenAlex work ID or DOI' },
    ]},
    { name: 'get_stats', display: 'Get research statistics by field', cost: 1, params: 'field?', inputs: [
      { name: 'field', type: 'string', required: false, desc: 'Research field to filter (e.g. Medicine, Computer Science)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-dimensions — Dimensions Research Analytics MCP Server
 * Wraps OpenAlex API with SettleGrid billing for research analytics.
 *
 * Provides publication search, detailed metadata, and research statistics
 * across disciplines via the OpenAlex scholarly database.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Publication {
  id: string
  doi: string | null
  title: string
  publication_year: number | null
  cited_by_count: number
  type: string
  authorships: { author: { id: string; display_name: string }; institutions: { display_name: string }[] }[]
  primary_location: { source: { display_name: string; type: string } | null } | null
  open_access: { is_oa: boolean; oa_url: string | null }
  concepts: { id: string; display_name: string; score: number }[]
}

interface PublicationSearch {
  meta: { count: number; per_page: number; page: number }
  results: Publication[]
}

interface FieldStats {
  field: string | null
  totalWorks: number
  totalCitations: number
  oaPercentage: number
  topConcepts: { name: string; count: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.openalex.org'
const EMAIL = 'contact@settlegrid.ai'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(\`\${url}\${sep}mailto=\${EMAIL}\`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'dimensions' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPublications(query: string, limit?: number): Promise<PublicationSearch> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_publications', async () => {
    return apiFetch<PublicationSearch>(
      \`/works?search=\${q}&per_page=\${l}&sort=cited_by_count:desc\`
    )
  })
}

async function getPublication(id: string): Promise<Publication> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = id.trim()
  return sg.wrap('get_publication', async () => {
    const path = cleanId.startsWith('10.') ? \`/works/doi:\${cleanId}\` : \`/works/\${cleanId}\`
    return apiFetch<Publication>(path)
  })
}

async function getStats(field?: string): Promise<FieldStats> {
  return sg.wrap('get_stats', async () => {
    let filter = ''
    if (field) {
      const concepts = await apiFetch<any>(\`/concepts?search=\${encodeURIComponent(field)}&per_page=1\`)
      if (concepts.results?.[0]) {
        filter = \`&filter=concepts.id:\${concepts.results[0].id}\`
      }
    }
    const data = await apiFetch<any>(\`/works?per_page=0\${filter}&group_by=open_access.is_oa\`)
    const groups = data.group_by || []
    const oaTrue = groups.find((g: any) => g.key === 'true')?.count || 0
    const oaFalse = groups.find((g: any) => g.key === 'false')?.count || 0
    const total = oaTrue + oaFalse
    return {
      field: field || null,
      totalWorks: data.meta?.count || total,
      totalCitations: 0,
      oaPercentage: total > 0 ? Math.round((oaTrue / total) * 100) : 0,
      topConcepts: [],
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPublications, getPublication, getStats }
export type { Publication, PublicationSearch, FieldStats }
console.log('settlegrid-dimensions server started')
`,
})

// ─── 156. lens-org ──────────────────────────────────────────────────────────
gen({
  slug: 'lens-org',
  title: 'Lens.org Patent & Scholarly Search',
  desc: 'Search patents and scholarly articles via the Lens.org API. Free API key required.',
  api: { base: 'https://api.lens.org', name: 'Lens.org', docs: 'https://docs.api.lens.org/' },
  key: { env: 'LENS_API_KEY', url: 'https://www.lens.org/lens/user/subscriptions', required: true },
  keywords: ['lens', 'patents', 'scholarly', 'search', 'intellectual-property'],
  methods: [
    { name: 'search_scholarly', display: 'Search scholarly articles', cost: 2, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for scholarly articles' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 50)' },
    ]},
    { name: 'search_patents', display: 'Search patents', cost: 2, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for patents' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 50)' },
    ]},
    { name: 'get_record', display: 'Get scholarly record by Lens ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Lens ID of the scholarly record' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-lens-org — Lens.org Patent & Scholarly Search MCP Server
 * Wraps Lens.org API with SettleGrid billing.
 *
 * Lens.org provides free, open access to patent and scholarly search,
 * linking 240M+ patents and scholarly works for integrated discovery.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface LensScholarlyRecord {
  lens_id: string
  title: string
  date_published: string | null
  year_published: number | null
  abstract: string | null
  source: { title: string; type: string } | null
  authors: { display_name: string; affiliations: { name: string }[] }[]
  external_ids: { type: string; value: string }[]
  scholarly_citations_count: number
  open_access: { licence: string; colour: string } | null
}

interface LensPatentRecord {
  lens_id: string
  title: string
  date_published: string | null
  abstract: string | null
  applicants: { name: string }[]
  inventors: { name: string }[]
  jurisdiction: string
  document_type: string
  classifications: { symbol: string }[]
}

interface LensSearchResult<T> {
  total: number
  data: T[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.lens.org'
const API_KEY = process.env.LENS_API_KEY || ''

async function apiPost<T>(path: string, body: object): Promise<T> {
  if (!API_KEY) throw new Error('LENS_API_KEY environment variable is required')
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${text.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('LENS_API_KEY environment variable is required')
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'lens-org' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchScholarly(query: string, limit?: number): Promise<LensSearchResult<LensScholarlyRecord>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_scholarly', async () => {
    return apiPost<LensSearchResult<LensScholarlyRecord>>('/scholarly/search', {
      query: { match: { title: query.trim() } },
      size: l,
      sort: [{ relevance: 'desc' }],
    })
  })
}

async function searchPatents(query: string, limit?: number): Promise<LensSearchResult<LensPatentRecord>> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_patents', async () => {
    return apiPost<LensSearchResult<LensPatentRecord>>('/patent/search', {
      query: { match: { title: query.trim() } },
      size: l,
      sort: [{ relevance: 'desc' }],
    })
  })
}

async function getRecord(id: string): Promise<LensScholarlyRecord> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  return sg.wrap('get_record', async () => {
    const result = await apiPost<LensSearchResult<LensScholarlyRecord>>('/scholarly/search', {
      query: { match: { lens_id: id.trim() } },
      size: 1,
    })
    if (!result.data?.length) throw new Error(\`No record found with Lens ID: \${id}\`)
    return result.data[0]
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchScholarly, searchPatents, getRecord }
export type { LensScholarlyRecord, LensPatentRecord, LensSearchResult }
console.log('settlegrid-lens-org server started')
`,
})

// ─── 157. openapc ───────────────────────────────────────────────────────────
gen({
  slug: 'openapc',
  title: 'OpenAPC Publication Costs',
  desc: 'Access article processing charge (APC) data, institutional spending, and open access costs via the OpenAPC OLAP API.',
  api: { base: 'https://olap.openapc.net/cube/openapc/aggregate', name: 'OpenAPC', docs: 'https://github.com/OpenAPC/openapc-de/wiki/OLAP-API' },
  key: null,
  keywords: ['openapc', 'apc', 'publication-costs', 'open-access', 'fees'],
  methods: [
    { name: 'get_costs', display: 'Get APC costs by institution/year', cost: 1, params: 'institution?, year?', inputs: [
      { name: 'institution', type: 'string', required: false, desc: 'Institution name to filter' },
      { name: 'year', type: 'number', required: false, desc: 'Publication year to filter' },
    ]},
    { name: 'list_institutions', display: 'List institutions with APC data', cost: 1, params: '', inputs: [] },
    { name: 'get_stats', display: 'Get APC spending statistics', cost: 1, params: 'year?', inputs: [
      { name: 'year', type: 'number', required: false, desc: 'Year to filter statistics' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-openapc — OpenAPC Publication Costs MCP Server
 * Wraps OpenAPC OLAP API with SettleGrid billing.
 *
 * OpenAPC collects and disseminates data on article processing charges
 * (APCs) paid by universities and research institutions worldwide.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ApcCostResult {
  institution: string | null
  year: number | null
  totalEur: number
  articleCount: number
  avgCostEur: number
  drilldown: { key: string; amount: number; count: number }[]
}

interface ApcInstitution {
  name: string
  totalArticles: number
  totalSpendEur: number
}

interface ApcStats {
  year: number | null
  totalArticles: number
  totalSpendEur: number
  avgCostEur: number
  byPublisher: { publisher: string; count: number; totalEur: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://olap.openapc.net/cube/openapc'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'openapc' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCosts(institution?: string, year?: number): Promise<ApcCostResult> {
  return sg.wrap('get_costs', async () => {
    const cuts: string[] = []
    if (institution) cuts.push(\`institution:\${encodeURIComponent(institution)}\`)
    if (year) cuts.push(\`period:\${year}\`)
    const cutParam = cuts.length > 0 ? \`&cut=\${cuts.join('|')}\` : ''
    const drillParam = institution ? 'drilldown=period' : 'drilldown=institution'
    const data = await apiFetch<any>(
      \`/aggregate?\${drillParam}&order=amount:desc\${cutParam}\`
    )
    const cells = data.cells || []
    let totalEur = 0
    let articleCount = 0
    const drilldown = cells.slice(0, 20).map((c: any) => {
      totalEur += c.amount || 0
      articleCount += c.num_items || 0
      return {
        key: c.institution || c.period?.toString() || 'unknown',
        amount: c.amount || 0,
        count: c.num_items || 0,
      }
    })
    return {
      institution: institution || null,
      year: year || null,
      totalEur,
      articleCount,
      avgCostEur: articleCount > 0 ? Math.round(totalEur / articleCount) : 0,
      drilldown,
    }
  })
}

async function listInstitutions(): Promise<{ institutions: ApcInstitution[] }> {
  return sg.wrap('list_institutions', async () => {
    const data = await apiFetch<any>(
      '/aggregate?drilldown=institution&order=amount:desc&pagesize=50'
    )
    const institutions: ApcInstitution[] = (data.cells || []).map((c: any) => ({
      name: c.institution || 'Unknown',
      totalArticles: c.num_items || 0,
      totalSpendEur: c.amount || 0,
    }))
    return { institutions }
  })
}

async function getStatsData(year?: number): Promise<ApcStats> {
  return sg.wrap('get_stats', async () => {
    const cutParam = year ? \`&cut=period:\${year}\` : ''
    const data = await apiFetch<any>(
      \`/aggregate?drilldown=publisher&order=amount:desc&pagesize=20\${cutParam}\`
    )
    const cells = data.cells || []
    let totalArticles = 0
    let totalSpendEur = 0
    const byPublisher = cells.map((c: any) => {
      totalArticles += c.num_items || 0
      totalSpendEur += c.amount || 0
      return {
        publisher: c.publisher || 'Unknown',
        count: c.num_items || 0,
        totalEur: c.amount || 0,
      }
    })
    return {
      year: year || null,
      totalArticles,
      totalSpendEur,
      avgCostEur: totalArticles > 0 ? Math.round(totalSpendEur / totalArticles) : 0,
      byPublisher,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCosts, listInstitutions, getStatsData as getStats }
export type { ApcCostResult, ApcInstitution, ApcStats }
console.log('settlegrid-openapc server started')
`,
})

// ─── 158. unpaywall ─────────────────────────────────────────────────────────
gen({
  slug: 'unpaywall',
  title: 'Unpaywall Open Access Finder',
  desc: 'Find free, legal open access versions of research papers by DOI via the Unpaywall API. No API key needed.',
  api: { base: 'https://api.unpaywall.org/v2', name: 'Unpaywall', docs: 'https://unpaywall.org/products/api' },
  key: null,
  keywords: ['unpaywall', 'open-access', 'oa', 'free-papers', 'research'],
  methods: [
    { name: 'get_access', display: 'Get OA status and links for a DOI', cost: 1, params: 'doi', inputs: [
      { name: 'doi', type: 'string', required: true, desc: 'DOI of the article (e.g. 10.1038/nature12373)' },
    ]},
    { name: 'check_oa', display: 'Quick OA check for a DOI', cost: 1, params: 'doi', inputs: [
      { name: 'doi', type: 'string', required: true, desc: 'DOI to check for open access' },
    ]},
    { name: 'search_oa', display: 'Search for OA papers via OpenAlex', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for open access papers' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-unpaywall — Unpaywall Open Access Finder MCP Server
 * Wraps Unpaywall API with SettleGrid billing.
 *
 * Unpaywall harvests open access content from thousands of repositories
 * and publishers, finding free legal copies of research papers.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UnpaywallResult {
  doi: string
  title: string
  is_oa: boolean
  oa_status: string
  journal_name: string | null
  publisher: string | null
  published_date: string | null
  year: number | null
  best_oa_location: OaLocation | null
  oa_locations: OaLocation[]
  z_authors: { given: string; family: string }[] | null
}

interface OaLocation {
  url: string
  url_for_pdf: string | null
  url_for_landing_page: string | null
  evidence: string
  host_type: string
  is_best: boolean
  license: string | null
  version: string
  repository_institution: string | null
}

interface OaCheckResult {
  doi: string
  isOpenAccess: boolean
  oaStatus: string
  freeUrl: string | null
  pdfUrl: string | null
  license: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.unpaywall.org/v2'
const EMAIL = 'contact@settlegrid.ai'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(\`\${url}\${sep}email=\${EMAIL}\`, {
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateDoi(doi: string): string {
  const clean = doi.trim().replace(/^https?:\\/\\/doi\\.org\\//, '')
  if (!clean.startsWith('10.')) throw new Error(\`Invalid DOI: \${doi}. Must start with 10.\`)
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'unpaywall' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getAccess(doi: string): Promise<UnpaywallResult> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('get_access', async () => {
    return apiFetch<UnpaywallResult>(\`/\${encodeURIComponent(cleanDoi)}\`)
  })
}

async function checkOa(doi: string): Promise<OaCheckResult> {
  const cleanDoi = validateDoi(doi)
  return sg.wrap('check_oa', async () => {
    const data = await apiFetch<UnpaywallResult>(\`/\${encodeURIComponent(cleanDoi)}\`)
    return {
      doi: cleanDoi,
      isOpenAccess: data.is_oa,
      oaStatus: data.oa_status,
      freeUrl: data.best_oa_location?.url || null,
      pdfUrl: data.best_oa_location?.url_for_pdf || null,
      license: data.best_oa_location?.license || null,
    }
  })
}

async function searchOa(query: string): Promise<{ results: any[] }> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_oa', async () => {
    const q = encodeURIComponent(query.trim())
    const res = await fetch(
      \`https://api.openalex.org/works?search=\${q}&filter=open_access.is_oa:true&per_page=10&mailto=\${EMAIL}\`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) throw new Error(\`Search API error: \${res.status}\`)
    const data = await res.json() as any
    return { results: data.results || [] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getAccess, checkOa, searchOa }
export type { UnpaywallResult, OaLocation, OaCheckResult }
console.log('settlegrid-unpaywall server started')
`,
})

// ─── 159. sherpa-romeo ──────────────────────────────────────────────────────
gen({
  slug: 'sherpa-romeo',
  title: 'SHERPA/RoMEO Journal Policies',
  desc: 'Look up journal self-archiving policies, publisher permissions, and open access mandates via SHERPA/RoMEO.',
  api: { base: 'https://v2.sherpa.ac.uk/cgi/retrieve', name: 'SHERPA/RoMEO', docs: 'https://v2.sherpa.ac.uk/api/' },
  key: null,
  keywords: ['sherpa', 'romeo', 'journals', 'policies', 'self-archiving'],
  methods: [
    { name: 'get_policy', display: 'Get journal policy by ISSN', cost: 1, params: 'issn', inputs: [
      { name: 'issn', type: 'string', required: true, desc: 'Journal ISSN (e.g. 0028-0836)' },
    ]},
    { name: 'search_journals', display: 'Search journals', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Journal title to search' },
    ]},
    { name: 'list_publishers', display: 'List publishers', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 20, max: 50)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-sherpa-romeo — SHERPA/RoMEO Journal Policies MCP Server
 * Wraps SHERPA/RoMEO API with SettleGrid billing.
 *
 * SHERPA/RoMEO provides information about publisher copyright and
 * self-archiving policies for academic journals worldwide.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface JournalPolicy {
  id: number
  title: string
  issns: string[]
  publisher: { name: string; country: string | null }
  oaProhibited: boolean
  policies: PolicyDetail[]
  url: string | null
}

interface PolicyDetail {
  permittedOa: {
    location: string
    version: string
    conditions: string[]
    embargo: string | null
    license: string | null
  }[]
  openAccessProhibited: boolean
}

interface JournalSearchResult {
  total: number
  items: { id: number; title: string; issns: string[]; publisher: string }[]
}

interface PublisherEntry {
  id: number
  name: string
  country: string | null
  url: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://v2.sherpa.ac.uk/cgi/retrieve'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateISSN(issn: string): string {
  const clean = issn.trim()
  if (!/^\\d{4}-?\\d{3}[\\dXx]$/.test(clean)) {
    throw new Error(\`Invalid ISSN format: \${issn}. Expected: 0028-0836\`)
  }
  return clean
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'sherpa-romeo' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPolicy(issn: string): Promise<JournalPolicy> {
  const validIssn = validateISSN(issn)
  return sg.wrap('get_policy', async () => {
    const data = await apiFetch<any>(
      \`?item-type=publication&filter=[["issn","equals","\${validIssn}"]]&format=Json\`
    )
    const items = data.items || []
    if (!items.length) throw new Error(\`No journal found with ISSN: \${validIssn}\`)
    const item = items[0]
    return {
      id: item.id || 0,
      title: item.title?.[0]?.title || 'Unknown',
      issns: item.issns?.map((i: any) => i.issn) || [],
      publisher: {
        name: item.publishers?.[0]?.publisher?.name?.[0]?.name || 'Unknown',
        country: item.publishers?.[0]?.publisher?.country || null,
      },
      oaProhibited: item.listed_in_doaj === 'no',
      policies: (item.publisher_policy || []).map((p: any) => ({
        permittedOa: (p.permitted_oa || []).map((oa: any) => ({
          location: oa.location?.location?.[0] || 'unknown',
          version: oa.article_version?.[0] || 'unknown',
          conditions: oa.conditions || [],
          embargo: oa.embargo?.amount ? \`\${oa.embargo.amount} \${oa.embargo.units}\` : null,
          license: oa.license?.[0]?.license || null,
        })),
        openAccessProhibited: p.open_access_prohibited === 'yes',
      })),
      url: item.url || null,
    }
  })
}

async function searchJournals(query: string): Promise<JournalSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  return sg.wrap('search_journals', async () => {
    const q = encodeURIComponent(query.trim())
    const data = await apiFetch<any>(
      \`?item-type=publication&filter=[["title","contains word","\${q}"]]&format=Json\`
    )
    const items = (data.items || []).slice(0, 20)
    return {
      total: items.length,
      items: items.map((i: any) => ({
        id: i.id || 0,
        title: i.title?.[0]?.title || 'Unknown',
        issns: i.issns?.map((x: any) => x.issn) || [],
        publisher: i.publishers?.[0]?.publisher?.name?.[0]?.name || 'Unknown',
      })),
    }
  })
}

async function listPublishers(limit?: number): Promise<{ publishers: PublisherEntry[] }> {
  const l = clamp(limit, 1, 50, 20)
  return sg.wrap('list_publishers', async () => {
    const data = await apiFetch<any>(
      \`?item-type=publisher&format=Json&limit=\${l}\`
    )
    const publishers: PublisherEntry[] = (data.items || []).map((i: any) => ({
      id: i.id || 0,
      name: i.name?.[0]?.name || 'Unknown',
      country: i.country || null,
      url: i.url || null,
    }))
    return { publishers }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPolicy, searchJournals, listPublishers }
export type { JournalPolicy, PolicyDetail, JournalSearchResult, PublisherEntry }
console.log('settlegrid-sherpa-romeo server started')
`,
})

// ─── 160. fatcat ────────────────────────────────────────────────────────────
gen({
  slug: 'fatcat',
  title: 'Fatcat Scholarly Catalog',
  desc: 'Search and retrieve scholarly metadata from the Fatcat open catalog of research papers, journals, and files.',
  api: { base: 'https://api.fatcat.wiki/v0', name: 'Fatcat', docs: 'https://api.fatcat.wiki/' },
  key: null,
  keywords: ['fatcat', 'catalog', 'scholarly', 'metadata', 'open-access'],
  methods: [
    { name: 'search_releases', display: 'Search scholarly releases', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for releases (papers/articles)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default: 10, max: 50)' },
    ]},
    { name: 'get_release', display: 'Get release by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Fatcat release ID (e.g. hsmo6p4smrganpb3fndaj2lon4)' },
    ]},
    { name: 'get_container', display: 'Get journal/container by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Fatcat container ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-fatcat — Fatcat Scholarly Catalog MCP Server
 * Wraps Fatcat API with SettleGrid billing.
 *
 * Fatcat is an open catalog of scholarly metadata maintained by the
 * Internet Archive, covering papers, journals, authors, and file archives.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FatcatRelease {
  ident: string
  title: string
  release_type: string | null
  release_stage: string | null
  release_year: number | null
  release_date: string | null
  doi: string | null
  pmid: string | null
  isbn13: string | null
  contribs: { raw_name: string; role: string; index: number }[]
  container: { ident: string; name: string; issnl: string | null } | null
  abstracts: { content: string; mimetype: string; lang: string }[]
  refs: { index: number; target_release_id: string | null; extra: any }[]
  ext_ids: Record<string, string>
}

interface FatcatContainer {
  ident: string
  name: string
  issnl: string | null
  issne: string | null
  issnp: string | null
  publisher: string | null
  container_type: string | null
  wikidata_qid: string | null
  edit_extra: any
}

interface FatcatSearchResult {
  count: number
  results: FatcatRelease[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API_BASE = 'https://api.fatcat.wiki/v0'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function clamp(val: number | undefined, min: number, max: number, def: number): number {
  if (val === undefined || val === null) return def
  return Math.max(min, Math.min(max, Math.floor(val)))
}

function validateIdent(id: string): string {
  const clean = id.trim()
  if (!/^[a-z0-9]{26}$/.test(clean)) {
    throw new Error(\`Invalid Fatcat ID format: \${id}. Expected 26-character lowercase alphanumeric.\`)
  }
  return clean
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'fatcat' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchReleases(query: string, limit?: number): Promise<FatcatSearchResult> {
  if (!query || typeof query !== 'string') throw new Error('query is required')
  const q = encodeURIComponent(query.trim())
  const l = clamp(limit, 1, 50, 10)
  return sg.wrap('search_releases', async () => {
    const data = await apiFetch<any>(
      \`/release/search?q=\${q}&limit=\${l}&expand=container\`
    )
    return {
      count: data.count_returned || 0,
      results: (data.results || []).map((r: any) => ({
        ident: r.ident || '',
        title: r.title || 'Untitled',
        release_type: r.release_type || null,
        release_stage: r.release_stage || null,
        release_year: r.release_year || null,
        release_date: r.release_date || null,
        doi: r.doi || null,
        pmid: r.pmid || null,
        isbn13: r.isbn13 || null,
        contribs: r.contribs || [],
        container: r.container || null,
        abstracts: r.abstracts || [],
        refs: [],
        ext_ids: r.ext_ids || {},
      })),
    }
  })
}

async function getRelease(id: string): Promise<FatcatRelease> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = validateIdent(id)
  return sg.wrap('get_release', async () => {
    return apiFetch<FatcatRelease>(
      \`/release/\${cleanId}?expand=container,refs\`
    )
  })
}

async function getContainer(id: string): Promise<FatcatContainer> {
  if (!id || typeof id !== 'string') throw new Error('id is required')
  const cleanId = validateIdent(id)
  return sg.wrap('get_container', async () => {
    return apiFetch<FatcatContainer>(\`/container/\${cleanId}\`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchReleases, getRelease, getContainer }
export type { FatcatRelease, FatcatContainer, FatcatSearchResult }
console.log('settlegrid-fatcat server started')
`,
})

console.log('\nBatch 3E1 complete — 20 servers generated\n')
