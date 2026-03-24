/**
 * settlegrid-ensembl — Ensembl Genome Browser MCP Server
 * Wraps Ensembl REST API with SettleGrid billing.
 * Methods:
 *   lookup_gene(symbol, species?) — Look up gene (1¢)
 *   get_sequence(id)              — Get sequence (2¢)
 *   search(query, species?)       — Search Ensembl (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupInput {
  symbol: string
  species?: string
}

interface SequenceInput {
  id: string
}

interface SearchInput {
  query: string
  species?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://rest.ensembl.org'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'settlegrid-ensembl/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ensembl API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ensembl',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_gene: { costCents: 1, displayName: 'Look up gene by symbol' },
      get_sequence: { costCents: 2, displayName: 'Get sequence by ID' },
      search: { costCents: 1, displayName: 'Search Ensembl' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupGene = sg.wrap(async (args: LookupInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. BRCA2)')
  }
  const species = args.species || 'homo_sapiens'
  return apiFetch<unknown>(`/lookup/symbol/${encodeURIComponent(species)}/${encodeURIComponent(args.symbol)}`)
}, { method: 'lookup_gene' })

const getSequence = sg.wrap(async (args: SequenceInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Ensembl stable ID)')
  }
  return apiFetch<unknown>(`/sequence/id/${encodeURIComponent(args.id)}?type=genomic`)
}, { method: 'get_sequence' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const species = args.species || 'homo_sapiens'
  return apiFetch<unknown>(`/xrefs/symbol/${encodeURIComponent(species)}/${encodeURIComponent(args.query)}`)
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupGene, getSequence, search }

console.log('settlegrid-ensembl MCP server ready')
console.log('Methods: lookup_gene, get_sequence, search')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
