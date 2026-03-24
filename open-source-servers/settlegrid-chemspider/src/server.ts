/**
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
  const res = await fetch(`${RSC_BASE}${path}`, {
    ...options,
    headers: {
      apikey: API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ChemSpider API ${res.status}: ${body.slice(0, 200)}`)
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
    `/filter/${data.queryId}/results?start=0&count=10`
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
  const data = await rscFetch<any>(`/records/${args.csid}/details?fields=SMILES,Formula,CommonName,MolecularWeight,MonoisotopicMass`)
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
