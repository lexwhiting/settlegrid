/**
 * settlegrid-ncbi-gene — NCBI Gene Information MCP Server
 * Wraps NCBI E-utilities (Gene db) with SettleGrid billing.
 * Methods:
 *   search_genes(query, limit?) — Search genes (1¢)
 *   get_gene(id)                — Get gene details (1¢)
 *   get_gene_summary(id)        — Get gene summary (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface GeneIdInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

async function apiFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('retmode', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-ncbi-gene/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NCBI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ncbi-gene',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_genes: { costCents: 1, displayName: 'Search genes' },
      get_gene: { costCents: 1, displayName: 'Get gene details' },
      get_gene_summary: { costCents: 2, displayName: 'Get gene summary' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGenes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('esearch.fcgi', {
    db: 'gene',
    term: args.query,
    retmax: String(limit),
  })
}, { method: 'search_genes' })

const getGene = sg.wrap(async (args: GeneIdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (NCBI Gene ID)')
  }
  return apiFetch<unknown>('esummary.fcgi', {
    db: 'gene',
    id: args.id,
  })
}, { method: 'get_gene' })

const getGeneSummary = sg.wrap(async (args: GeneIdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  const search = await apiFetch<unknown>('esummary.fcgi', {
    db: 'gene',
    id: args.id,
  })
  const links = await apiFetch<unknown>('elink.fcgi', {
    dbfrom: 'gene',
    db: 'pubmed',
    id: args.id,
    retmax: '5',
  })
  return { summary: search, relatedPubmed: links }
}, { method: 'get_gene_summary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGenes, getGene, getGeneSummary }

console.log('settlegrid-ncbi-gene MCP server ready')
console.log('Methods: search_genes, get_gene, get_gene_summary')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
