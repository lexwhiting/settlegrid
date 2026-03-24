/**
 * settlegrid-covid-genome — COVID Genomic Data MCP Server
 * Wraps CoV-Spectrum LAPIS API with SettleGrid billing.
 * Methods:
 *   get_mutations(country?, lineage?)  — Get mutations (2¢)
 *   get_sequences(lineage, limit?)     — Get sequences (2¢)
 *   get_prevalence(country, lineage?)  — Get prevalence (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MutationInput {
  country?: string
  lineage?: string
}

interface SequenceInput {
  lineage: string
  limit?: number
}

interface PrevalenceInput {
  country: string
  lineage?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://lapis.cov-spectrum.org/open/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-covid-genome/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`LAPIS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'covid-genome',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_mutations: { costCents: 2, displayName: 'Get mutation data' },
      get_sequences: { costCents: 2, displayName: 'Get sequences' },
      get_prevalence: { costCents: 1, displayName: 'Get variant prevalence' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMutations = sg.wrap(async (args: MutationInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  if (args.lineage) params.pangoLineage = args.lineage
  return apiFetch<unknown>('sample/nuc-mutations', params)
}, { method: 'get_mutations' })

const getSequences = sg.wrap(async (args: SequenceInput) => {
  if (!args.lineage || typeof args.lineage !== 'string') {
    throw new Error('lineage is required (e.g. BA.2)')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('sample/details', {
    pangoLineage: args.lineage,
    limit: String(limit),
  })
}, { method: 'get_sequences' })

const getPrevalence = sg.wrap(async (args: PrevalenceInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  const params: Record<string, string> = { country: args.country }
  if (args.lineage) params.pangoLineage = args.lineage
  return apiFetch<unknown>('sample/aggregated', params)
}, { method: 'get_prevalence' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMutations, getSequences, getPrevalence }

console.log('settlegrid-covid-genome MCP server ready')
console.log('Methods: get_mutations, get_sequences, get_prevalence')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
