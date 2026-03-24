/**
 * settlegrid-marine-biology — Marine Species Data MCP Server
 * Wraps WoRMS REST API with SettleGrid billing.
 * Methods:
 *   search_species(query, limit?) — Search marine species (1¢)
 *   get_species(aphiaId)          — Get species details (1¢)
 *   get_classification(aphiaId)   — Get classification (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface AphiaInput {
  aphiaId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.marinespecies.org/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-marine-biology/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`WoRMS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'marine-biology',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_species: { costCents: 1, displayName: 'Search marine species' },
      get_species: { costCents: 1, displayName: 'Get species details' },
      get_classification: { costCents: 2, displayName: 'Get classification' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>(`/AphiaRecordsByVernacular/${encodeURIComponent(args.query)}?like=true&offset=1&limit=${limit}`)
}, { method: 'search_species' })

const getSpecies = sg.wrap(async (args: AphiaInput) => {
  if (!args.aphiaId || typeof args.aphiaId !== 'string') {
    throw new Error('aphiaId is required')
  }
  return apiFetch<unknown>(`/AphiaRecordByAphiaID/${encodeURIComponent(args.aphiaId)}`)
}, { method: 'get_species' })

const getClassification = sg.wrap(async (args: AphiaInput) => {
  if (!args.aphiaId || typeof args.aphiaId !== 'string') {
    throw new Error('aphiaId is required')
  }
  return apiFetch<unknown>(`/AphiaClassificationByAphiaID/${encodeURIComponent(args.aphiaId)}`)
}, { method: 'get_classification' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getSpecies, getClassification }

console.log('settlegrid-marine-biology MCP server ready')
console.log('Methods: search_species, get_species, get_classification')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
