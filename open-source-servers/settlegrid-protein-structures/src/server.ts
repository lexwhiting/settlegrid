import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "protein-structures", pricing: { defaultCostCents: 3, methods: {
  search_structures: { costCents: 3, displayName: "Search Structures" },
  get_structure: { costCents: 3, displayName: "Get Structure" },
}}})
const PDB = "https://data.rcsb.org/rest/v1"
const searchStructures = sg.wrap(async (args: { query: string; limit?: number }) => {
  if (!args.query) throw new Error("query is required")
  const limit = Math.min(args.limit ?? 10, 25)
  const res = await fetch(`https://search.rcsb.org/rcsbsearch/v2/query?json=${encodeURIComponent(JSON.stringify({ query: { type: "terminal", service: "full_text", parameters: { value: args.query } }, return_type: "entry", request_options: { paginate: { start: 0, rows: limit } } }))}`)
  if (!res.ok) throw new Error(`RCSB API ${res.status}`)
  const data = await res.json()
  return { query: args.query, count: data.total_count ?? 0, results: (data.result_set ?? []).map((r: any) => r.identifier) }
}, { method: "search_structures" })
const getStructure = sg.wrap(async (args: { pdb_id: string }) => {
  if (!args.pdb_id || args.pdb_id.length !== 4) throw new Error("pdb_id must be a 4-character PDB ID")
  const res = await fetch(`${PDB}/core/entry/${args.pdb_id.toUpperCase()}`)
  if (!res.ok) throw new Error(`RCSB API ${res.status}`)
  const d = await res.json()
  return { pdb_id: d.entry?.id, title: d.struct?.title, method: d.exptl?.[0]?.method, resolution_a: d.rcsb_entry_info?.resolution_combined?.[0], deposit_date: d.rcsb_accession_info?.deposit_date, organism: d.rcsb_entry_info?.deposited_atom_count }
}, { method: "get_structure" })
export { searchStructures, getStructure }
console.log("settlegrid-protein-structures MCP server ready | 3c/call | Powered by SettleGrid")
