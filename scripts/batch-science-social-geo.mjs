/**
 * Batch generator: 15 Science/Research + 15 Social/Content + 10 Maps/Geo
 * 40 SettleGrid MCP servers total
 */

import { generateServer } from './lib/generate.mjs'

console.log('\n=== Science/Research (15 servers) ===\n')

// ─── 111. arXiv ──────────────────────────────────────────────────────────────

generateServer({
  slug: 'arxiv',
  name: 'arXiv',
  description: 'Search academic preprints on arXiv via the Atom/XML API with SettleGrid billing.',
  keywords: ['science', 'research', 'papers', 'arxiv'],
  upstream: { provider: 'arXiv', baseUrl: 'https://export.arxiv.org/api/query', auth: 'None required', rateLimit: '3 req/s', docsUrl: 'https://info.arxiv.org/help/api/index.html' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_papers', displayName: 'Search Papers', costCents: 1, description: 'Search arXiv papers by query', params: [{ name: 'query', type: 'string', required: true, description: 'Search query (e.g. "quantum computing")' }, { name: 'max_results', type: 'number', required: false, description: 'Max results (1-50, default 10)' }] },
    { name: 'get_paper', displayName: 'Get Paper', costCents: 1, description: 'Get paper details by arXiv ID', params: [{ name: 'id', type: 'string', required: true, description: 'arXiv paper ID (e.g. "2301.07041")' }] },
  ],
  serverTs: `/**
 * settlegrid-arxiv — arXiv Academic Paper Search MCP Server
 *
 * Wraps the arXiv API (export.arxiv.org) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_papers(query, max_results)  — Search arXiv papers   (1¢)
 *   get_paper(id)                      — Get paper by arXiv ID (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  max_results?: number
}

interface GetPaperInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ARXIV_BASE = 'https://export.arxiv.org/api/query'

async function arxivFetch(params: string): Promise<string> {
  const res = await fetch(\`\${ARXIV_BASE}?\${params}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`arXiv API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.text()
}

function parseEntries(xml: string): Array<Record<string, string>> {
  const entries: Array<Record<string, string>> = []
  const entryRegex = /<entry>(.*?)<\\/entry>/gs
  let match: RegExpExecArray | null
  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1]
    const get = (tag: string): string => {
      const m = new RegExp(\`<\${tag}[^>]*>(.*?)</\${tag}>\`, 's').exec(block)
      return m ? m[1].trim() : ''
    }
    entries.push({
      id: get('id'),
      title: get('title').replace(/\\s+/g, ' '),
      summary: get('summary').replace(/\\s+/g, ' ').slice(0, 500),
      published: get('published'),
      updated: get('updated'),
    })
  }
  return entries
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'arxiv',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_papers: { costCents: 1, displayName: 'Search Papers' },
      get_paper: { costCents: 1, displayName: 'Get Paper' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPapers = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const maxResults = Math.min(Math.max(args.max_results ?? 10, 1), 50)
  const q = encodeURIComponent(args.query)
  const xml = await arxivFetch(\`search_query=all:\${q}&start=0&max_results=\${maxResults}\`)
  const entries = parseEntries(xml)
  return { query: args.query, count: entries.length, papers: entries }
}, { method: 'search_papers' })

const getPaper = sg.wrap(async (args: GetPaperInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. "2301.07041")')
  }
  const xml = await arxivFetch(\`id_list=\${encodeURIComponent(args.id)}\`)
  const entries = parseEntries(xml)
  if (entries.length === 0) {
    throw new Error(\`Paper not found: \${args.id}\`)
  }
  return entries[0]
}, { method: 'get_paper' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPapers, getPaper }

console.log('settlegrid-arxiv MCP server ready')
console.log('Methods: search_papers, get_paper')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 112. PubMed ─────────────────────────────────────────────────────────────

generateServer({
  slug: 'pubmed',
  name: 'PubMed',
  description: 'Search biomedical literature on PubMed/NCBI with SettleGrid billing.',
  keywords: ['science', 'medical', 'pubmed', 'ncbi'],
  upstream: { provider: 'NCBI', baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils', auth: 'Free API key recommended', rateLimit: '3 req/s without key, 10 with', docsUrl: 'https://www.ncbi.nlm.nih.gov/books/NBK25501/' },
  auth: { type: 'query', keyEnvVar: 'NCBI_API_KEY', keyDesc: 'NCBI API key (optional, increases rate limit)' },
  methods: [
    { name: 'search_articles', displayName: 'Search Articles', costCents: 1, description: 'Search PubMed articles', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'max_results', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_abstract', displayName: 'Get Abstract', costCents: 1, description: 'Get article abstract by PMID', params: [{ name: 'pmid', type: 'string', required: true, description: 'PubMed ID' }] },
  ],
  serverTs: `/**
 * settlegrid-pubmed — PubMed Medical Literature MCP Server
 *
 * Wraps NCBI E-utilities API with SettleGrid billing.
 * Optional API key increases rate limit from 3 to 10 req/s.
 *
 * Methods:
 *   search_articles(query, max_results)  — Search PubMed          (1¢)
 *   get_abstract(pmid)                   — Get abstract by PMID   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  max_results?: number
}

interface AbstractInput {
  pmid: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const API_KEY = process.env.NCBI_API_KEY || ''

function keyParam(): string {
  return API_KEY ? \`&api_key=\${API_KEY}\` : ''
}

async function ncbiFetch(path: string): Promise<string> {
  const res = await fetch(\`\${EUTILS_BASE}\${path}\${keyParam()}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NCBI API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.text()
}

function extractTag(xml: string, tag: string): string {
  const m = new RegExp(\`<\${tag}[^>]*>(.*?)</\${tag}>\`, 's').exec(xml)
  return m ? m[1].trim() : ''
}

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(\`<\${tag}[^>]*>(.*?)</\${tag}>\`, 'gs')
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim())
  return results
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pubmed',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_articles: { costCents: 1, displayName: 'Search Articles' },
      get_abstract: { costCents: 1, displayName: 'Get Abstract' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchArticles = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const max = Math.min(Math.max(args.max_results ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const searchXml = await ncbiFetch(\`/esearch.fcgi?db=pubmed&term=\${q}&retmax=\${max}&retmode=xml\`)
  const ids = extractAllTags(searchXml, 'Id')
  if (ids.length === 0) return { query: args.query, count: 0, articles: [] }

  const summaryXml = await ncbiFetch(\`/esummary.fcgi?db=pubmed&id=\${ids.join(',')}&retmode=xml\`)
  const docs = summaryXml.split('<DocSum>').slice(1).map((block) => ({
    pmid: extractTag(block, 'Id'),
    title: extractTag(block, 'Item Name="Title"') || extractTag(block, 'Item'),
    source: extractTag(block, 'Item Name="Source"'),
    pubDate: extractTag(block, 'Item Name="PubDate"'),
  }))

  return { query: args.query, count: docs.length, articles: docs }
}, { method: 'search_articles' })

const getAbstract = sg.wrap(async (args: AbstractInput) => {
  if (!args.pmid || typeof args.pmid !== 'string') {
    throw new Error('pmid is required')
  }
  if (!/^\\d+$/.test(args.pmid.trim())) {
    throw new Error('pmid must be a numeric PubMed ID')
  }
  const xml = await ncbiFetch(\`/efetch.fcgi?db=pubmed&id=\${args.pmid.trim()}&retmode=xml\`)
  return {
    pmid: args.pmid.trim(),
    title: extractTag(xml, 'ArticleTitle'),
    abstract: extractTag(xml, 'AbstractText').slice(0, 2000),
    journal: extractTag(xml, 'Title'),
    year: extractTag(xml, 'Year'),
  }
}, { method: 'get_abstract' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchArticles, getAbstract }

console.log('settlegrid-pubmed MCP server ready')
console.log('Methods: search_articles, get_abstract')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 113. Crossref ───────────────────────────────────────────────────────────

generateServer({
  slug: 'crossref',
  name: 'Crossref',
  description: 'Query DOI metadata and citation data from the Crossref API with SettleGrid billing.',
  keywords: ['science', 'doi', 'citations', 'crossref'],
  upstream: { provider: 'Crossref', baseUrl: 'https://api.crossref.org/works', auth: 'None required', rateLimit: '50 req/s polite pool', docsUrl: 'https://api.crossref.org/swagger-ui/index.html' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_works', displayName: 'Search Works', costCents: 1, description: 'Search Crossref works by query', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'rows', type: 'number', required: false, description: 'Results per page (1-20, default 10)' }] },
    { name: 'get_doi', displayName: 'Get DOI', costCents: 1, description: 'Get metadata for a specific DOI', params: [{ name: 'doi', type: 'string', required: true, description: 'DOI (e.g. "10.1038/nature12373")' }] },
  ],
  serverTs: `/**
 * settlegrid-crossref — Crossref DOI/Citation MCP Server
 *
 * Wraps the Crossref REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_works(query, rows)  — Search works          (1¢)
 *   get_doi(doi)               — Get DOI metadata      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  rows?: number
}

interface DoiInput {
  doi: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CR_BASE = 'https://api.crossref.org'
const MAILTO = 'mailto=contact@settlegrid.ai'

async function crFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${CR_BASE}\${path}\${sep}\${MAILTO}\`, {
    headers: { 'User-Agent': 'settlegrid-crossref/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Crossref API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'crossref',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_works: { costCents: 1, displayName: 'Search Works' },
      get_doi: { costCents: 1, displayName: 'Get DOI' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchWorks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const rows = Math.min(Math.max(args.rows ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await crFetch<{ message: { items: any[]; 'total-results': number } }>(
    \`/works?query=\${q}&rows=\${rows}\`
  )
  return {
    query: args.query,
    totalResults: data.message['total-results'],
    items: data.message.items.map((w: any) => ({
      doi: w.DOI,
      title: w.title?.[0] || '',
      type: w.type,
      published: w.published?.['date-parts']?.[0]?.join('-'),
      citationCount: w['is-referenced-by-count'],
      publisher: w.publisher,
    })),
  }
}, { method: 'search_works' })

const getDoi = sg.wrap(async (args: DoiInput) => {
  if (!args.doi || typeof args.doi !== 'string') {
    throw new Error('doi is required (e.g. "10.1038/nature12373")')
  }
  const data = await crFetch<{ message: any }>(\`/works/\${encodeURIComponent(args.doi)}\`)
  const w = data.message
  return {
    doi: w.DOI,
    title: w.title?.[0] || '',
    authors: w.author?.map((a: any) => \`\${a.given || ''} \${a.family || ''}\`.trim()) || [],
    type: w.type,
    published: w.published?.['date-parts']?.[0]?.join('-'),
    citationCount: w['is-referenced-by-count'],
    publisher: w.publisher,
    abstract: w.abstract?.slice(0, 1000),
  }
}, { method: 'get_doi' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchWorks, getDoi }

console.log('settlegrid-crossref MCP server ready')
console.log('Methods: search_works, get_doi')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 114. Semantic Scholar ───────────────────────────────────────────────────

generateServer({
  slug: 'semantic-scholar',
  name: 'Semantic Scholar',
  description: 'Search AI and computer science papers via Semantic Scholar API with SettleGrid billing.',
  keywords: ['science', 'ai', 'papers', 'semantic-scholar'],
  upstream: { provider: 'Semantic Scholar', baseUrl: 'https://api.semanticscholar.org/graph/v1', auth: 'Free API key recommended', rateLimit: '100 req/5min without key', docsUrl: 'https://api.semanticscholar.org/' },
  auth: { type: 'header', keyEnvVar: 'S2_API_KEY', keyDesc: 'Semantic Scholar API key (optional)' },
  methods: [
    { name: 'search_papers', displayName: 'Search Papers', costCents: 1, description: 'Search Semantic Scholar papers', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_paper', displayName: 'Get Paper', costCents: 1, description: 'Get paper by Semantic Scholar ID or DOI', params: [{ name: 'paper_id', type: 'string', required: true, description: 'Paper ID, DOI, or arXiv ID' }] },
  ],
  serverTs: `/**
 * settlegrid-semantic-scholar — Semantic Scholar Research Paper MCP Server
 *
 * Wraps the Semantic Scholar Academic Graph API with SettleGrid billing.
 * Optional API key for higher rate limits.
 *
 * Methods:
 *   search_papers(query, limit)  — Search papers  (1¢)
 *   get_paper(paper_id)          — Get paper details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface PaperInput {
  paper_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const S2_BASE = 'https://api.semanticscholar.org/graph/v1'
const API_KEY = process.env.S2_API_KEY || ''
const FIELDS = 'title,abstract,year,citationCount,authors,url'

async function s2Fetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (API_KEY) headers['x-api-key'] = API_KEY
  const res = await fetch(\`\${S2_BASE}\${path}\`, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Semantic Scholar API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'semantic-scholar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_papers: { costCents: 1, displayName: 'Search Papers' },
      get_paper: { costCents: 1, displayName: 'Get Paper' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPapers = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await s2Fetch<{ total: number; data: any[] }>(
    \`/paper/search?query=\${q}&limit=\${limit}&fields=\${FIELDS}\`
  )
  return {
    query: args.query,
    total: data.total,
    papers: data.data.map((p: any) => ({
      paperId: p.paperId,
      title: p.title,
      year: p.year,
      citationCount: p.citationCount,
      authors: p.authors?.map((a: any) => a.name) || [],
      url: p.url,
      abstract: p.abstract?.slice(0, 500),
    })),
  }
}, { method: 'search_papers' })

const getPaper = sg.wrap(async (args: PaperInput) => {
  if (!args.paper_id || typeof args.paper_id !== 'string') {
    throw new Error('paper_id is required (Semantic Scholar ID, DOI, or arXiv ID)')
  }
  const data = await s2Fetch<any>(\`/paper/\${encodeURIComponent(args.paper_id)}?fields=\${FIELDS}\`)
  return {
    paperId: data.paperId,
    title: data.title,
    year: data.year,
    citationCount: data.citationCount,
    authors: data.authors?.map((a: any) => a.name) || [],
    url: data.url,
    abstract: data.abstract?.slice(0, 1000),
  }
}, { method: 'get_paper' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPapers, getPaper }

console.log('settlegrid-semantic-scholar MCP server ready')
console.log('Methods: search_papers, get_paper')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 115. GBIF ───────────────────────────────────────────────────────────────

generateServer({
  slug: 'gbif',
  name: 'GBIF',
  description: 'Query the Global Biodiversity Information Facility for species occurrence data with SettleGrid billing.',
  keywords: ['science', 'biodiversity', 'species', 'gbif'],
  upstream: { provider: 'GBIF', baseUrl: 'https://api.gbif.org/v1', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://www.gbif.org/developer/summary' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_species', displayName: 'Search Species', costCents: 1, description: 'Search for species by name', params: [{ name: 'query', type: 'string', required: true, description: 'Species name or common name' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_occurrences', displayName: 'Get Occurrences', costCents: 1, description: 'Get species occurrences by taxon key', params: [{ name: 'taxon_key', type: 'number', required: true, description: 'GBIF taxon key' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-gbif — GBIF Biodiversity Data MCP Server
 *
 * Wraps the GBIF REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_species(query, limit)        — Search species    (1¢)
 *   get_occurrences(taxon_key, limit)   — Get occurrences   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SpeciesSearchInput {
  query: string
  limit?: number
}

interface OccurrenceInput {
  taxon_key: number
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GBIF_BASE = 'https://api.gbif.org/v1'

async function gbifFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${GBIF_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`GBIF API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gbif',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_species: { costCents: 1, displayName: 'Search Species' },
      get_occurrences: { costCents: 1, displayName: 'Get Occurrences' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SpeciesSearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await gbifFetch<{ results: any[] }>(\`/species/search?q=\${q}&limit=\${limit}\`)
  return {
    query: args.query,
    count: data.results.length,
    species: data.results.map((s: any) => ({
      key: s.key,
      scientificName: s.scientificName,
      commonName: s.vernacularNames?.[0]?.vernacularName || '',
      kingdom: s.kingdom,
      phylum: s.phylum,
      class: s.class,
      order: s.order,
      family: s.family,
      rank: s.rank,
    })),
  }
}, { method: 'search_species' })

const getOccurrences = sg.wrap(async (args: OccurrenceInput) => {
  if (typeof args.taxon_key !== 'number' || !Number.isFinite(args.taxon_key)) {
    throw new Error('taxon_key must be a number')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await gbifFetch<{ results: any[] }>(
    \`/occurrence/search?taxonKey=\${args.taxon_key}&limit=\${limit}\`
  )
  return {
    taxonKey: args.taxon_key,
    count: data.results.length,
    occurrences: data.results.map((o: any) => ({
      key: o.key,
      species: o.species,
      country: o.country,
      decimalLatitude: o.decimalLatitude,
      decimalLongitude: o.decimalLongitude,
      eventDate: o.eventDate,
      basisOfRecord: o.basisOfRecord,
    })),
  }
}, { method: 'get_occurrences' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getOccurrences }

console.log('settlegrid-gbif MCP server ready')
console.log('Methods: search_species, get_occurrences')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 116. iNaturalist ────────────────────────────────────────────────────────

generateServer({
  slug: 'inaturalist',
  name: 'iNaturalist',
  description: 'Search nature observations and species data from iNaturalist with SettleGrid billing.',
  keywords: ['science', 'nature', 'observations', 'inaturalist'],
  upstream: { provider: 'iNaturalist', baseUrl: 'https://api.inaturalist.org/v1', auth: 'None required', rateLimit: '100 req/min', docsUrl: 'https://api.inaturalist.org/v1/docs/' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_observations', displayName: 'Search Observations', costCents: 1, description: 'Search nature observations', params: [{ name: 'taxon_name', type: 'string', required: true, description: 'Species or taxon name' }, { name: 'per_page', type: 'number', required: false, description: 'Results (1-20, default 10)' }] },
    { name: 'search_taxa', displayName: 'Search Taxa', costCents: 1, description: 'Search for taxa/species info', params: [{ name: 'query', type: 'string', required: true, description: 'Taxon name to search' }] },
  ],
  serverTs: `/**
 * settlegrid-inaturalist — iNaturalist Nature Observations MCP Server
 *
 * Wraps the iNaturalist API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_observations(taxon_name, per_page)  — Search observations  (1¢)
 *   search_taxa(query)                          — Search taxa info     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ObservationInput {
  taxon_name: string
  per_page?: number
}

interface TaxaInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const INAT_BASE = 'https://api.inaturalist.org/v1'

async function inatFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${INAT_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`iNaturalist API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'inaturalist',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_observations: { costCents: 1, displayName: 'Search Observations' },
      search_taxa: { costCents: 1, displayName: 'Search Taxa' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchObservations = sg.wrap(async (args: ObservationInput) => {
  if (!args.taxon_name || typeof args.taxon_name !== 'string') {
    throw new Error('taxon_name is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.taxon_name)
  const data = await inatFetch<{ total_results: number; results: any[] }>(
    \`/observations?taxon_name=\${q}&per_page=\${perPage}&order=desc&order_by=created_at\`
  )
  return {
    taxonName: args.taxon_name,
    totalResults: data.total_results,
    observations: data.results.map((o: any) => ({
      id: o.id,
      species: o.taxon?.name || '',
      commonName: o.taxon?.preferred_common_name || '',
      location: o.place_guess,
      latitude: o.geojson?.coordinates?.[1],
      longitude: o.geojson?.coordinates?.[0],
      observedOn: o.observed_on,
      qualityGrade: o.quality_grade,
      photoUrl: o.photos?.[0]?.url || '',
    })),
  }
}, { method: 'search_observations' })

const searchTaxa = sg.wrap(async (args: TaxaInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await inatFetch<{ results: any[] }>(\`/taxa?q=\${q}&per_page=10\`)
  return {
    query: args.query,
    count: data.results.length,
    taxa: data.results.map((t: any) => ({
      id: t.id,
      name: t.name,
      commonName: t.preferred_common_name || '',
      rank: t.rank,
      observationsCount: t.observations_count,
      wikipediaSummary: t.wikipedia_summary?.slice(0, 500) || '',
      photoUrl: t.default_photo?.medium_url || '',
    })),
  }
}, { method: 'search_taxa' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchObservations, searchTaxa }

console.log('settlegrid-inaturalist MCP server ready')
console.log('Methods: search_observations, search_taxa')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 117. Open Notify (ISS) ─────────────────────────────────────────────────

generateServer({
  slug: 'open-notify',
  name: 'Open Notify',
  description: 'Track the International Space Station location and astronauts in space with SettleGrid billing.',
  keywords: ['science', 'space', 'iss', 'astronauts'],
  upstream: { provider: 'Open Notify', baseUrl: 'http://api.open-notify.org', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'http://open-notify.org/Open-Notify-API/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_iss_position', displayName: 'ISS Position', costCents: 1, description: 'Get current ISS location', params: [] },
    { name: 'get_people_in_space', displayName: 'People in Space', costCents: 1, description: 'Get astronauts currently in space', params: [] },
  ],
  serverTs: `/**
 * settlegrid-open-notify — ISS Tracker MCP Server
 *
 * Wraps the Open Notify API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_iss_position()     — Current ISS coordinates   (1¢)
 *   get_people_in_space()  — People currently in space  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IssPositionResponse {
  message: string
  iss_position: { latitude: string; longitude: string }
  timestamp: number
}

interface PeopleResponse {
  message: string
  number: number
  people: Array<{ name: string; craft: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://api.open-notify.org'

async function notifyFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Open Notify API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-notify',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_iss_position: { costCents: 1, displayName: 'ISS Position' },
      get_people_in_space: { costCents: 1, displayName: 'People in Space' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIssPosition = sg.wrap(async () => {
  const data = await notifyFetch<IssPositionResponse>('/iss-now.json')
  return {
    latitude: parseFloat(data.iss_position.latitude),
    longitude: parseFloat(data.iss_position.longitude),
    timestamp: data.timestamp,
    timestampISO: new Date(data.timestamp * 1000).toISOString(),
  }
}, { method: 'get_iss_position' })

const getPeopleInSpace = sg.wrap(async () => {
  const data = await notifyFetch<PeopleResponse>('/astros.json')
  return {
    count: data.number,
    people: data.people.map((p) => ({
      name: p.name,
      craft: p.craft,
    })),
  }
}, { method: 'get_people_in_space' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIssPosition, getPeopleInSpace }

console.log('settlegrid-open-notify MCP server ready')
console.log('Methods: get_iss_position, get_people_in_space')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 118. SpaceX ─────────────────────────────────────────────────────────────

generateServer({
  slug: 'spacex',
  name: 'SpaceX',
  description: 'Query SpaceX launch data, rockets, and missions with SettleGrid billing.',
  keywords: ['science', 'space', 'spacex', 'rockets'],
  upstream: { provider: 'r/SpaceX', baseUrl: 'https://api.spacexdata.com/v4', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://github.com/r-spacex/SpaceX-API' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_latest_launch', displayName: 'Latest Launch', costCents: 1, description: 'Get the latest SpaceX launch', params: [] },
    { name: 'get_upcoming_launches', displayName: 'Upcoming Launches', costCents: 1, description: 'Get upcoming SpaceX launches', params: [{ name: 'limit', type: 'number', required: false, description: 'Max results (1-10, default 5)' }] },
    { name: 'get_rockets', displayName: 'Get Rockets', costCents: 1, description: 'List all SpaceX rockets', params: [] },
  ],
  serverTs: `/**
 * settlegrid-spacex — SpaceX Launch Data MCP Server
 *
 * Wraps the SpaceX REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_latest_launch()              — Latest launch info    (1¢)
 *   get_upcoming_launches(limit)     — Upcoming launches     (1¢)
 *   get_rockets()                    — List all rockets      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LaunchLimitInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SPACEX_BASE = 'https://api.spacexdata.com/v4'

async function spacexFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${SPACEX_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SpaceX API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatLaunch(l: any): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    dateUtc: l.date_utc,
    success: l.success,
    details: l.details?.slice(0, 500) || null,
    rocket: l.rocket,
    flightNumber: l.flight_number,
    upcoming: l.upcoming,
    links: {
      webcast: l.links?.webcast,
      wikipedia: l.links?.wikipedia,
      article: l.links?.article,
    },
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spacex',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_latest_launch: { costCents: 1, displayName: 'Latest Launch' },
      get_upcoming_launches: { costCents: 1, displayName: 'Upcoming Launches' },
      get_rockets: { costCents: 1, displayName: 'Get Rockets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatestLaunch = sg.wrap(async () => {
  const data = await spacexFetch<any>('/launches/latest')
  return formatLaunch(data)
}, { method: 'get_latest_launch' })

const getUpcomingLaunches = sg.wrap(async (args: LaunchLimitInput) => {
  const data = await spacexFetch<any[]>('/launches/upcoming')
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  return {
    count: Math.min(data.length, limit),
    launches: data.slice(0, limit).map(formatLaunch),
  }
}, { method: 'get_upcoming_launches' })

const getRockets = sg.wrap(async () => {
  const data = await spacexFetch<any[]>('/rockets')
  return {
    count: data.length,
    rockets: data.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      active: r.active,
      stages: r.stages,
      costPerLaunch: r.cost_per_launch,
      successRate: r.success_rate_pct,
      firstFlight: r.first_flight,
      description: r.description?.slice(0, 300),
    })),
  }
}, { method: 'get_rockets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatestLaunch, getUpcomingLaunches, getRockets }

console.log('settlegrid-spacex MCP server ready')
console.log('Methods: get_latest_launch, get_upcoming_launches, get_rockets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 119. Launch Library ─────────────────────────────────────────────────────

generateServer({
  slug: 'launch-library',
  name: 'Launch Library',
  description: 'Track rocket launches from all space agencies via Launch Library 2 API with SettleGrid billing.',
  keywords: ['science', 'space', 'rockets', 'launches'],
  upstream: { provider: 'The Space Devs', baseUrl: 'https://ll.thespacedevs.com/2.2.0', auth: 'None required', rateLimit: '15 req/hr (free tier)', docsUrl: 'https://thespacedevs.com/llapi' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_upcoming_launches', displayName: 'Upcoming Launches', costCents: 1, description: 'Get upcoming rocket launches globally', params: [{ name: 'limit', type: 'number', required: false, description: 'Max results (1-10, default 5)' }] },
    { name: 'get_previous_launches', displayName: 'Previous Launches', costCents: 1, description: 'Get recent past launches', params: [{ name: 'limit', type: 'number', required: false, description: 'Max results (1-10, default 5)' }] },
  ],
  serverTs: `/**
 * settlegrid-launch-library — Launch Library 2 Rocket Launch MCP Server
 *
 * Wraps the Launch Library 2 API with SettleGrid billing.
 * No API key needed for free tier.
 *
 * Methods:
 *   get_upcoming_launches(limit)   — Upcoming launches  (1¢)
 *   get_previous_launches(limit)   — Recent past launches (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LaunchInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const LL_BASE = 'https://ll.thespacedevs.com/2.2.0'

async function llFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${LL_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Launch Library API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatLaunch(l: any): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    status: l.status?.name,
    net: l.net,
    provider: l.launch_service_provider?.name,
    rocket: l.rocket?.configuration?.full_name,
    pad: l.pad?.name,
    location: l.pad?.location?.name,
    mission: l.mission?.name || null,
    missionDescription: l.mission?.description?.slice(0, 300) || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'launch-library',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_upcoming_launches: { costCents: 1, displayName: 'Upcoming Launches' },
      get_previous_launches: { costCents: 1, displayName: 'Previous Launches' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getUpcomingLaunches = sg.wrap(async (args: LaunchInput) => {
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  const data = await llFetch<{ count: number; results: any[] }>(
    \`/launch/upcoming/?limit=\${limit}&mode=detailed\`
  )
  return {
    total: data.count,
    launches: data.results.map(formatLaunch),
  }
}, { method: 'get_upcoming_launches' })

const getPreviousLaunches = sg.wrap(async (args: LaunchInput) => {
  const limit = Math.min(Math.max(args.limit ?? 5, 1), 10)
  const data = await llFetch<{ count: number; results: any[] }>(
    \`/launch/previous/?limit=\${limit}&mode=detailed\`
  )
  return {
    total: data.count,
    launches: data.results.map(formatLaunch),
  }
}, { method: 'get_previous_launches' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getUpcomingLaunches, getPreviousLaunches }

console.log('settlegrid-launch-library MCP server ready')
console.log('Methods: get_upcoming_launches, get_previous_launches')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 120. USGS Earthquakes ───────────────────────────────────────────────────

generateServer({
  slug: 'usgs-earthquakes',
  name: 'USGS Earthquakes',
  description: 'Query real-time earthquake data from USGS with SettleGrid billing.',
  keywords: ['science', 'earthquakes', 'seismology', 'usgs'],
  upstream: { provider: 'USGS', baseUrl: 'https://earthquake.usgs.gov/fdsnws/event/1', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_recent_earthquakes', displayName: 'Recent Earthquakes', costCents: 1, description: 'Get recent significant earthquakes', params: [{ name: 'min_magnitude', type: 'number', required: false, description: 'Minimum magnitude (default 4.5)' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_earthquake', displayName: 'Get Earthquake', costCents: 1, description: 'Get earthquake details by event ID', params: [{ name: 'event_id', type: 'string', required: true, description: 'USGS event ID' }] },
  ],
  serverTs: `/**
 * settlegrid-usgs-earthquakes — USGS Earthquake Data MCP Server
 *
 * Wraps the USGS Earthquake Hazards API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_recent_earthquakes(min_magnitude, limit)  — Recent quakes    (1¢)
 *   get_earthquake(event_id)                      — Quake details    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecentInput {
  min_magnitude?: number
  limit?: number
}

interface EventInput {
  event_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1'

async function usgsFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${USGS_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USGS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatQuake(f: any): Record<string, unknown> {
  return {
    id: f.id,
    magnitude: f.properties.mag,
    place: f.properties.place,
    time: new Date(f.properties.time).toISOString(),
    tsunami: f.properties.tsunami === 1,
    type: f.properties.type,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    depth: f.geometry.coordinates[2],
    url: f.properties.url,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usgs-earthquakes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_recent_earthquakes: { costCents: 1, displayName: 'Recent Earthquakes' },
      get_earthquake: { costCents: 1, displayName: 'Get Earthquake' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRecentEarthquakes = sg.wrap(async (args: RecentInput) => {
  const minMag = Math.max(args.min_magnitude ?? 4.5, 0)
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await usgsFetch<{ features: any[]; metadata: { count: number } }>(
    \`/query?format=geojson&minmagnitude=\${minMag}&limit=\${limit}&orderby=time\`
  )
  return {
    count: data.features.length,
    minMagnitude: minMag,
    earthquakes: data.features.map(formatQuake),
  }
}, { method: 'get_recent_earthquakes' })

const getEarthquake = sg.wrap(async (args: EventInput) => {
  if (!args.event_id || typeof args.event_id !== 'string') {
    throw new Error('event_id is required')
  }
  const data = await usgsFetch<any>(
    \`/query?format=geojson&eventid=\${encodeURIComponent(args.event_id)}\`
  )
  if (!data.features?.length) {
    throw new Error(\`Earthquake not found: \${args.event_id}\`)
  }
  return formatQuake(data.features[0])
}, { method: 'get_earthquake' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRecentEarthquakes, getEarthquake }

console.log('settlegrid-usgs-earthquakes MCP server ready')
console.log('Methods: get_recent_earthquakes, get_earthquake')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 121. Protein Data Bank (RCSB) ──────────────────────────────────────────

generateServer({
  slug: 'protein-data',
  name: 'Protein Data Bank',
  description: 'Search protein structures from RCSB PDB with SettleGrid billing.',
  keywords: ['science', 'biology', 'proteins', 'pdb'],
  upstream: { provider: 'RCSB PDB', baseUrl: 'https://data.rcsb.org/rest/v1', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://data.rcsb.org/index.html' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_structures', displayName: 'Search Structures', costCents: 1, description: 'Search PDB for protein structures', params: [{ name: 'query', type: 'string', required: true, description: 'Search query (e.g. "insulin")' }, { name: 'rows', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_entry', displayName: 'Get Entry', costCents: 1, description: 'Get PDB entry details by ID', params: [{ name: 'pdb_id', type: 'string', required: true, description: 'PDB ID (e.g. "4HHB")' }] },
  ],
  serverTs: `/**
 * settlegrid-protein-data — RCSB Protein Data Bank MCP Server
 *
 * Wraps the RCSB PDB REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_structures(query, rows)  — Search PDB structures   (1¢)
 *   get_entry(pdb_id)               — Get entry details       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  rows?: number
}

interface EntryInput {
  pdb_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PDB_DATA = 'https://data.rcsb.org/rest/v1'
const PDB_SEARCH = 'https://search.rcsb.org/rcsbsearch/v2/query'

async function pdbFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`RCSB PDB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'protein-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_structures: { costCents: 1, displayName: 'Search Structures' },
      get_entry: { costCents: 1, displayName: 'Get Entry' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchStructures = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const rows = Math.min(Math.max(args.rows ?? 10, 1), 20)
  const body = {
    query: {
      type: 'terminal',
      service: 'full_text',
      parameters: { value: args.query },
    },
    return_type: 'entry',
    request_options: { paginate: { start: 0, rows } },
  }
  const data = await pdbFetch<{ total_count: number; result_set: any[] }>(
    PDB_SEARCH,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  return {
    query: args.query,
    totalCount: data.total_count,
    entries: (data.result_set || []).map((r: any) => ({
      pdbId: r.identifier,
      score: r.score,
    })),
  }
}, { method: 'search_structures' })

const getEntry = sg.wrap(async (args: EntryInput) => {
  if (!args.pdb_id || typeof args.pdb_id !== 'string') {
    throw new Error('pdb_id is required (e.g. "4HHB")')
  }
  const id = args.pdb_id.toUpperCase().trim()
  if (!/^[A-Z0-9]{4}$/.test(id)) {
    throw new Error('pdb_id must be a 4-character alphanumeric code')
  }
  const data = await pdbFetch<any>(\`\${PDB_DATA}/core/entry/\${id}\`)
  return {
    pdbId: id,
    title: data.struct?.title,
    method: data.exptl?.[0]?.method,
    resolution: data.rcsb_entry_info?.resolution_combined?.[0],
    depositionDate: data.rcsb_accession_info?.deposit_date,
    releaseDate: data.rcsb_accession_info?.initial_release_date,
    polymerCount: data.rcsb_entry_info?.polymer_entity_count,
  }
}, { method: 'get_entry' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchStructures, getEntry }

console.log('settlegrid-protein-data MCP server ready')
console.log('Methods: search_structures, get_entry')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 122. ChemSpider ─────────────────────────────────────────────────────────

generateServer({
  slug: 'chemspider',
  name: 'ChemSpider',
  description: 'Search chemical compounds and molecular data via ChemSpider/RSC with SettleGrid billing.',
  keywords: ['science', 'chemistry', 'compounds', 'chemspider'],
  upstream: { provider: 'Royal Society of Chemistry', baseUrl: 'https://api.rsc.org/compounds/v1', auth: 'Free API key required', rateLimit: '15 req/min', docsUrl: 'https://developer.rsc.org/compounds-v1/apis' },
  auth: { type: 'query', keyEnvVar: 'CHEMSPIDER_API_KEY', keyDesc: 'ChemSpider / RSC API key' },
  methods: [
    { name: 'search_compounds', displayName: 'Search Compounds', costCents: 2, description: 'Search compounds by name or formula', params: [{ name: 'query', type: 'string', required: true, description: 'Compound name or formula' }] },
    { name: 'get_compound', displayName: 'Get Compound', costCents: 2, description: 'Get compound details by ChemSpider ID', params: [{ name: 'csid', type: 'number', required: true, description: 'ChemSpider compound ID' }] },
  ],
  serverTs: `/**
 * settlegrid-chemspider — ChemSpider Chemical Compounds MCP Server
 *
 * Wraps the RSC Compounds API with SettleGrid billing.
 * Requires a free ChemSpider API key.
 *
 * Methods:
 *   search_compounds(query)  — Search compounds    (2¢)
 *   get_compound(csid)       — Get compound info   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
}

interface CompoundInput {
  csid: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const RSC_BASE = 'https://api.rsc.org/compounds/v1'
const API_KEY = process.env.CHEMSPIDER_API_KEY || ''

async function rscFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_KEY) {
    throw new Error('CHEMSPIDER_API_KEY environment variable is required')
  }
  const res = await fetch(\`\${RSC_BASE}\${path}\`, {
    ...options,
    headers: {
      apikey: API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ChemSpider API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chemspider',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_compounds: { costCents: 2, displayName: 'Search Compounds' },
      get_compound: { costCents: 2, displayName: 'Get Compound' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompounds = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (compound name or formula)')
  }
  const data = await rscFetch<{ queryId: string }>('/filter/name', {
    method: 'POST',
    body: JSON.stringify({ name: args.query, orderBy: 'recordId', orderDirection: 'ascending' }),
  })
  const results = await rscFetch<{ results: number[] }>(
    \`/filter/\${data.queryId}/results?start=0&count=10\`
  )
  return {
    query: args.query,
    count: results.results.length,
    compoundIds: results.results,
  }
}, { method: 'search_compounds' })

const getCompound = sg.wrap(async (args: CompoundInput) => {
  if (typeof args.csid !== 'number' || !Number.isFinite(args.csid)) {
    throw new Error('csid must be a valid ChemSpider compound ID number')
  }
  const data = await rscFetch<any>(\`/records/\${args.csid}/details?fields=SMILES,Formula,CommonName,MolecularWeight,MonoisotopicMass\`)
  return {
    csid: args.csid,
    commonName: data.commonName,
    formula: data.formula,
    molecularWeight: data.molecularWeight,
    monoisotopicMass: data.monoisotopicMass,
    smiles: data.smiles,
  }
}, { method: 'get_compound' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompounds, getCompound }

console.log('settlegrid-chemspider MCP server ready')
console.log('Methods: search_compounds, get_compound')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 123. Open Library ───────────────────────────────────────────────────────

generateServer({
  slug: 'openlibrary',
  name: 'Open Library',
  description: 'Search books and authors from the Open Library (Internet Archive) with SettleGrid billing.',
  keywords: ['books', 'library', 'openlibrary'],
  upstream: { provider: 'Internet Archive', baseUrl: 'https://openlibrary.org', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://openlibrary.org/developers/api' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_books', displayName: 'Search Books', costCents: 1, description: 'Search books by title, author, or subject', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_book', displayName: 'Get Book', costCents: 1, description: 'Get book details by ISBN', params: [{ name: 'isbn', type: 'string', required: true, description: 'ISBN-10 or ISBN-13' }] },
  ],
  serverTs: `/**
 * settlegrid-openlibrary — Open Library Book Data MCP Server
 *
 * Wraps the Open Library API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_books(query, limit)  — Search books    (1¢)
 *   get_book(isbn)              — Get by ISBN     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface BookInput {
  isbn: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const OL_BASE = 'https://openlibrary.org'

async function olFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${OL_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Open Library API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openlibrary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_books: { costCents: 1, displayName: 'Search Books' },
      get_book: { costCents: 1, displayName: 'Get Book' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await olFetch<{ numFound: number; docs: any[] }>(
    \`/search.json?q=\${q}&limit=\${limit}\`
  )
  return {
    query: args.query,
    totalResults: data.numFound,
    books: data.docs.map((d: any) => ({
      key: d.key,
      title: d.title,
      authors: d.author_name || [],
      firstPublishYear: d.first_publish_year,
      isbn: d.isbn?.[0] || null,
      subjects: d.subject?.slice(0, 5) || [],
      coverUrl: d.cover_i ? \`https://covers.openlibrary.org/b/id/\${d.cover_i}-M.jpg\` : null,
    })),
  }
}, { method: 'search_books' })

const getBook = sg.wrap(async (args: BookInput) => {
  if (!args.isbn || typeof args.isbn !== 'string') {
    throw new Error('isbn is required (ISBN-10 or ISBN-13)')
  }
  const isbn = args.isbn.replace(/[\\s-]/g, '')
  if (!/^\\d{10}(\\d{3})?$/.test(isbn)) {
    throw new Error('isbn must be a valid ISBN-10 or ISBN-13')
  }
  const data = await olFetch<Record<string, any>>(\`/api/books?bibkeys=ISBN:\${isbn}&format=json&jscmd=data\`)
  const key = \`ISBN:\${isbn}\`
  if (!data[key]) {
    throw new Error(\`Book not found for ISBN: \${isbn}\`)
  }
  const b = data[key]
  return {
    isbn,
    title: b.title,
    authors: b.authors?.map((a: any) => a.name) || [],
    publishers: b.publishers?.map((p: any) => p.name) || [],
    publishDate: b.publish_date,
    pages: b.number_of_pages,
    subjects: b.subjects?.slice(0, 10).map((s: any) => s.name) || [],
    coverUrl: b.cover?.medium || null,
  }
}, { method: 'get_book' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBooks, getBook }

console.log('settlegrid-openlibrary MCP server ready')
console.log('Methods: search_books, get_book')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 124. ISBNdb ─────────────────────────────────────────────────────────────

generateServer({
  slug: 'isbndb',
  name: 'ISBNdb',
  description: 'Look up books by ISBN with detailed metadata from ISBNdb with SettleGrid billing.',
  keywords: ['books', 'isbn', 'isbndb'],
  upstream: { provider: 'ISBNdb', baseUrl: 'https://api2.isbndb.com', auth: 'API key required', rateLimit: '1 req/s (free tier)', docsUrl: 'https://isbndb.com/apidocs/v2' },
  auth: { type: 'header', keyEnvVar: 'ISBNDB_API_KEY', keyDesc: 'ISBNdb API key' },
  methods: [
    { name: 'get_book', displayName: 'Get Book', costCents: 2, description: 'Get book details by ISBN', params: [{ name: 'isbn', type: 'string', required: true, description: 'ISBN-10 or ISBN-13' }] },
    { name: 'search_books', displayName: 'Search Books', costCents: 2, description: 'Search books by title or query', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'page', type: 'number', required: false, description: 'Page number (default 1)' }] },
  ],
  serverTs: `/**
 * settlegrid-isbndb — ISBNdb Book Lookup MCP Server
 *
 * Wraps the ISBNdb API with SettleGrid billing.
 * Requires an ISBNdb API key.
 *
 * Methods:
 *   get_book(isbn)        — Get book by ISBN       (2¢)
 *   search_books(query)   — Search books           (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookInput {
  isbn: string
}

interface SearchInput {
  query: string
  page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ISBN_BASE = 'https://api2.isbndb.com'
const API_KEY = process.env.ISBNDB_API_KEY || ''

async function isbnFetch<T>(path: string): Promise<T> {
  if (!API_KEY) {
    throw new Error('ISBNDB_API_KEY environment variable is required')
  }
  const res = await fetch(\`\${ISBN_BASE}\${path}\`, {
    headers: { Authorization: API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ISBNdb API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'isbndb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_book: { costCents: 2, displayName: 'Get Book' },
      search_books: { costCents: 2, displayName: 'Search Books' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBook = sg.wrap(async (args: BookInput) => {
  if (!args.isbn || typeof args.isbn !== 'string') {
    throw new Error('isbn is required')
  }
  const isbn = args.isbn.replace(/[\\s-]/g, '')
  if (!/^\\d{10}(\\d{3})?$/.test(isbn)) {
    throw new Error('isbn must be a valid ISBN-10 or ISBN-13')
  }
  const data = await isbnFetch<{ book: any }>(\`/book/\${isbn}\`)
  const b = data.book
  return {
    isbn: isbn,
    isbn13: b.isbn13,
    title: b.title,
    titleLong: b.title_long,
    authors: b.authors || [],
    publisher: b.publisher,
    publishDate: b.date_published,
    pages: b.pages,
    language: b.language,
    subjects: b.subjects || [],
    synopsis: b.synopsis?.slice(0, 1000),
  }
}, { method: 'get_book' })

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const page = Math.max(args.page ?? 1, 1)
  const q = encodeURIComponent(args.query)
  const data = await isbnFetch<{ total: number; books: any[] }>(
    \`/books/\${q}?page=\${page}&pageSize=10\`
  )
  return {
    query: args.query,
    total: data.total,
    books: (data.books || []).map((b: any) => ({
      isbn13: b.isbn13,
      title: b.title,
      authors: b.authors || [],
      publisher: b.publisher,
      publishDate: b.date_published,
      pages: b.pages,
    })),
  }
}, { method: 'search_books' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBook, searchBooks }

console.log('settlegrid-isbndb MCP server ready')
console.log('Methods: get_book, search_books')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 125. OpenAlex ───────────────────────────────────────────────────────────

generateServer({
  slug: 'open-alex',
  name: 'OpenAlex',
  description: 'Search academic works, authors, and institutions from OpenAlex with SettleGrid billing.',
  keywords: ['science', 'research', 'academic', 'openalex'],
  upstream: { provider: 'OpenAlex', baseUrl: 'https://api.openalex.org', auth: 'None required', rateLimit: '100k req/day polite', docsUrl: 'https://docs.openalex.org/' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_works', displayName: 'Search Works', costCents: 1, description: 'Search academic works', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'per_page', type: 'number', required: false, description: 'Results per page (1-20, default 10)' }] },
    { name: 'get_author', displayName: 'Get Author', costCents: 1, description: 'Get author profile by OpenAlex ID', params: [{ name: 'author_id', type: 'string', required: true, description: 'OpenAlex author ID (e.g. "A5023888391")' }] },
    { name: 'search_institutions', displayName: 'Search Institutions', costCents: 1, description: 'Search research institutions', params: [{ name: 'query', type: 'string', required: true, description: 'Institution name' }] },
  ],
  serverTs: `/**
 * settlegrid-open-alex — OpenAlex Academic Metadata MCP Server
 *
 * Wraps the OpenAlex API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_works(query, per_page)    — Search works         (1¢)
 *   get_author(author_id)            — Get author profile   (1¢)
 *   search_institutions(query)       — Search institutions  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchWorksInput {
  query: string
  per_page?: number
}

interface AuthorInput {
  author_id: string
}

interface InstitutionInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const OA_BASE = 'https://api.openalex.org'
const MAILTO = 'mailto=contact@settlegrid.ai'

async function oaFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${OA_BASE}\${path}\${sep}\${MAILTO}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenAlex API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-alex',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_works: { costCents: 1, displayName: 'Search Works' },
      get_author: { costCents: 1, displayName: 'Get Author' },
      search_institutions: { costCents: 1, displayName: 'Search Institutions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchWorks = sg.wrap(async (args: SearchWorksInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await oaFetch<{ meta: { count: number }; results: any[] }>(
    \`/works?search=\${q}&per_page=\${perPage}\`
  )
  return {
    query: args.query,
    totalCount: data.meta.count,
    works: data.results.map((w: any) => ({
      id: w.id,
      doi: w.doi,
      title: w.title,
      publicationYear: w.publication_year,
      citedByCount: w.cited_by_count,
      type: w.type,
      authors: w.authorships?.slice(0, 5).map((a: any) => a.author?.display_name) || [],
    })),
  }
}, { method: 'search_works' })

const getAuthor = sg.wrap(async (args: AuthorInput) => {
  if (!args.author_id || typeof args.author_id !== 'string') {
    throw new Error('author_id is required (e.g. "A5023888391")')
  }
  const data = await oaFetch<any>(\`/authors/\${encodeURIComponent(args.author_id)}\`)
  return {
    id: data.id,
    displayName: data.display_name,
    worksCount: data.works_count,
    citedByCount: data.cited_by_count,
    hIndex: data.summary_stats?.h_index,
    institution: data.last_known_institution?.display_name,
    topics: data.topics?.slice(0, 5).map((t: any) => t.display_name) || [],
  }
}, { method: 'get_author' })

const searchInstitutions = sg.wrap(async (args: InstitutionInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await oaFetch<{ results: any[] }>(\`/institutions?search=\${q}&per_page=10\`)
  return {
    query: args.query,
    institutions: data.results.map((i: any) => ({
      id: i.id,
      displayName: i.display_name,
      country: i.country_code,
      type: i.type,
      worksCount: i.works_count,
      citedByCount: i.cited_by_count,
      homepageUrl: i.homepage_url,
    })),
  }
}, { method: 'search_institutions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchWorks, getAuthor, searchInstitutions }

console.log('settlegrid-open-alex MCP server ready')
console.log('Methods: search_works, get_author, search_institutions')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

console.log('\n=== Social/Content (15 servers) ===\n')

// ─── 126. Reddit ─────────────────────────────────────────────────────────────

generateServer({
  slug: 'reddit',
  name: 'Reddit',
  description: 'Fetch Reddit posts, comments, and subreddit data via public JSON API with SettleGrid billing.',
  keywords: ['social', 'reddit', 'posts', 'comments'],
  upstream: { provider: 'Reddit', baseUrl: 'https://www.reddit.com', auth: 'None for .json endpoints', rateLimit: '10 req/min unauthenticated', docsUrl: 'https://www.reddit.com/dev/api/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_subreddit', displayName: 'Get Subreddit', costCents: 1, description: 'Get hot posts from a subreddit', params: [{ name: 'subreddit', type: 'string', required: true, description: 'Subreddit name (without r/)' }, { name: 'limit', type: 'number', required: false, description: 'Max posts (1-25, default 10)' }] },
    { name: 'search_posts', displayName: 'Search Posts', costCents: 1, description: 'Search Reddit posts', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'subreddit', type: 'string', required: false, description: 'Limit to subreddit' }] },
  ],
  serverTs: `/**
 * settlegrid-reddit — Reddit Posts & Comments MCP Server
 *
 * Wraps the Reddit public JSON API with SettleGrid billing.
 * No API key needed for public .json endpoints.
 *
 * Methods:
 *   get_subreddit(subreddit, limit)  — Get hot posts      (1¢)
 *   search_posts(query, subreddit)   — Search posts       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubredditInput {
  subreddit: string
  limit?: number
}

interface SearchInput {
  query: string
  subreddit?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const REDDIT_BASE = 'https://www.reddit.com'

async function redditFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${REDDIT_BASE}\${path}\`, {
    headers: { 'User-Agent': 'settlegrid-reddit/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Reddit API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatPost(p: any): Record<string, unknown> {
  const d = p.data
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    subreddit: d.subreddit,
    score: d.score,
    numComments: d.num_comments,
    url: d.url,
    permalink: \`https://www.reddit.com\${d.permalink}\`,
    selftext: d.selftext?.slice(0, 500) || '',
    createdUtc: new Date(d.created_utc * 1000).toISOString(),
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'reddit',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_subreddit: { costCents: 1, displayName: 'Get Subreddit' },
      search_posts: { costCents: 1, displayName: 'Search Posts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSubreddit = sg.wrap(async (args: SubredditInput) => {
  if (!args.subreddit || typeof args.subreddit !== 'string') {
    throw new Error('subreddit is required (e.g. "programming")')
  }
  const sub = args.subreddit.replace(/^r\\//, '').trim()
  if (!/^[a-zA-Z0-9_]{1,40}$/.test(sub)) {
    throw new Error('Invalid subreddit name')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const data = await redditFetch<{ data: { children: any[] } }>(
    \`/r/\${sub}/hot.json?limit=\${limit}\`
  )
  return {
    subreddit: sub,
    count: data.data.children.length,
    posts: data.data.children.map(formatPost),
  }
}, { method: 'get_subreddit' })

const searchPosts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const sub = args.subreddit ? \`/r/\${args.subreddit.replace(/^r\\//, '')}\` : ''
  const data = await redditFetch<{ data: { children: any[] } }>(
    \`\${sub}/search.json?q=\${q}&limit=10&sort=relevance\`
  )
  return {
    query: args.query,
    count: data.data.children.length,
    posts: data.data.children.map(formatPost),
  }
}, { method: 'search_posts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSubreddit, searchPosts }

console.log('settlegrid-reddit MCP server ready')
console.log('Methods: get_subreddit, search_posts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 127. Hacker News ────────────────────────────────────────────────────────

generateServer({
  slug: 'hackernews',
  name: 'Hacker News',
  description: 'Fetch Hacker News stories, comments, and user data via Firebase API with SettleGrid billing.',
  keywords: ['social', 'hackernews', 'tech', 'stories'],
  upstream: { provider: 'Hacker News', baseUrl: 'https://hacker-news.firebaseio.com/v0', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://github.com/HackerNews/API' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_top_stories', displayName: 'Top Stories', costCents: 1, description: 'Get top HN stories', params: [{ name: 'limit', type: 'number', required: false, description: 'Max stories (1-30, default 10)' }] },
    { name: 'get_item', displayName: 'Get Item', costCents: 1, description: 'Get story or comment by ID', params: [{ name: 'id', type: 'number', required: true, description: 'HN item ID' }] },
    { name: 'get_user', displayName: 'Get User', costCents: 1, description: 'Get user profile', params: [{ name: 'username', type: 'string', required: true, description: 'HN username' }] },
  ],
  serverTs: `/**
 * settlegrid-hackernews — Hacker News MCP Server
 *
 * Wraps the HN Firebase API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_top_stories(limit)   — Top stories      (1¢)
 *   get_item(id)             — Story/comment    (1¢)
 *   get_user(username)       — User profile     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopStoriesInput {
  limit?: number
}

interface ItemInput {
  id: number
}

interface UserInput {
  username: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const HN_BASE = 'https://hacker-news.firebaseio.com/v0'

async function hnFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${HN_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`HN API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hackernews',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_top_stories: { costCents: 1, displayName: 'Top Stories' },
      get_item: { costCents: 1, displayName: 'Get Item' },
      get_user: { costCents: 1, displayName: 'Get User' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTopStories = sg.wrap(async (args: TopStoriesInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 30)
  const ids = await hnFetch<number[]>('/topstories.json')
  const topIds = ids.slice(0, limit)
  const stories = await Promise.all(
    topIds.map((id) => hnFetch<any>(\`/item/\${id}.json\`))
  )
  return {
    count: stories.length,
    stories: stories.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url || null,
      score: s.score,
      by: s.by,
      time: new Date(s.time * 1000).toISOString(),
      descendants: s.descendants || 0,
      type: s.type,
    })),
  }
}, { method: 'get_top_stories' })

const getItem = sg.wrap(async (args: ItemInput) => {
  if (typeof args.id !== 'number' || !Number.isFinite(args.id)) {
    throw new Error('id must be a number')
  }
  const item = await hnFetch<any>(\`/item/\${args.id}.json\`)
  if (!item) throw new Error(\`Item not found: \${args.id}\`)
  return {
    id: item.id,
    type: item.type,
    title: item.title || null,
    text: item.text?.slice(0, 1000) || null,
    url: item.url || null,
    score: item.score || 0,
    by: item.by,
    time: new Date(item.time * 1000).toISOString(),
    kids: item.kids?.slice(0, 10) || [],
  }
}, { method: 'get_item' })

const getUser = sg.wrap(async (args: UserInput) => {
  if (!args.username || typeof args.username !== 'string') {
    throw new Error('username is required')
  }
  const user = await hnFetch<any>(\`/user/\${encodeURIComponent(args.username)}.json\`)
  if (!user) throw new Error(\`User not found: \${args.username}\`)
  return {
    id: user.id,
    karma: user.karma,
    about: user.about?.slice(0, 500) || null,
    created: new Date(user.created * 1000).toISOString(),
    submitted: user.submitted?.length || 0,
  }
}, { method: 'get_user' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTopStories, getItem, getUser }

console.log('settlegrid-hackernews MCP server ready')
console.log('Methods: get_top_stories, get_item, get_user')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 128. Stack Exchange ─────────────────────────────────────────────────────

generateServer({
  slug: 'stack-exchange',
  name: 'Stack Exchange',
  description: 'Search Stack Overflow questions and answers via the Stack Exchange API with SettleGrid billing.',
  keywords: ['social', 'stackoverflow', 'qa', 'programming'],
  upstream: { provider: 'Stack Exchange', baseUrl: 'https://api.stackexchange.com/2.3', auth: 'None required', rateLimit: '300 req/day without key', docsUrl: 'https://api.stackexchange.com/docs' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_questions', displayName: 'Search Questions', costCents: 1, description: 'Search Stack Overflow questions', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'tagged', type: 'string', required: false, description: 'Tag filter (semicolon-separated)' }, { name: 'pagesize', type: 'number', required: false, description: 'Results (1-20, default 10)' }] },
    { name: 'get_answers', displayName: 'Get Answers', costCents: 1, description: 'Get answers for a question', params: [{ name: 'question_id', type: 'number', required: true, description: 'Question ID' }] },
  ],
  serverTs: `/**
 * settlegrid-stack-exchange — Stack Overflow Q&A MCP Server
 *
 * Wraps the Stack Exchange API with SettleGrid billing.
 * No API key needed for basic usage.
 *
 * Methods:
 *   search_questions(query, tagged, pagesize)  — Search questions  (1¢)
 *   get_answers(question_id)                   — Get answers       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  tagged?: string
  pagesize?: number
}

interface AnswersInput {
  question_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SE_BASE = 'https://api.stackexchange.com/2.3'

async function seFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${SE_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Stack Exchange API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').slice(0, 500)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'stack-exchange',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_questions: { costCents: 1, displayName: 'Search Questions' },
      get_answers: { costCents: 1, displayName: 'Get Answers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchQuestions = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const pagesize = Math.min(Math.max(args.pagesize ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  let url = \`/search/advanced?order=desc&sort=relevance&q=\${q}&site=stackoverflow&pagesize=\${pagesize}&filter=withbody\`
  if (args.tagged) url += \`&tagged=\${encodeURIComponent(args.tagged)}\`

  const data = await seFetch<{ items: any[]; has_more: boolean }>(url)
  return {
    query: args.query,
    count: data.items.length,
    hasMore: data.has_more,
    questions: data.items.map((q: any) => ({
      questionId: q.question_id,
      title: q.title,
      score: q.score,
      answerCount: q.answer_count,
      isAnswered: q.is_answered,
      tags: q.tags,
      link: q.link,
      body: stripHtml(q.body || ''),
      creationDate: new Date(q.creation_date * 1000).toISOString(),
    })),
  }
}, { method: 'search_questions' })

const getAnswers = sg.wrap(async (args: AnswersInput) => {
  if (typeof args.question_id !== 'number' || !Number.isFinite(args.question_id)) {
    throw new Error('question_id must be a number')
  }
  const data = await seFetch<{ items: any[] }>(
    \`/questions/\${args.question_id}/answers?order=desc&sort=votes&site=stackoverflow&filter=withbody\`
  )
  return {
    questionId: args.question_id,
    count: data.items.length,
    answers: data.items.map((a: any) => ({
      answerId: a.answer_id,
      score: a.score,
      isAccepted: a.is_accepted,
      body: stripHtml(a.body || ''),
      creationDate: new Date(a.creation_date * 1000).toISOString(),
    })),
  }
}, { method: 'get_answers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchQuestions, getAnswers }

console.log('settlegrid-stack-exchange MCP server ready')
console.log('Methods: search_questions, get_answers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 129. DEV.to ─────────────────────────────────────────────────────────────

generateServer({
  slug: 'devto',
  name: 'DEV.to',
  description: 'Search and read DEV.to developer articles with SettleGrid billing.',
  keywords: ['social', 'devto', 'articles', 'programming'],
  upstream: { provider: 'DEV.to', baseUrl: 'https://dev.to/api', auth: 'Free API key optional', rateLimit: '30 req/30s', docsUrl: 'https://developers.forem.com/api/v1' },
  auth: { type: 'header', keyEnvVar: 'DEVTO_API_KEY', keyDesc: 'DEV.to API key (optional for public reads)' },
  methods: [
    { name: 'get_articles', displayName: 'Get Articles', costCents: 1, description: 'Get latest or top articles', params: [{ name: 'tag', type: 'string', required: false, description: 'Filter by tag' }, { name: 'per_page', type: 'number', required: false, description: 'Results (1-20, default 10)' }] },
    { name: 'search_articles', displayName: 'Search Articles', costCents: 1, description: 'Search DEV.to articles', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'per_page', type: 'number', required: false, description: 'Results (1-20, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-devto — DEV.to Articles MCP Server
 *
 * Wraps the DEV.to (Forem) API with SettleGrid billing.
 * API key optional for public read operations.
 *
 * Methods:
 *   get_articles(tag, per_page)       — Get articles    (1¢)
 *   search_articles(query, per_page)  — Search articles (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ArticlesInput {
  tag?: string
  per_page?: number
}

interface SearchInput {
  query: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DEV_BASE = 'https://dev.to/api'
const API_KEY = process.env.DEVTO_API_KEY || ''

async function devFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (API_KEY) headers['api-key'] = API_KEY
  const res = await fetch(\`\${DEV_BASE}\${path}\`, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`DEV.to API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatArticle(a: any): Record<string, unknown> {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    url: a.url,
    tags: a.tag_list || a.tags,
    author: a.user?.name || a.user?.username,
    publishedAt: a.published_at,
    positiveReactions: a.positive_reactions_count,
    comments: a.comments_count,
    readingTime: a.reading_time_minutes,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'devto',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_articles: { costCents: 1, displayName: 'Get Articles' },
      search_articles: { costCents: 1, displayName: 'Search Articles' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getArticles = sg.wrap(async (args: ArticlesInput) => {
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  let url = \`/articles?per_page=\${perPage}\`
  if (args.tag) url += \`&tag=\${encodeURIComponent(args.tag)}\`
  const data = await devFetch<any[]>(url)
  return {
    tag: args.tag || null,
    count: data.length,
    articles: data.map(formatArticle),
  }
}, { method: 'get_articles' })

const searchArticles = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await devFetch<any[]>(\`/articles?per_page=\${perPage}&search=\${q}\`)
  return {
    query: args.query,
    count: data.length,
    articles: data.map(formatArticle),
  }
}, { method: 'search_articles' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getArticles, searchArticles }

console.log('settlegrid-devto MCP server ready')
console.log('Methods: get_articles, search_articles')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 130. Hashnode ───────────────────────────────────────────────────────────

generateServer({
  slug: 'hashnode',
  name: 'Hashnode',
  description: 'Search and read Hashnode blog posts via GraphQL API with SettleGrid billing.',
  keywords: ['social', 'hashnode', 'blog', 'developer'],
  upstream: { provider: 'Hashnode', baseUrl: 'https://gql.hashnode.com', auth: 'None for public reads', rateLimit: 'Reasonable use', docsUrl: 'https://apidocs.hashnode.com/' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_posts', displayName: 'Search Posts', costCents: 1, description: 'Search Hashnode posts', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'first', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_publication', displayName: 'Get Publication', costCents: 1, description: 'Get a Hashnode publication by host', params: [{ name: 'host', type: 'string', required: true, description: 'Publication host (e.g. "blog.example.com")' }] },
  ],
  serverTs: `/**
 * settlegrid-hashnode — Hashnode Blog Posts MCP Server
 *
 * Wraps the Hashnode GraphQL API with SettleGrid billing.
 * No API key needed for public reads.
 *
 * Methods:
 *   search_posts(query, first)    — Search posts            (1¢)
 *   get_publication(host)         — Get publication info     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  first?: number
}

interface PublicationInput {
  host: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GQL_URL = 'https://gql.hashnode.com'

async function gqlFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Hashnode API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as { data: T; errors?: any[] }
  if (json.errors?.length) {
    throw new Error(\`Hashnode GQL Error: \${json.errors[0].message}\`)
  }
  return json.data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hashnode',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_posts: { costCents: 1, displayName: 'Search Posts' },
      get_publication: { costCents: 1, displayName: 'Get Publication' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPosts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const first = Math.min(Math.max(args.first ?? 10, 1), 20)
  const data = await gqlFetch<{ searchPostsOfPublication: { edges: any[] } }>(
    \`query SearchPosts($query: String!, $first: Int!) {
      searchPostsOfPublication(first: $first, filter: { query: $query }) {
        edges {
          node {
            id
            title
            brief
            url
            publishedAt
            reactionCount
            author { name username }
            tags { name }
          }
        }
      }
    }\`,
    { query: args.query, first }
  )
  const edges = data.searchPostsOfPublication?.edges || []
  return {
    query: args.query,
    count: edges.length,
    posts: edges.map((e: any) => ({
      id: e.node.id,
      title: e.node.title,
      brief: e.node.brief?.slice(0, 300),
      url: e.node.url,
      publishedAt: e.node.publishedAt,
      reactions: e.node.reactionCount,
      author: e.node.author?.name,
      tags: e.node.tags?.map((t: any) => t.name) || [],
    })),
  }
}, { method: 'search_posts' })

const getPublication = sg.wrap(async (args: PublicationInput) => {
  if (!args.host || typeof args.host !== 'string') {
    throw new Error('host is required (e.g. "blog.example.com")')
  }
  const data = await gqlFetch<{ publication: any }>(
    \`query GetPub($host: String!) {
      publication(host: $host) {
        id
        title
        displayTitle
        descriptionSEO
        url
        posts(first: 5) {
          edges {
            node { title brief url publishedAt }
          }
        }
      }
    }\`,
    { host: args.host }
  )
  const pub = data.publication
  if (!pub) throw new Error(\`Publication not found: \${args.host}\`)
  return {
    id: pub.id,
    title: pub.title || pub.displayTitle,
    description: pub.descriptionSEO,
    url: pub.url,
    recentPosts: pub.posts?.edges?.map((e: any) => ({
      title: e.node.title,
      brief: e.node.brief?.slice(0, 200),
      url: e.node.url,
      publishedAt: e.node.publishedAt,
    })) || [],
  }
}, { method: 'get_publication' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPosts, getPublication }

console.log('settlegrid-hashnode MCP server ready')
console.log('Methods: search_posts, get_publication')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 131. Mastodon ───────────────────────────────────────────────────────────

generateServer({
  slug: 'mastodon',
  name: 'Mastodon',
  description: 'Fetch public Mastodon timelines and search posts via mastodon.social API with SettleGrid billing.',
  keywords: ['social', 'mastodon', 'fediverse', 'microblog'],
  upstream: { provider: 'Mastodon', baseUrl: 'https://mastodon.social/api/v1', auth: 'None for public endpoints', rateLimit: '300 req/5min', docsUrl: 'https://docs.joinmastodon.org/api/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_public_timeline', displayName: 'Public Timeline', costCents: 1, description: 'Get public timeline posts', params: [{ name: 'limit', type: 'number', required: false, description: 'Max posts (1-20, default 10)' }] },
    { name: 'search', displayName: 'Search', costCents: 1, description: 'Search accounts, hashtags, and statuses', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'type', type: 'string', required: false, description: 'Filter: accounts, hashtags, or statuses' }] },
  ],
  serverTs: `/**
 * settlegrid-mastodon — Mastodon Public Timeline MCP Server
 *
 * Wraps the Mastodon API (mastodon.social) with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_public_timeline(limit)   — Public timeline    (1¢)
 *   search(query, type)          — Search Mastodon    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimelineInput {
  limit?: number
}

interface SearchInput {
  query: string
  type?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MASTO_BASE = 'https://mastodon.social/api'

async function mastoFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${MASTO_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Mastodon API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').slice(0, 500)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mastodon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_public_timeline: { costCents: 1, displayName: 'Public Timeline' },
      search: { costCents: 1, displayName: 'Search' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPublicTimeline = sg.wrap(async (args: TimelineInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await mastoFetch<any[]>(\`/v1/timelines/public?limit=\${limit}\`)
  return {
    count: data.length,
    statuses: data.map((s: any) => ({
      id: s.id,
      content: stripHtml(s.content),
      account: s.account?.acct,
      displayName: s.account?.display_name,
      createdAt: s.created_at,
      favourites: s.favourites_count,
      reblogs: s.reblogs_count,
      replies: s.replies_count,
      language: s.language,
    })),
  }
}, { method: 'get_public_timeline' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  let url = \`/v2/search?q=\${q}&limit=10\`
  if (args.type && ['accounts', 'hashtags', 'statuses'].includes(args.type)) {
    url += \`&type=\${args.type}\`
  }
  const data = await mastoFetch<{ accounts: any[]; statuses: any[]; hashtags: any[] }>(url)
  return {
    query: args.query,
    accounts: data.accounts?.slice(0, 5).map((a: any) => ({
      id: a.id, acct: a.acct, displayName: a.display_name, followersCount: a.followers_count,
    })) || [],
    statuses: data.statuses?.slice(0, 5).map((s: any) => ({
      id: s.id, content: stripHtml(s.content), account: s.account?.acct, createdAt: s.created_at,
    })) || [],
    hashtags: data.hashtags?.slice(0, 5).map((h: any) => ({
      name: h.name, url: h.url,
    })) || [],
  }
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPublicTimeline, search }

console.log('settlegrid-mastodon MCP server ready')
console.log('Methods: get_public_timeline, search')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 132. Bluesky ────────────────────────────────────────────────────────────

generateServer({
  slug: 'bluesky',
  name: 'Bluesky',
  description: 'Fetch Bluesky posts and profiles from the AT Protocol public API with SettleGrid billing.',
  keywords: ['social', 'bluesky', 'atproto', 'microblog'],
  upstream: { provider: 'Bluesky', baseUrl: 'https://public.api.bsky.app/xrpc', auth: 'None for public endpoints', rateLimit: '3000 req/5min', docsUrl: 'https://docs.bsky.app/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_profile', displayName: 'Get Profile', costCents: 1, description: 'Get a Bluesky user profile', params: [{ name: 'handle', type: 'string', required: true, description: 'Bluesky handle (e.g. "user.bsky.social")' }] },
    { name: 'get_author_feed', displayName: 'Get Author Feed', costCents: 1, description: 'Get recent posts by a user', params: [{ name: 'handle', type: 'string', required: true, description: 'Bluesky handle' }, { name: 'limit', type: 'number', required: false, description: 'Max posts (1-20, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-bluesky — Bluesky Posts & Profiles MCP Server
 *
 * Wraps the Bluesky AT Protocol public API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_profile(handle)              — Get user profile   (1¢)
 *   get_author_feed(handle, limit)   — Get user's posts   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileInput {
  handle: string
}

interface FeedInput {
  handle: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BSKY_BASE = 'https://public.api.bsky.app/xrpc'

async function bskyFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BSKY_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Bluesky API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bluesky',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_profile: { costCents: 1, displayName: 'Get Profile' },
      get_author_feed: { costCents: 1, displayName: 'Get Author Feed' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProfile = sg.wrap(async (args: ProfileInput) => {
  if (!args.handle || typeof args.handle !== 'string') {
    throw new Error('handle is required (e.g. "user.bsky.social")')
  }
  const h = encodeURIComponent(args.handle.trim())
  const data = await bskyFetch<any>(\`/app.bsky.actor.getProfile?actor=\${h}\`)
  return {
    did: data.did,
    handle: data.handle,
    displayName: data.displayName,
    description: data.description?.slice(0, 500),
    followersCount: data.followersCount,
    followsCount: data.followsCount,
    postsCount: data.postsCount,
    avatar: data.avatar,
    createdAt: data.createdAt,
  }
}, { method: 'get_profile' })

const getAuthorFeed = sg.wrap(async (args: FeedInput) => {
  if (!args.handle || typeof args.handle !== 'string') {
    throw new Error('handle is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const h = encodeURIComponent(args.handle.trim())
  const data = await bskyFetch<{ feed: any[] }>(
    \`/app.bsky.feed.getAuthorFeed?actor=\${h}&limit=\${limit}\`
  )
  return {
    handle: args.handle,
    count: data.feed.length,
    posts: data.feed.map((item: any) => ({
      uri: item.post?.uri,
      text: item.post?.record?.text?.slice(0, 500),
      createdAt: item.post?.record?.createdAt,
      likeCount: item.post?.likeCount,
      repostCount: item.post?.repostCount,
      replyCount: item.post?.replyCount,
    })),
  }
}, { method: 'get_author_feed' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProfile, getAuthorFeed }

console.log('settlegrid-bluesky MCP server ready')
console.log('Methods: get_profile, get_author_feed')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 133. Lobsters ───────────────────────────────────────────────────────────

generateServer({
  slug: 'lobsters',
  name: 'Lobste.rs',
  description: 'Fetch Lobste.rs tech community stories via JSON API with SettleGrid billing.',
  keywords: ['social', 'lobsters', 'tech', 'news'],
  upstream: { provider: 'Lobste.rs', baseUrl: 'https://lobste.rs', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://lobste.rs/about' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_hottest', displayName: 'Hottest Stories', costCents: 1, description: 'Get hottest stories', params: [] },
    { name: 'get_newest', displayName: 'Newest Stories', costCents: 1, description: 'Get newest stories', params: [] },
  ],
  serverTs: `/**
 * settlegrid-lobsters — Lobste.rs Tech Stories MCP Server
 *
 * Wraps the Lobste.rs JSON API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_hottest()  — Hottest stories  (1¢)
 *   get_newest()   — Newest stories   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const LOBSTERS_BASE = 'https://lobste.rs'

async function lobstersFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${LOBSTERS_BASE}\${path}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Lobste.rs API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatStory(s: any): Record<string, unknown> {
  return {
    shortId: s.short_id,
    title: s.title,
    url: s.url,
    score: s.score,
    commentCount: s.comment_count,
    tags: s.tags,
    submitter: s.submitter_user?.username || s.submitter_user,
    createdAt: s.created_at,
    commentsUrl: s.comments_url,
    description: s.description?.slice(0, 300) || '',
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'lobsters',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_hottest: { costCents: 1, displayName: 'Hottest Stories' },
      get_newest: { costCents: 1, displayName: 'Newest Stories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHottest = sg.wrap(async () => {
  const data = await lobstersFetch<any[]>('/hottest.json')
  return {
    count: data.length,
    stories: data.slice(0, 25).map(formatStory),
  }
}, { method: 'get_hottest' })

const getNewest = sg.wrap(async () => {
  const data = await lobstersFetch<any[]>('/newest.json')
  return {
    count: data.length,
    stories: data.slice(0, 25).map(formatStory),
  }
}, { method: 'get_newest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHottest, getNewest }

console.log('settlegrid-lobsters MCP server ready')
console.log('Methods: get_hottest, get_newest')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 134. Product Hunt ───────────────────────────────────────────────────────

generateServer({
  slug: 'producthunt',
  name: 'Product Hunt',
  description: 'Discover new tech products via Product Hunt GraphQL API with SettleGrid billing.',
  keywords: ['social', 'producthunt', 'startups', 'tech'],
  upstream: { provider: 'Product Hunt', baseUrl: 'https://api.producthunt.com/v2/api/graphql', auth: 'Bearer token required', rateLimit: '450 req/15min', docsUrl: 'https://api.producthunt.com/v2/docs' },
  auth: { type: 'header', keyEnvVar: 'PRODUCTHUNT_TOKEN', keyDesc: 'Product Hunt developer token' },
  methods: [
    { name: 'get_posts', displayName: 'Get Posts', costCents: 2, description: 'Get top Product Hunt posts', params: [{ name: 'first', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'search_posts', displayName: 'Search Posts', costCents: 2, description: 'Search Product Hunt', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }] },
  ],
  serverTs: `/**
 * settlegrid-producthunt — Product Hunt Posts MCP Server
 *
 * Wraps the Product Hunt GraphQL API with SettleGrid billing.
 * Requires a Product Hunt developer token.
 *
 * Methods:
 *   get_posts(first)       — Get top posts      (2¢)
 *   search_posts(query)    — Search products    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PostsInput {
  first?: number
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PH_GQL = 'https://api.producthunt.com/v2/api/graphql'
const TOKEN = process.env.PRODUCTHUNT_TOKEN || ''

async function phFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!TOKEN) throw new Error('PRODUCTHUNT_TOKEN environment variable is required')
  const res = await fetch(PH_GQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${TOKEN}\`,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Product Hunt API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as { data: T; errors?: any[] }
  if (json.errors?.length) throw new Error(\`PH GQL: \${json.errors[0].message}\`)
  return json.data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'producthunt',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_posts: { costCents: 2, displayName: 'Get Posts' },
      search_posts: { costCents: 2, displayName: 'Search Posts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPosts = sg.wrap(async (args: PostsInput) => {
  const first = Math.min(Math.max(args.first ?? 10, 1), 20)
  const data = await phFetch<{ posts: { edges: any[] } }>(
    \`query($first: Int!) { posts(first: $first) { edges { node { id name tagline votesCount url thumbnail { url } topics { edges { node { name } } } } } } }\`,
    { first }
  )
  return {
    count: data.posts.edges.length,
    posts: data.posts.edges.map((e: any) => ({
      id: e.node.id,
      name: e.node.name,
      tagline: e.node.tagline,
      votes: e.node.votesCount,
      url: e.node.url,
      thumbnail: e.node.thumbnail?.url,
      topics: e.node.topics?.edges?.map((t: any) => t.node.name) || [],
    })),
  }
}, { method: 'get_posts' })

const searchPosts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const data = await phFetch<{ posts: { edges: any[] } }>(
    \`query($query: String!) { posts(first: 10, search: $query) { edges { node { id name tagline votesCount url } } } }\`,
    { query: args.query }
  )
  return {
    query: args.query,
    count: data.posts.edges.length,
    posts: data.posts.edges.map((e: any) => ({
      id: e.node.id,
      name: e.node.name,
      tagline: e.node.tagline,
      votes: e.node.votesCount,
      url: e.node.url,
    })),
  }
}, { method: 'search_posts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPosts, searchPosts }

console.log('settlegrid-producthunt MCP server ready')
console.log('Methods: get_posts, search_posts')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 135. Giphy ──────────────────────────────────────────────────────────────

generateServer({
  slug: 'giphy',
  name: 'Giphy',
  description: 'Search and browse GIFs from the Giphy API with SettleGrid billing.',
  keywords: ['content', 'giphy', 'gifs', 'images'],
  upstream: { provider: 'Giphy', baseUrl: 'https://api.giphy.com/v1', auth: 'Free API key required', rateLimit: '42 req/hr (beta key)', docsUrl: 'https://developers.giphy.com/docs/api/' },
  auth: { type: 'query', keyEnvVar: 'GIPHY_API_KEY', keyDesc: 'Giphy API key' },
  methods: [
    { name: 'search_gifs', displayName: 'Search GIFs', costCents: 2, description: 'Search for GIFs', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-25, default 10)' }] },
    { name: 'get_trending', displayName: 'Trending GIFs', costCents: 2, description: 'Get trending GIFs', params: [{ name: 'limit', type: 'number', required: false, description: 'Max results (1-25, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-giphy — Giphy GIF Search MCP Server
 *
 * Wraps the Giphy API with SettleGrid billing.
 * Requires a Giphy API key.
 *
 * Methods:
 *   search_gifs(query, limit)  — Search GIFs     (2¢)
 *   get_trending(limit)        — Trending GIFs   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface TrendingInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GIPHY_BASE = 'https://api.giphy.com/v1'
const API_KEY = process.env.GIPHY_API_KEY || ''

async function giphyFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('GIPHY_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${GIPHY_BASE}\${path}\${sep}api_key=\${API_KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Giphy API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatGif(g: any): Record<string, unknown> {
  return {
    id: g.id,
    title: g.title,
    url: g.url,
    gifUrl: g.images?.original?.url,
    previewUrl: g.images?.preview_gif?.url,
    width: g.images?.original?.width,
    height: g.images?.original?.height,
    rating: g.rating,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'giphy',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_gifs: { costCents: 2, displayName: 'Search GIFs' },
      get_trending: { costCents: 2, displayName: 'Trending GIFs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGifs = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const q = encodeURIComponent(args.query)
  const data = await giphyFetch<{ data: any[]; pagination: any }>(
    \`/gifs/search?q=\${q}&limit=\${limit}&rating=g\`
  )
  return {
    query: args.query,
    count: data.data.length,
    totalCount: data.pagination.total_count,
    gifs: data.data.map(formatGif),
  }
}, { method: 'search_gifs' })

const getTrending = sg.wrap(async (args: TrendingInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const data = await giphyFetch<{ data: any[] }>(\`/gifs/trending?limit=\${limit}&rating=g\`)
  return {
    count: data.data.length,
    gifs: data.data.map(formatGif),
  }
}, { method: 'get_trending' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGifs, getTrending }

console.log('settlegrid-giphy MCP server ready')
console.log('Methods: search_gifs, get_trending')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 136. Unsplash ───────────────────────────────────────────────────────────

generateServer({
  slug: 'unsplash',
  name: 'Unsplash',
  description: 'Search free high-quality photos from Unsplash with SettleGrid billing.',
  keywords: ['content', 'unsplash', 'photos', 'images'],
  upstream: { provider: 'Unsplash', baseUrl: 'https://api.unsplash.com', auth: 'Free API key required', rateLimit: '50 req/hr', docsUrl: 'https://unsplash.com/documentation' },
  auth: { type: 'header', keyEnvVar: 'UNSPLASH_ACCESS_KEY', keyDesc: 'Unsplash Access Key' },
  methods: [
    { name: 'search_photos', displayName: 'Search Photos', costCents: 2, description: 'Search Unsplash photos', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'per_page', type: 'number', required: false, description: 'Results (1-20, default 10)' }] },
    { name: 'get_random', displayName: 'Random Photo', costCents: 2, description: 'Get a random photo', params: [{ name: 'query', type: 'string', required: false, description: 'Optional topic filter' }] },
  ],
  serverTs: `/**
 * settlegrid-unsplash — Unsplash Photo Search MCP Server
 *
 * Wraps the Unsplash API with SettleGrid billing.
 * Requires a free Unsplash Access Key.
 *
 * Methods:
 *   search_photos(query, per_page)  — Search photos      (2¢)
 *   get_random(query)               — Random photo       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  per_page?: number
}

interface RandomInput {
  query?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const UNSPLASH_BASE = 'https://api.unsplash.com'
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || ''

async function unsplashFetch<T>(path: string): Promise<T> {
  if (!ACCESS_KEY) throw new Error('UNSPLASH_ACCESS_KEY environment variable is required')
  const res = await fetch(\`\${UNSPLASH_BASE}\${path}\`, {
    headers: { Authorization: \`Client-ID \${ACCESS_KEY}\` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Unsplash API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatPhoto(p: any): Record<string, unknown> {
  return {
    id: p.id,
    description: p.description || p.alt_description,
    width: p.width,
    height: p.height,
    color: p.color,
    urls: { regular: p.urls?.regular, small: p.urls?.small, thumb: p.urls?.thumb },
    photographer: p.user?.name,
    photographerUrl: p.user?.links?.html,
    likes: p.likes,
    downloadUrl: p.links?.download,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'unsplash',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_photos: { costCents: 2, displayName: 'Search Photos' },
      get_random: { costCents: 2, displayName: 'Random Photo' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPhotos = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await unsplashFetch<{ total: number; results: any[] }>(
    \`/search/photos?query=\${q}&per_page=\${perPage}\`
  )
  return {
    query: args.query,
    total: data.total,
    photos: data.results.map(formatPhoto),
  }
}, { method: 'search_photos' })

const getRandom = sg.wrap(async (args: RandomInput) => {
  let url = '/photos/random'
  if (args.query) url += \`?query=\${encodeURIComponent(args.query)}\`
  const data = await unsplashFetch<any>(url)
  return formatPhoto(data)
}, { method: 'get_random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPhotos, getRandom }

console.log('settlegrid-unsplash MCP server ready')
console.log('Methods: search_photos, get_random')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 137. Pexels ─────────────────────────────────────────────────────────────

generateServer({
  slug: 'pexels',
  name: 'Pexels',
  description: 'Search free stock photos and videos from Pexels with SettleGrid billing.',
  keywords: ['content', 'pexels', 'photos', 'stock'],
  upstream: { provider: 'Pexels', baseUrl: 'https://api.pexels.com/v1', auth: 'Free API key required', rateLimit: '200 req/hr', docsUrl: 'https://www.pexels.com/api/documentation/' },
  auth: { type: 'header', keyEnvVar: 'PEXELS_API_KEY', keyDesc: 'Pexels API key' },
  methods: [
    { name: 'search_photos', displayName: 'Search Photos', costCents: 2, description: 'Search Pexels photos', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'per_page', type: 'number', required: false, description: 'Results (1-20, default 10)' }] },
    { name: 'get_curated', displayName: 'Curated Photos', costCents: 2, description: 'Get curated editor picks', params: [{ name: 'per_page', type: 'number', required: false, description: 'Results (1-20, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-pexels — Pexels Stock Photos MCP Server
 *
 * Wraps the Pexels API with SettleGrid billing.
 * Requires a free Pexels API key.
 *
 * Methods:
 *   search_photos(query, per_page)  — Search photos     (2¢)
 *   get_curated(per_page)           — Curated picks     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  per_page?: number
}

interface CuratedInput {
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PEXELS_BASE = 'https://api.pexels.com/v1'
const API_KEY = process.env.PEXELS_API_KEY || ''

async function pexelsFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('PEXELS_API_KEY environment variable is required')
  const res = await fetch(\`\${PEXELS_BASE}\${path}\`, {
    headers: { Authorization: API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Pexels API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatPhoto(p: any): Record<string, unknown> {
  return {
    id: p.id,
    width: p.width,
    height: p.height,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    alt: p.alt,
    src: { original: p.src?.original, large: p.src?.large, medium: p.src?.medium, small: p.src?.small },
    url: p.url,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pexels',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_photos: { costCents: 2, displayName: 'Search Photos' },
      get_curated: { costCents: 2, displayName: 'Curated Photos' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPhotos = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await pexelsFetch<{ total_results: number; photos: any[] }>(
    \`/search?query=\${q}&per_page=\${perPage}\`
  )
  return {
    query: args.query,
    totalResults: data.total_results,
    photos: data.photos.map(formatPhoto),
  }
}, { method: 'search_photos' })

const getCurated = sg.wrap(async (args: CuratedInput) => {
  const perPage = Math.min(Math.max(args.per_page ?? 10, 1), 20)
  const data = await pexelsFetch<{ photos: any[] }>(\`/curated?per_page=\${perPage}\`)
  return {
    count: data.photos.length,
    photos: data.photos.map(formatPhoto),
  }
}, { method: 'get_curated' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPhotos, getCurated }

console.log('settlegrid-pexels MCP server ready')
console.log('Methods: search_photos, get_curated')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 138. Pixabay ────────────────────────────────────────────────────────────

generateServer({
  slug: 'pixabay',
  name: 'Pixabay',
  description: 'Search free images and videos from Pixabay with SettleGrid billing.',
  keywords: ['content', 'pixabay', 'images', 'videos'],
  upstream: { provider: 'Pixabay', baseUrl: 'https://pixabay.com/api', auth: 'Free API key required', rateLimit: '100 req/min', docsUrl: 'https://pixabay.com/api/docs/' },
  auth: { type: 'query', keyEnvVar: 'PIXABAY_API_KEY', keyDesc: 'Pixabay API key' },
  methods: [
    { name: 'search_images', displayName: 'Search Images', costCents: 2, description: 'Search Pixabay images', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'per_page', type: 'number', required: false, description: 'Results (3-20, default 10)' }] },
    { name: 'search_videos', displayName: 'Search Videos', costCents: 2, description: 'Search Pixabay videos', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'per_page', type: 'number', required: false, description: 'Results (3-20, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-pixabay — Pixabay Images & Videos MCP Server
 *
 * Wraps the Pixabay API with SettleGrid billing.
 * Requires a free Pixabay API key.
 *
 * Methods:
 *   search_images(query, per_page)  — Search images   (2¢)
 *   search_videos(query, per_page)  — Search videos   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PIX_BASE = 'https://pixabay.com/api'
const API_KEY = process.env.PIXABAY_API_KEY || ''

async function pixFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('PIXABAY_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${PIX_BASE}\${path}\${sep}key=\${API_KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Pixabay API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'pixabay',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_images: { costCents: 2, displayName: 'Search Images' },
      search_videos: { costCents: 2, displayName: 'Search Videos' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchImages = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 3), 20)
  const q = encodeURIComponent(args.query)
  const data = await pixFetch<{ totalHits: number; hits: any[] }>(
    \`/?q=\${q}&per_page=\${perPage}&safesearch=true\`
  )
  return {
    query: args.query,
    totalHits: data.totalHits,
    images: data.hits.map((h: any) => ({
      id: h.id,
      tags: h.tags,
      previewUrl: h.previewURL,
      webformatUrl: h.webformatURL,
      largeImageUrl: h.largeImageURL,
      imageWidth: h.imageWidth,
      imageHeight: h.imageHeight,
      views: h.views,
      downloads: h.downloads,
      likes: h.likes,
      user: h.user,
    })),
  }
}, { method: 'search_images' })

const searchVideos = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.per_page ?? 10, 3), 20)
  const q = encodeURIComponent(args.query)
  const data = await pixFetch<{ totalHits: number; hits: any[] }>(
    \`/videos/?q=\${q}&per_page=\${perPage}&safesearch=true\`
  )
  return {
    query: args.query,
    totalHits: data.totalHits,
    videos: data.hits.map((h: any) => ({
      id: h.id,
      tags: h.tags,
      duration: h.duration,
      previewUrl: h.videos?.tiny?.url,
      fullUrl: h.videos?.medium?.url,
      views: h.views,
      downloads: h.downloads,
      likes: h.likes,
      user: h.user,
    })),
  }
}, { method: 'search_videos' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchImages, searchVideos }

console.log('settlegrid-pixabay MCP server ready')
console.log('Methods: search_images, search_videos')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 139. Tenor ──────────────────────────────────────────────────────────────

generateServer({
  slug: 'tenor',
  name: 'Tenor',
  description: 'Search GIFs and stickers from Google Tenor API with SettleGrid billing.',
  keywords: ['content', 'tenor', 'gifs', 'stickers'],
  upstream: { provider: 'Google (Tenor)', baseUrl: 'https://tenor.googleapis.com/v2', auth: 'Free API key required', rateLimit: 'Varies by key', docsUrl: 'https://developers.google.com/tenor/guides/quickstart' },
  auth: { type: 'query', keyEnvVar: 'TENOR_API_KEY', keyDesc: 'Tenor / Google API key' },
  methods: [
    { name: 'search_gifs', displayName: 'Search GIFs', costCents: 2, description: 'Search for GIFs', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_featured', displayName: 'Featured GIFs', costCents: 2, description: 'Get featured/trending GIFs', params: [{ name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-tenor — Tenor GIF Search MCP Server
 *
 * Wraps the Tenor API (Google) with SettleGrid billing.
 * Requires a Tenor API key.
 *
 * Methods:
 *   search_gifs(query, limit)  — Search GIFs       (2¢)
 *   get_featured(limit)        — Featured GIFs     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface FeaturedInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENOR_BASE = 'https://tenor.googleapis.com/v2'
const API_KEY = process.env.TENOR_API_KEY || ''

async function tenorFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('TENOR_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${TENOR_BASE}\${path}\${sep}key=\${API_KEY}&client_key=settlegrid\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Tenor API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatGif(r: any): Record<string, unknown> {
  return {
    id: r.id,
    title: r.title,
    contentDescription: r.content_description,
    url: r.url,
    gifUrl: r.media_formats?.gif?.url,
    tinyGifUrl: r.media_formats?.tinygif?.url,
    previewUrl: r.media_formats?.nanogif?.url,
    created: r.created,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tenor',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_gifs: { costCents: 2, displayName: 'Search GIFs' },
      get_featured: { costCents: 2, displayName: 'Featured GIFs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGifs = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await tenorFetch<{ results: any[] }>(\`/search?q=\${q}&limit=\${limit}\`)
  return {
    query: args.query,
    count: data.results.length,
    gifs: data.results.map(formatGif),
  }
}, { method: 'search_gifs' })

const getFeatured = sg.wrap(async (args: FeaturedInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const data = await tenorFetch<{ results: any[] }>(\`/featured?limit=\${limit}\`)
  return {
    count: data.results.length,
    gifs: data.results.map(formatGif),
  }
}, { method: 'get_featured' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGifs, getFeatured }

console.log('settlegrid-tenor MCP server ready')
console.log('Methods: search_gifs, get_featured')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 140. Quotable ───────────────────────────────────────────────────────────

generateServer({
  slug: 'quotable',
  name: 'Quotable',
  description: 'Get random quotes and search by author or tag with Quotable API via SettleGrid billing.',
  keywords: ['content', 'quotes', 'inspiration'],
  upstream: { provider: 'Quotable', baseUrl: 'https://api.quotable.io', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://github.com/lukePeavey/quotable' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_random_quote', displayName: 'Random Quote', costCents: 1, description: 'Get a random quote', params: [{ name: 'tags', type: 'string', required: false, description: 'Comma-separated tags' }] },
    { name: 'search_quotes', displayName: 'Search Quotes', costCents: 1, description: 'Search quotes by content', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-quotable — Random Quotes MCP Server
 *
 * Wraps the Quotable API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_random_quote(tags)       — Random quote      (1¢)
 *   search_quotes(query, limit)  — Search quotes     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RandomInput {
  tags?: string
}

interface SearchInput {
  query: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const QUOTE_BASE = 'https://api.quotable.io'

async function quoteFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${QUOTE_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Quotable API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'quotable',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random_quote: { costCents: 1, displayName: 'Random Quote' },
      search_quotes: { costCents: 1, displayName: 'Search Quotes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRandomQuote = sg.wrap(async (args: RandomInput) => {
  let url = '/random'
  if (args.tags) url += \`?tags=\${encodeURIComponent(args.tags)}\`
  const data = await quoteFetch<any>(url)
  return {
    id: data._id,
    content: data.content,
    author: data.author,
    tags: data.tags,
    length: data.length,
  }
}, { method: 'get_random_quote' })

const searchQuotes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await quoteFetch<{ count: number; results: any[] }>(
    \`/search/quotes?query=\${q}&limit=\${limit}\`
  )
  return {
    query: args.query,
    count: data.count,
    quotes: data.results.map((q: any) => ({
      id: q._id,
      content: q.content,
      author: q.author,
      tags: q.tags,
    })),
  }
}, { method: 'search_quotes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRandomQuote, searchQuotes }

console.log('settlegrid-quotable MCP server ready')
console.log('Methods: get_random_quote, search_quotes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

console.log('\n=== Maps/Geo (10 servers) ===\n')

// ─── 141. Nominatim ─────────────────────────────────────────────────────────

generateServer({
  slug: 'nominatim',
  name: 'Nominatim',
  description: 'Geocode addresses and reverse-geocode coordinates via OpenStreetMap Nominatim with SettleGrid billing.',
  keywords: ['geo', 'geocoding', 'osm', 'nominatim'],
  upstream: { provider: 'OpenStreetMap', baseUrl: 'https://nominatim.openstreetmap.org', auth: 'None required', rateLimit: '1 req/s', docsUrl: 'https://nominatim.org/release-docs/latest/api/Overview/' },
  auth: { type: 'none' },
  methods: [
    { name: 'geocode', displayName: 'Geocode', costCents: 1, description: 'Geocode an address to coordinates', params: [{ name: 'query', type: 'string', required: true, description: 'Address or place name' }] },
    { name: 'reverse_geocode', displayName: 'Reverse Geocode', costCents: 1, description: 'Reverse geocode coordinates to address', params: [{ name: 'lat', type: 'number', required: true, description: 'Latitude' }, { name: 'lon', type: 'number', required: true, description: 'Longitude' }] },
  ],
  serverTs: `/**
 * settlegrid-nominatim — OpenStreetMap Geocoding MCP Server
 *
 * Wraps the Nominatim API with SettleGrid billing.
 * No API key needed. Max 1 req/s.
 *
 * Methods:
 *   geocode(query)              — Address to coordinates   (1¢)
 *   reverse_geocode(lat, lon)   — Coordinates to address   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  query: string
}

interface ReverseInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NOM_BASE = 'https://nominatim.openstreetmap.org'

async function nomFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${NOM_BASE}\${path}\`, {
    headers: { 'User-Agent': 'settlegrid-nominatim/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Nominatim API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nominatim',
  pricing: {
    defaultCostCents: 1,
    methods: {
      geocode: { costCents: 1, displayName: 'Geocode' },
      reverse_geocode: { costCents: 1, displayName: 'Reverse Geocode' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await nomFetch<any[]>(\`/search?q=\${q}&format=json&limit=5&addressdetails=1\`)
  if (data.length === 0) return { query: args.query, results: [] }
  return {
    query: args.query,
    results: data.map((r: any) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name,
      type: r.type,
      importance: r.importance,
      address: r.address,
    })),
  }
}, { method: 'geocode' })

const reverseGeocode = sg.wrap(async (args: ReverseInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await nomFetch<any>(
    \`/reverse?lat=\${args.lat}&lon=\${args.lon}&format=json&addressdetails=1\`
  )
  return {
    lat: args.lat,
    lon: args.lon,
    displayName: data.display_name,
    address: data.address,
    type: data.type,
  }
}, { method: 'reverse_geocode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, reverseGeocode }

console.log('settlegrid-nominatim MCP server ready')
console.log('Methods: geocode, reverse_geocode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 142. GeoNames ───────────────────────────────────────────────────────────

generateServer({
  slug: 'geonames',
  name: 'GeoNames',
  description: 'Search geographic place names and features from GeoNames with SettleGrid billing.',
  keywords: ['geo', 'places', 'geonames', 'geography'],
  upstream: { provider: 'GeoNames', baseUrl: 'https://api.geonames.org', auth: 'Free username required', rateLimit: '2000 credits/hr', docsUrl: 'https://www.geonames.org/export/web-services.html' },
  auth: { type: 'query', keyEnvVar: 'GEONAMES_USERNAME', keyDesc: 'GeoNames username (free registration)' },
  methods: [
    { name: 'search_places', displayName: 'Search Places', costCents: 1, description: 'Search for geographic places', params: [{ name: 'query', type: 'string', required: true, description: 'Place name to search' }, { name: 'max_rows', type: 'number', required: false, description: 'Max results (1-20, default 10)' }] },
    { name: 'get_nearby', displayName: 'Get Nearby', costCents: 1, description: 'Find nearby places by coordinates', params: [{ name: 'lat', type: 'number', required: true, description: 'Latitude' }, { name: 'lon', type: 'number', required: true, description: 'Longitude' }] },
  ],
  serverTs: `/**
 * settlegrid-geonames — GeoNames Geographic Data MCP Server
 *
 * Wraps the GeoNames API with SettleGrid billing.
 * Requires a free GeoNames username.
 *
 * Methods:
 *   search_places(query, max_rows)  — Search places     (1¢)
 *   get_nearby(lat, lon)            — Nearby places     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  max_rows?: number
}

interface NearbyInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GN_BASE = 'https://api.geonames.org'
const USERNAME = process.env.GEONAMES_USERNAME || ''

async function gnFetch<T>(path: string): Promise<T> {
  if (!USERNAME) throw new Error('GEONAMES_USERNAME environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${GN_BASE}\${path}\${sep}username=\${USERNAME}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`GeoNames API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'geonames',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_places: { costCents: 1, displayName: 'Search Places' },
      get_nearby: { costCents: 1, displayName: 'Get Nearby' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlaces = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const maxRows = Math.min(Math.max(args.max_rows ?? 10, 1), 20)
  const q = encodeURIComponent(args.query)
  const data = await gnFetch<{ totalResultsCount: number; geonames: any[] }>(
    \`/searchJSON?q=\${q}&maxRows=\${maxRows}\`
  )
  return {
    query: args.query,
    totalResults: data.totalResultsCount,
    places: (data.geonames || []).map((g: any) => ({
      geonameId: g.geonameId,
      name: g.name,
      countryName: g.countryName,
      countryCode: g.countryCode,
      lat: parseFloat(g.lat),
      lng: parseFloat(g.lng),
      population: g.population,
      featureClass: g.fcl,
      featureCode: g.fcode,
    })),
  }
}, { method: 'search_places' })

const getNearby = sg.wrap(async (args: NearbyInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await gnFetch<{ geonames: any[] }>(
    \`/findNearbyJSON?lat=\${args.lat}&lng=\${args.lon}&maxRows=10\`
  )
  return {
    lat: args.lat,
    lon: args.lon,
    places: (data.geonames || []).map((g: any) => ({
      geonameId: g.geonameId,
      name: g.name,
      distance: g.distance,
      countryName: g.countryName,
      lat: parseFloat(g.lat),
      lng: parseFloat(g.lng),
    })),
  }
}, { method: 'get_nearby' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlaces, getNearby }

console.log('settlegrid-geonames MCP server ready')
console.log('Methods: search_places, get_nearby')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 143. IPinfo ─────────────────────────────────────────────────────────────

generateServer({
  slug: 'ipinfo',
  name: 'IPinfo',
  description: 'Look up IP address geolocation and network data from IPinfo with SettleGrid billing.',
  keywords: ['geo', 'ip', 'geolocation', 'ipinfo'],
  upstream: { provider: 'IPinfo', baseUrl: 'https://ipinfo.io', auth: 'Free tier (50k/month)', rateLimit: '50,000 req/month', docsUrl: 'https://ipinfo.io/developers' },
  auth: { type: 'header', keyEnvVar: 'IPINFO_TOKEN', keyDesc: 'IPinfo bearer token (optional for basic)' },
  methods: [
    { name: 'lookup_ip', displayName: 'Lookup IP', costCents: 1, description: 'Get geolocation data for an IP', params: [{ name: 'ip', type: 'string', required: true, description: 'IP address (IPv4 or IPv6)' }] },
    { name: 'get_my_ip', displayName: 'Get My IP', costCents: 1, description: 'Get geolocation for current IP', params: [] },
  ],
  serverTs: `/**
 * settlegrid-ipinfo — IP Geolocation MCP Server
 *
 * Wraps the IPinfo API with SettleGrid billing.
 * Optional token for higher limits.
 *
 * Methods:
 *   lookup_ip(ip)    — Geolocate an IP address  (1¢)
 *   get_my_ip()      — Geolocate current IP     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupInput {
  ip: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const IPINFO_BASE = 'https://ipinfo.io'
const TOKEN = process.env.IPINFO_TOKEN || ''

async function ipFetch<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (TOKEN) headers['Authorization'] = \`Bearer \${TOKEN}\`
  const res = await fetch(\`\${IPINFO_BASE}\${path}\`, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`IPinfo API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ipinfo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_ip: { costCents: 1, displayName: 'Lookup IP' },
      get_my_ip: { costCents: 1, displayName: 'Get My IP' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupIp = sg.wrap(async (args: LookupInput) => {
  if (!args.ip || typeof args.ip !== 'string') {
    throw new Error('ip is required (IPv4 or IPv6 address)')
  }
  const ip = args.ip.trim()
  if (!/^[\\d.:a-fA-F]+$/.test(ip)) {
    throw new Error('Invalid IP address format')
  }
  const data = await ipFetch<any>(\`/\${ip}/json\`)
  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country,
    loc: data.loc,
    org: data.org,
    postal: data.postal,
    timezone: data.timezone,
    hostname: data.hostname,
  }
}, { method: 'lookup_ip' })

const getMyIp = sg.wrap(async () => {
  const data = await ipFetch<any>('/json')
  return {
    ip: data.ip,
    city: data.city,
    region: data.region,
    country: data.country,
    loc: data.loc,
    org: data.org,
    timezone: data.timezone,
  }
}, { method: 'get_my_ip' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupIp, getMyIp }

console.log('settlegrid-ipinfo MCP server ready')
console.log('Methods: lookup_ip, get_my_ip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 144. OpenCage ───────────────────────────────────────────────────────────

generateServer({
  slug: 'opencage',
  name: 'OpenCage',
  description: 'Geocode and reverse-geocode with OpenCage worldwide geocoding API with SettleGrid billing.',
  keywords: ['geo', 'geocoding', 'opencage'],
  upstream: { provider: 'OpenCage', baseUrl: 'https://api.opencagedata.com/geocode/v1', auth: 'Free API key required', rateLimit: '2,500 req/day', docsUrl: 'https://opencagedata.com/api' },
  auth: { type: 'query', keyEnvVar: 'OPENCAGE_API_KEY', keyDesc: 'OpenCage API key' },
  methods: [
    { name: 'geocode', displayName: 'Geocode', costCents: 2, description: 'Geocode an address', params: [{ name: 'query', type: 'string', required: true, description: 'Address or place name' }] },
    { name: 'reverse_geocode', displayName: 'Reverse Geocode', costCents: 2, description: 'Reverse geocode coordinates', params: [{ name: 'lat', type: 'number', required: true, description: 'Latitude' }, { name: 'lon', type: 'number', required: true, description: 'Longitude' }] },
  ],
  serverTs: `/**
 * settlegrid-opencage — OpenCage Geocoding MCP Server
 *
 * Wraps the OpenCage Geocoder API with SettleGrid billing.
 * Requires a free OpenCage API key.
 *
 * Methods:
 *   geocode(query)              — Forward geocode    (2¢)
 *   reverse_geocode(lat, lon)   — Reverse geocode    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  query: string
}

interface ReverseInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const OC_BASE = 'https://api.opencagedata.com/geocode/v1'
const API_KEY = process.env.OPENCAGE_API_KEY || ''

async function ocFetch<T>(params: string): Promise<T> {
  if (!API_KEY) throw new Error('OPENCAGE_API_KEY environment variable is required')
  const res = await fetch(\`\${OC_BASE}/json?\${params}&key=\${API_KEY}&no_annotations=0\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenCage API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'opencage',
  pricing: {
    defaultCostCents: 2,
    methods: {
      geocode: { costCents: 2, displayName: 'Geocode' },
      reverse_geocode: { costCents: 2, displayName: 'Reverse Geocode' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await ocFetch<{ total_results: number; results: any[] }>(\`q=\${q}&limit=5\`)
  return {
    query: args.query,
    totalResults: data.total_results,
    results: data.results.map((r: any) => ({
      formatted: r.formatted,
      lat: r.geometry.lat,
      lng: r.geometry.lng,
      confidence: r.confidence,
      components: r.components,
      timezone: r.annotations?.timezone?.name,
      currency: r.annotations?.currency?.name,
    })),
  }
}, { method: 'geocode' })

const reverseGeocode = sg.wrap(async (args: ReverseInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await ocFetch<{ results: any[] }>(\`q=\${args.lat}+\${args.lon}&limit=1\`)
  const r = data.results[0]
  if (!r) throw new Error('No results found for these coordinates')
  return {
    lat: args.lat,
    lon: args.lon,
    formatted: r.formatted,
    components: r.components,
    timezone: r.annotations?.timezone?.name,
    currency: r.annotations?.currency?.name,
  }
}, { method: 'reverse_geocode' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, reverseGeocode }

console.log('settlegrid-opencage MCP server ready')
console.log('Methods: geocode, reverse_geocode')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 145. OpenRouteService ───────────────────────────────────────────────────

generateServer({
  slug: 'openrouteservice',
  name: 'OpenRouteService',
  description: 'Get driving/walking/cycling directions from OpenRouteService with SettleGrid billing.',
  keywords: ['geo', 'routing', 'directions', 'openrouteservice'],
  upstream: { provider: 'OpenRouteService', baseUrl: 'https://api.openrouteservice.org/v2', auth: 'Free API key required', rateLimit: '40 req/min', docsUrl: 'https://openrouteservice.org/dev/#/api-docs' },
  auth: { type: 'header', keyEnvVar: 'ORS_API_KEY', keyDesc: 'OpenRouteService API key' },
  methods: [
    { name: 'get_directions', displayName: 'Get Directions', costCents: 2, description: 'Get route between two points', params: [{ name: 'start_lon', type: 'number', required: true, description: 'Start longitude' }, { name: 'start_lat', type: 'number', required: true, description: 'Start latitude' }, { name: 'end_lon', type: 'number', required: true, description: 'End longitude' }, { name: 'end_lat', type: 'number', required: true, description: 'End latitude' }, { name: 'profile', type: 'string', required: false, description: 'driving-car, cycling-regular, or foot-walking (default driving-car)' }] },
    { name: 'geocode_search', displayName: 'Geocode Search', costCents: 2, description: 'Search for places by name', params: [{ name: 'query', type: 'string', required: true, description: 'Place name to search' }] },
  ],
  serverTs: `/**
 * settlegrid-openrouteservice — Routing & Directions MCP Server
 *
 * Wraps the OpenRouteService API with SettleGrid billing.
 * Requires a free ORS API key.
 *
 * Methods:
 *   get_directions(start, end, profile)  — Route directions   (2¢)
 *   geocode_search(query)                — Geocode search     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DirectionsInput {
  start_lon: number
  start_lat: number
  end_lon: number
  end_lat: number
  profile?: string
}

interface GeocodeInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ORS_BASE = 'https://api.openrouteservice.org'
const API_KEY = process.env.ORS_API_KEY || ''
const VALID_PROFILES = new Set(['driving-car', 'cycling-regular', 'foot-walking'])

async function orsFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_KEY) throw new Error('ORS_API_KEY environment variable is required')
  const res = await fetch(\`\${ORS_BASE}\${path}\`, {
    ...options,
    headers: {
      Authorization: API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ORS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'openrouteservice',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_directions: { costCents: 2, displayName: 'Get Directions' },
      geocode_search: { costCents: 2, displayName: 'Geocode Search' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDirections = sg.wrap(async (args: DirectionsInput) => {
  if (typeof args.start_lon !== 'number' || typeof args.start_lat !== 'number' ||
      typeof args.end_lon !== 'number' || typeof args.end_lat !== 'number') {
    throw new Error('start_lon, start_lat, end_lon, end_lat are all required numbers')
  }
  const profile = args.profile && VALID_PROFILES.has(args.profile) ? args.profile : 'driving-car'
  const data = await orsFetch<any>(\`/v2/directions/\${profile}/geojson\`, {
    method: 'POST',
    body: JSON.stringify({
      coordinates: [[args.start_lon, args.start_lat], [args.end_lon, args.end_lat]],
    }),
  })
  const route = data.features?.[0]?.properties?.summary
  return {
    profile,
    distance: route?.distance,
    distanceKm: route?.distance ? (route.distance / 1000).toFixed(2) : null,
    duration: route?.duration,
    durationMin: route?.duration ? (route.duration / 60).toFixed(1) : null,
    steps: data.features?.[0]?.properties?.segments?.[0]?.steps?.map((s: any) => ({
      instruction: s.instruction,
      distance: s.distance,
      duration: s.duration,
    })) || [],
  }
}, { method: 'get_directions' })

const geocodeSearch = sg.wrap(async (args: GeocodeInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query)
  const data = await orsFetch<{ features: any[] }>(
    \`/geocode/search?text=\${q}&size=5\`
  )
  return {
    query: args.query,
    results: (data.features || []).map((f: any) => ({
      name: f.properties?.name,
      label: f.properties?.label,
      country: f.properties?.country,
      region: f.properties?.region,
      lat: f.geometry?.coordinates?.[1],
      lon: f.geometry?.coordinates?.[0],
      confidence: f.properties?.confidence,
    })),
  }
}, { method: 'geocode_search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDirections, geocodeSearch }

console.log('settlegrid-openrouteservice MCP server ready')
console.log('Methods: get_directions, geocode_search')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 146. what3words ─────────────────────────────────────────────────────────

generateServer({
  slug: 'what3words',
  name: 'what3words',
  description: 'Convert between 3-word addresses and coordinates via what3words API with SettleGrid billing.',
  keywords: ['geo', 'what3words', 'addressing', 'location'],
  upstream: { provider: 'what3words', baseUrl: 'https://api.what3words.com/v3', auth: 'Free API key required', rateLimit: 'Varies by plan', docsUrl: 'https://developer.what3words.com/public-api' },
  auth: { type: 'query', keyEnvVar: 'W3W_API_KEY', keyDesc: 'what3words API key' },
  methods: [
    { name: 'convert_to_coordinates', displayName: 'Words to Coordinates', costCents: 2, description: 'Convert 3-word address to coordinates', params: [{ name: 'words', type: 'string', required: true, description: '3-word address (e.g. "filled.count.soap")' }] },
    { name: 'convert_to_words', displayName: 'Coordinates to Words', costCents: 2, description: 'Convert coordinates to 3-word address', params: [{ name: 'lat', type: 'number', required: true, description: 'Latitude' }, { name: 'lon', type: 'number', required: true, description: 'Longitude' }] },
  ],
  serverTs: `/**
 * settlegrid-what3words — what3words Address MCP Server
 *
 * Wraps the what3words API with SettleGrid billing.
 * Requires a what3words API key.
 *
 * Methods:
 *   convert_to_coordinates(words)   — Words to lat/lng    (2¢)
 *   convert_to_words(lat, lon)      — Lat/lng to words    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WordsInput {
  words: string
}

interface CoordsInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const W3W_BASE = 'https://api.what3words.com/v3'
const API_KEY = process.env.W3W_API_KEY || ''

async function w3wFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('W3W_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${W3W_BASE}\${path}\${sep}key=\${API_KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`what3words API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'what3words',
  pricing: {
    defaultCostCents: 2,
    methods: {
      convert_to_coordinates: { costCents: 2, displayName: 'Words to Coordinates' },
      convert_to_words: { costCents: 2, displayName: 'Coordinates to Words' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const convertToCoordinates = sg.wrap(async (args: WordsInput) => {
  if (!args.words || typeof args.words !== 'string') {
    throw new Error('words is required (e.g. "filled.count.soap")')
  }
  const words = args.words.trim()
  if (!/^[a-zA-Z]+\\.[a-zA-Z]+\\.[a-zA-Z]+$/.test(words)) {
    throw new Error('words must be a valid 3-word address (e.g. "filled.count.soap")')
  }
  const data = await w3wFetch<any>(\`/convert-to-coordinates?words=\${encodeURIComponent(words)}\`)
  return {
    words: data.words,
    lat: data.coordinates?.lat,
    lng: data.coordinates?.lng,
    country: data.country,
    nearestPlace: data.nearestPlace,
    language: data.language,
  }
}, { method: 'convert_to_coordinates' })

const convertToWords = sg.wrap(async (args: CoordsInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await w3wFetch<any>(\`/convert-to-3wa?coordinates=\${args.lat},\${args.lon}\`)
  return {
    words: data.words,
    lat: data.coordinates?.lat,
    lng: data.coordinates?.lng,
    country: data.country,
    nearestPlace: data.nearestPlace,
    language: data.language,
  }
}, { method: 'convert_to_words' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { convertToCoordinates, convertToWords }

console.log('settlegrid-what3words MCP server ready')
console.log('Methods: convert_to_coordinates, convert_to_words')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 147. ZipCodeAPI ─────────────────────────────────────────────────────────

generateServer({
  slug: 'zipcodeapi',
  name: 'ZipCodeAPI',
  description: 'Look up US ZIP code data, distances, and nearby codes via ZipCodeAPI with SettleGrid billing.',
  keywords: ['geo', 'zipcode', 'us', 'postal'],
  upstream: { provider: 'ZipCodeAPI', baseUrl: 'https://www.zipcodeapi.com/rest', auth: 'Free API key required', rateLimit: '10 req/hr (free)', docsUrl: 'https://www.zipcodeapi.com/API' },
  auth: { type: 'path', keyEnvVar: 'ZIPCODE_API_KEY', keyDesc: 'ZipCodeAPI API key' },
  methods: [
    { name: 'get_zip_info', displayName: 'ZIP Info', costCents: 2, description: 'Get info for a US ZIP code', params: [{ name: 'zip', type: 'string', required: true, description: '5-digit US ZIP code' }] },
    { name: 'get_distance', displayName: 'ZIP Distance', costCents: 2, description: 'Get distance between two ZIP codes', params: [{ name: 'zip1', type: 'string', required: true, description: 'First ZIP code' }, { name: 'zip2', type: 'string', required: true, description: 'Second ZIP code' }] },
  ],
  serverTs: `/**
 * settlegrid-zipcodeapi — US ZIP Code Data MCP Server
 *
 * Wraps the ZipCodeAPI with SettleGrid billing.
 * Requires a ZipCodeAPI key.
 *
 * Methods:
 *   get_zip_info(zip)          — ZIP code info       (2¢)
 *   get_distance(zip1, zip2)   — Distance between    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZipInput {
  zip: string
}

interface DistanceInput {
  zip1: string
  zip2: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ZIP_BASE = 'https://www.zipcodeapi.com/rest'
const API_KEY = process.env.ZIPCODE_API_KEY || ''

function validateZip(zip: string, field: string): string {
  const z = zip.trim()
  if (!/^\\d{5}$/.test(z)) {
    throw new Error(\`\${field} must be a 5-digit US ZIP code\`)
  }
  return z
}

async function zipFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('ZIPCODE_API_KEY environment variable is required')
  const res = await fetch(\`\${ZIP_BASE}/\${API_KEY}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ZipCodeAPI \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'zipcodeapi',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_zip_info: { costCents: 2, displayName: 'ZIP Info' },
      get_distance: { costCents: 2, displayName: 'ZIP Distance' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getZipInfo = sg.wrap(async (args: ZipInput) => {
  const zip = validateZip(args.zip, 'zip')
  const data = await zipFetch<any>(\`/info.json/\${zip}/degrees\`)
  return {
    zipCode: data.zip_code,
    lat: data.lat,
    lng: data.lng,
    city: data.city,
    state: data.state,
    timezone: data.timezone?.timezone_identifier,
    acceptable: data.acceptable_city_names || [],
  }
}, { method: 'get_zip_info' })

const getDistance = sg.wrap(async (args: DistanceInput) => {
  const z1 = validateZip(args.zip1, 'zip1')
  const z2 = validateZip(args.zip2, 'zip2')
  const data = await zipFetch<any>(\`/distance.json/\${z1}/\${z2}/mile\`)
  return {
    zip1: z1,
    zip2: z2,
    distanceMiles: data.distance,
    distanceKm: data.distance ? (data.distance * 1.60934).toFixed(2) : null,
  }
}, { method: 'get_distance' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getZipInfo, getDistance }

console.log('settlegrid-zipcodeapi MCP server ready')
console.log('Methods: get_zip_info, get_distance')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 148. TimezoneDB ─────────────────────────────────────────────────────────

generateServer({
  slug: 'timezone-db',
  name: 'TimezoneDB',
  description: 'Get timezone data by coordinates or zone name from TimezoneDB with SettleGrid billing.',
  keywords: ['geo', 'timezone', 'time'],
  upstream: { provider: 'TimezoneDB', baseUrl: 'https://api.timezonedb.com/v2.1', auth: 'Free API key required', rateLimit: '1 req/s', docsUrl: 'https://timezonedb.com/api' },
  auth: { type: 'query', keyEnvVar: 'TIMEZONEDB_API_KEY', keyDesc: 'TimezoneDB API key' },
  methods: [
    { name: 'get_timezone_by_position', displayName: 'Timezone by Position', costCents: 1, description: 'Get timezone for coordinates', params: [{ name: 'lat', type: 'number', required: true, description: 'Latitude' }, { name: 'lon', type: 'number', required: true, description: 'Longitude' }] },
    { name: 'get_timezone_by_zone', displayName: 'Timezone by Zone', costCents: 1, description: 'Get timezone details by zone name', params: [{ name: 'zone', type: 'string', required: true, description: 'Timezone name (e.g. "America/New_York")' }] },
  ],
  serverTs: `/**
 * settlegrid-timezone-db — TimezoneDB MCP Server
 *
 * Wraps the TimezoneDB API with SettleGrid billing.
 * Requires a free TimezoneDB API key.
 *
 * Methods:
 *   get_timezone_by_position(lat, lon)  — Timezone by coords   (1¢)
 *   get_timezone_by_zone(zone)          — Timezone by name     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PositionInput {
  lat: number
  lon: number
}

interface ZoneInput {
  zone: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TZ_BASE = 'https://api.timezonedb.com/v2.1'
const API_KEY = process.env.TIMEZONEDB_API_KEY || ''

async function tzFetch<T>(params: string): Promise<T> {
  if (!API_KEY) throw new Error('TIMEZONEDB_API_KEY environment variable is required')
  const res = await fetch(\`\${TZ_BASE}/get-time-zone?key=\${API_KEY}&format=json&\${params}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`TimezoneDB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json() as any
  if (data.status === 'FAILED') throw new Error(\`TimezoneDB: \${data.message}\`)
  return data as T
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'timezone-db',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_timezone_by_position: { costCents: 1, displayName: 'Timezone by Position' },
      get_timezone_by_zone: { costCents: 1, displayName: 'Timezone by Zone' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTimezoneByPosition = sg.wrap(async (args: PositionInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const data = await tzFetch<any>(\`by=position&lat=\${args.lat}&lng=\${args.lon}\`)
  return {
    zoneName: data.zoneName,
    abbreviation: data.abbreviation,
    gmtOffset: data.gmtOffset,
    dst: data.dst,
    timestamp: data.timestamp,
    formatted: data.formatted,
    countryCode: data.countryCode,
    countryName: data.countryName,
  }
}, { method: 'get_timezone_by_position' })

const getTimezoneByZone = sg.wrap(async (args: ZoneInput) => {
  if (!args.zone || typeof args.zone !== 'string') {
    throw new Error('zone is required (e.g. "America/New_York")')
  }
  const z = encodeURIComponent(args.zone.trim())
  const data = await tzFetch<any>(\`by=zone&zone=\${z}\`)
  return {
    zoneName: data.zoneName,
    abbreviation: data.abbreviation,
    gmtOffset: data.gmtOffset,
    dst: data.dst,
    timestamp: data.timestamp,
    formatted: data.formatted,
    countryCode: data.countryCode,
    countryName: data.countryName,
  }
}, { method: 'get_timezone_by_zone' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTimezoneByPosition, getTimezoneByZone }

console.log('settlegrid-timezone-db MCP server ready')
console.log('Methods: get_timezone_by_position, get_timezone_by_zone')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 149. Sunrise-Sunset ─────────────────────────────────────────────────────

generateServer({
  slug: 'sunrise-sunset',
  name: 'Sunrise-Sunset',
  description: 'Get sunrise, sunset, and solar times for any location with SettleGrid billing.',
  keywords: ['geo', 'sun', 'sunrise', 'sunset'],
  upstream: { provider: 'Sunrise-Sunset.org', baseUrl: 'https://api.sunrise-sunset.org/json', auth: 'None required', rateLimit: 'Reasonable use', docsUrl: 'https://sunrise-sunset.org/api' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_sun_times', displayName: 'Sun Times', costCents: 1, description: 'Get sunrise/sunset for coordinates', params: [{ name: 'lat', type: 'number', required: true, description: 'Latitude' }, { name: 'lon', type: 'number', required: true, description: 'Longitude' }, { name: 'date', type: 'string', required: false, description: 'Date (YYYY-MM-DD, default today)' }] },
  ],
  serverTs: `/**
 * settlegrid-sunrise-sunset — Sunrise/Sunset Times MCP Server
 *
 * Wraps the Sunrise-Sunset API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_sun_times(lat, lon, date)  — Sun times for location  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SunTimesInput {
  lat: number
  lon: number
  date?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SUN_BASE = 'https://api.sunrise-sunset.org/json'

async function sunFetch<T>(params: string): Promise<T> {
  const res = await fetch(\`\${SUN_BASE}?\${params}&formatted=0\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Sunrise-Sunset API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json() as any
  if (data.status !== 'OK') throw new Error(\`Sunrise-Sunset: \${data.status}\`)
  return data as T
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sunrise-sunset',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_sun_times: { costCents: 1, displayName: 'Sun Times' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSunTimes = sg.wrap(async (args: SunTimesInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  let params = \`lat=\${args.lat}&lng=\${args.lon}\`
  if (args.date) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) {
      throw new Error('date must be YYYY-MM-DD format')
    }
    params += \`&date=\${args.date}\`
  }
  const data = await sunFetch<{ results: any }>(params)
  const r = data.results
  return {
    lat: args.lat,
    lon: args.lon,
    date: args.date || 'today',
    sunrise: r.sunrise,
    sunset: r.sunset,
    solarNoon: r.solar_noon,
    dayLength: r.day_length,
    civilTwilightBegin: r.civil_twilight_begin,
    civilTwilightEnd: r.civil_twilight_end,
    nauticalTwilightBegin: r.nautical_twilight_begin,
    nauticalTwilightEnd: r.nautical_twilight_end,
    astronomicalTwilightBegin: r.astronomical_twilight_begin,
    astronomicalTwilightEnd: r.astronomical_twilight_end,
  }
}, { method: 'get_sun_times' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSunTimes }

console.log('settlegrid-sunrise-sunset MCP server ready')
console.log('Methods: get_sun_times')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 150. Geoapify ───────────────────────────────────────────────────────────

generateServer({
  slug: 'geoapify',
  name: 'Geoapify',
  description: 'Geocode addresses and search for places with Geoapify API with SettleGrid billing.',
  keywords: ['geo', 'geocoding', 'places', 'geoapify'],
  upstream: { provider: 'Geoapify', baseUrl: 'https://api.geoapify.com/v1', auth: 'Free API key required', rateLimit: '3000 req/day', docsUrl: 'https://apidocs.geoapify.com/' },
  auth: { type: 'query', keyEnvVar: 'GEOAPIFY_API_KEY', keyDesc: 'Geoapify API key' },
  methods: [
    { name: 'geocode', displayName: 'Geocode', costCents: 2, description: 'Geocode an address', params: [{ name: 'text', type: 'string', required: true, description: 'Address or place name' }] },
    { name: 'search_places', displayName: 'Search Places', costCents: 2, description: 'Search for places of interest', params: [{ name: 'categories', type: 'string', required: true, description: 'Place category (e.g. "catering.restaurant")' }, { name: 'lat', type: 'number', required: true, description: 'Center latitude' }, { name: 'lon', type: 'number', required: true, description: 'Center longitude' }] },
  ],
  serverTs: `/**
 * settlegrid-geoapify — Geoapify Geocoding & Places MCP Server
 *
 * Wraps the Geoapify API with SettleGrid billing.
 * Requires a free Geoapify API key.
 *
 * Methods:
 *   geocode(text)                         — Forward geocode    (2¢)
 *   search_places(categories, lat, lon)   — Search POIs        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeocodeInput {
  text: string
}

interface PlacesInput {
  categories: string
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const GEO_BASE = 'https://api.geoapify.com/v1'
const API_KEY = process.env.GEOAPIFY_API_KEY || ''

async function geoFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('GEOAPIFY_API_KEY environment variable is required')
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${GEO_BASE}\${path}\${sep}apiKey=\${API_KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Geoapify API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'geoapify',
  pricing: {
    defaultCostCents: 2,
    methods: {
      geocode: { costCents: 2, displayName: 'Geocode' },
      search_places: { costCents: 2, displayName: 'Search Places' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const geocode = sg.wrap(async (args: GeocodeInput) => {
  if (!args.text || typeof args.text !== 'string') {
    throw new Error('text is required')
  }
  const t = encodeURIComponent(args.text)
  const data = await geoFetch<{ features: any[] }>(\`/geocode/search?text=\${t}&limit=5\`)
  return {
    query: args.text,
    results: (data.features || []).map((f: any) => ({
      formatted: f.properties?.formatted,
      lat: f.properties?.lat,
      lon: f.properties?.lon,
      country: f.properties?.country,
      city: f.properties?.city,
      state: f.properties?.state,
      postcode: f.properties?.postcode,
      resultType: f.properties?.result_type,
    })),
  }
}, { method: 'geocode' })

const searchPlaces = sg.wrap(async (args: PlacesInput) => {
  if (!args.categories || typeof args.categories !== 'string') {
    throw new Error('categories is required (e.g. "catering.restaurant")')
  }
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon must be numbers')
  }
  if (args.lat < -90 || args.lat > 90 || args.lon < -180 || args.lon > 180) {
    throw new Error('lat must be -90..90, lon must be -180..180')
  }
  const cats = encodeURIComponent(args.categories)
  const data = await geoFetch<{ features: any[] }>(
    \`/places?categories=\${cats}&filter=circle:\${args.lon},\${args.lat},5000&limit=20\`
  )
  return {
    categories: args.categories,
    center: { lat: args.lat, lon: args.lon },
    places: (data.features || []).map((f: any) => ({
      name: f.properties?.name,
      categories: f.properties?.categories,
      lat: f.properties?.lat,
      lon: f.properties?.lon,
      address: f.properties?.formatted,
      distance: f.properties?.distance,
    })),
  }
}, { method: 'search_places' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { geocode, searchPlaces }

console.log('settlegrid-geoapify MCP server ready')
console.log('Methods: geocode, search_places')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

console.log('\n=== Generation Complete ===')
console.log('Total: 40 servers (15 Science + 15 Social + 10 Maps/Geo)')
