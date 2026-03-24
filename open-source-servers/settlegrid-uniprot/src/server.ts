/**
 * settlegrid-uniprot — UniProt Protein Data MCP Server
 * Wraps UniProt REST API with SettleGrid billing.
 * Methods:
 *   search_proteins(query, limit?) — Search proteins (1¢)
 *   get_protein(accession)         — Get protein entry (1¢)
 *   get_features(accession)        — Get features (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface AccessionInput {
  accession: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://rest.uniprot.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-uniprot/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`UniProt API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uniprot',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_proteins: { costCents: 1, displayName: 'Search protein entries' },
      get_protein: { costCents: 1, displayName: 'Get protein entry' },
      get_features: { costCents: 2, displayName: 'Get protein features' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchProteins = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>(`/uniprotkb/search?query=${encodeURIComponent(args.query)}&size=${limit}&format=json`)
}, { method: 'search_proteins' })

const getProtein = sg.wrap(async (args: AccessionInput) => {
  if (!args.accession || typeof args.accession !== 'string') {
    throw new Error('accession is required (e.g. P04637)')
  }
  return apiFetch<unknown>(`/uniprotkb/${encodeURIComponent(args.accession)}.json`)
}, { method: 'get_protein' })

const getFeatures = sg.wrap(async (args: AccessionInput) => {
  if (!args.accession || typeof args.accession !== 'string') {
    throw new Error('accession is required')
  }
  return apiFetch<unknown>(`/uniprotkb/${encodeURIComponent(args.accession)}.json`)
}, { method: 'get_features' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchProteins, getProtein, getFeatures }

console.log('settlegrid-uniprot MCP server ready')
console.log('Methods: search_proteins, get_protein, get_features')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
