/**
 * settlegrid-drugbank — FDA Drug Information MCP Server
 * Wraps openFDA Drug API with SettleGrid billing.
 * Methods:
 *   search_drugs(query, limit?)    — Search drugs (1¢)
 *   get_drug(id)                   — Get drug label (1¢)
 *   get_interactions(drug_name)    — Get adverse events (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface DrugIdInput {
  id: string
}

interface InteractionInput {
  drug_name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.fda.gov/drug'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-drugbank/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FDA API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'drugbank',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_drugs: { costCents: 1, displayName: 'Search drugs' },
      get_drug: { costCents: 1, displayName: 'Get drug label' },
      get_interactions: { costCents: 2, displayName: 'Get adverse events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDrugs = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('label.json', {
    search: `openfda.brand_name:"${args.query}"+openfda.generic_name:"${args.query}"`,
    limit: String(limit),
  })
}, { method: 'search_drugs' })

const getDrug = sg.wrap(async (args: DrugIdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>('label.json', {
    search: `openfda.application_number:"${args.id}"+openfda.brand_name:"${args.id}"`,
    limit: '1',
  })
}, { method: 'get_drug' })

const getInteractions = sg.wrap(async (args: InteractionInput) => {
  if (!args.drug_name || typeof args.drug_name !== 'string') {
    throw new Error('drug_name is required')
  }
  return apiFetch<unknown>('event.json', {
    search: `patient.drug.medicinalproduct:"${args.drug_name}"`,
    limit: '10',
  })
}, { method: 'get_interactions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDrugs, getDrug, getInteractions }

console.log('settlegrid-drugbank MCP server ready')
console.log('Methods: search_drugs, get_drug, get_interactions')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
