/**
 * settlegrid-genbank — GenBank Genomic Sequences MCP Server
 * Wraps NCBI E-utilities with SettleGrid billing.
 * Methods:
 *   search_sequences(query, limit?) — Search nucleotide sequences (1¢)
 *   get_sequence(id)                — Get FASTA sequence (2¢)
 *   get_summary(id)                 — Get sequence summary (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface IdInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('retmode', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-genbank/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NCBI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

async function apiFetchText(path: string, params?: Record<string, string>): Promise<string> {
  const url = new URL(`${API_BASE}/${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-genbank/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NCBI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'genbank',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_sequences: { costCents: 1, displayName: 'Search nucleotide sequences' },
      get_sequence: { costCents: 2, displayName: 'Get FASTA sequence' },
      get_summary: { costCents: 1, displayName: 'Get sequence summary' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSequences = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('esearch.fcgi', {
    db: 'nucleotide',
    term: args.query,
    retmax: String(limit),
  })
}, { method: 'search_sequences' })

const getSequence = sg.wrap(async (args: IdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (GenBank accession or GI number)')
  }
  return apiFetchText('efetch.fcgi', {
    db: 'nucleotide',
    id: args.id,
    rettype: 'fasta',
    retmode: 'text',
  })
}, { method: 'get_sequence' })

const getSummary = sg.wrap(async (args: IdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>('esummary.fcgi', {
    db: 'nucleotide',
    id: args.id,
  })
}, { method: 'get_summary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSequences, getSequence, getSummary }

console.log('settlegrid-genbank MCP server ready')
console.log('Methods: search_sequences, get_sequence, get_summary')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
