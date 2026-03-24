/**
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
  return API_KEY ? `&api_key=${API_KEY}` : ''
}

async function ncbiFetch(path: string): Promise<string> {
  const res = await fetch(`${EUTILS_BASE}${path}${keyParam()}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NCBI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

function extractTag(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's').exec(xml)
  return m ? m[1].trim() : ''
}

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'gs')
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
  const searchXml = await ncbiFetch(`/esearch.fcgi?db=pubmed&term=${q}&retmax=${max}&retmode=xml`)
  const ids = extractAllTags(searchXml, 'Id')
  if (ids.length === 0) return { query: args.query, count: 0, articles: [] }

  const summaryXml = await ncbiFetch(`/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`)
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
  if (!/^\d+$/.test(args.pmid.trim())) {
    throw new Error('pmid must be a numeric PubMed ID')
  }
  const xml = await ncbiFetch(`/efetch.fcgi?db=pubmed&id=${args.pmid.trim()}&retmode=xml`)
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
