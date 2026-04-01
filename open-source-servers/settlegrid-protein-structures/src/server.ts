/**
 * settlegrid-protein-structures — Protein Structure Data MCP Server
 *
 * Protein Structure Data tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetProteinInput { pdb_id: string }
interface SearchInput { query: string; limit?: number }

const sg = settlegrid.init({ toolSlug: 'protein-structures', pricing: { defaultCostCents: 2, methods: {
  get_structure: { costCents: 2, displayName: 'Get Protein Structure' },
  search_structures: { costCents: 2, displayName: 'Search Structures' },
  get_amino_acid: { costCents: 1, displayName: 'Get Amino Acid' },
}}})

const getStructure = sg.wrap(async (args: GetProteinInput) => {
  if (!args.pdb_id) throw new Error('pdb_id required (e.g. "1CRN", "4HHB")')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${args.pdb_id.toUpperCase()}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`PDB API ${res.status}`)
    const data = await res.json() as Record<string, unknown>
    const struct = data.struct as Record<string, string> | undefined
    const info = data.rcsb_entry_info as Record<string, unknown> | undefined
    return { pdb_id: args.pdb_id.toUpperCase(), title: struct?.title ?? 'Unknown', method: (info?.experimental_method as string) ?? 'Unknown', resolution_angstrom: (info?.resolution_combined as number[]) ?? [], polymer_entity_count: info?.polymer_entity_count ?? 0, deposit_date: (data.rcsb_accession_info as Record<string, string>)?.deposit_date ?? null }
  } finally { clearTimeout(timeout) }
}, { method: 'get_structure' })

const searchStructures = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query required')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const body = JSON.stringify({ query: { type: 'terminal', service: 'full_text', parameters: { value: args.query } }, return_type: 'entry', request_options: { results_content_type: ['experimental'], paginate: { start: 0, rows: Math.min(args.limit ?? 5, 10) } } })
    const res = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body })
    if (!res.ok) throw new Error(`RCSB Search API ${res.status}`)
    const data = await res.json() as { result_set?: Array<{ identifier: string; score: number }> }
    return { query: args.query, results: (data.result_set ?? []).map(r => ({ pdb_id: r.identifier, score: r.score })), count: data.result_set?.length ?? 0 }
  } finally { clearTimeout(timeout) }
}, { method: 'search_structures' })

const AMINO_ACIDS: Record<string, { name: string; abbreviation: string; type: string; mw: number }> = {
  A: { name: 'Alanine', abbreviation: 'Ala', type: 'nonpolar', mw: 89.1 },
  C: { name: 'Cysteine', abbreviation: 'Cys', type: 'polar', mw: 121.2 },
  D: { name: 'Aspartic acid', abbreviation: 'Asp', type: 'acidic', mw: 133.1 },
  E: { name: 'Glutamic acid', abbreviation: 'Glu', type: 'acidic', mw: 147.1 },
  F: { name: 'Phenylalanine', abbreviation: 'Phe', type: 'nonpolar', mw: 165.2 },
  G: { name: 'Glycine', abbreviation: 'Gly', type: 'nonpolar', mw: 75.0 },
  K: { name: 'Lysine', abbreviation: 'Lys', type: 'basic', mw: 146.2 },
  M: { name: 'Methionine', abbreviation: 'Met', type: 'nonpolar', mw: 149.2 },
  W: { name: 'Tryptophan', abbreviation: 'Trp', type: 'nonpolar', mw: 204.2 },
  Y: { name: 'Tyrosine', abbreviation: 'Tyr', type: 'polar', mw: 181.2 },
}

const getAminoAcid = sg.wrap(async (args: { code: string }) => {
  if (!args.code) throw new Error('single-letter amino acid code required')
  const aa = AMINO_ACIDS[args.code.toUpperCase()]
  if (!aa) throw new Error(`Unknown code. Available: ${Object.keys(AMINO_ACIDS).join(', ')}`)
  return { code: args.code.toUpperCase(), ...aa }
}, { method: 'get_amino_acid' })

export { getStructure, searchStructures, getAminoAcid }
console.log('settlegrid-protein-structures MCP server ready | Powered by SettleGrid')
