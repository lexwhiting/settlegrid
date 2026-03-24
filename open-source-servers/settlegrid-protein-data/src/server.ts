/**
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
    throw new Error(`RCSB PDB API ${res.status}: ${body.slice(0, 200)}`)
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
  const data = await pdbFetch<any>(`${PDB_DATA}/core/entry/${id}`)
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
