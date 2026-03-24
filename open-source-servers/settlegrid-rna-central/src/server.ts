import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "rna-central", pricing: { defaultCostCents: 2, methods: {
  search_rna: { costCents: 2, displayName: "Search RNA" },
  get_rna: { costCents: 2, displayName: "Get RNA Sequence" },
}}})
const API = "https://rnacentral.org/api/v1"
const searchRna = sg.wrap(async (args: { query: string; limit?: number }) => {
  if (!args.query) throw new Error("query is required")
  const limit = Math.min(args.limit ?? 10, 25)
  const res = await fetch(`${API}/rna/?search=${encodeURIComponent(args.query)}&format=json&page_size=${limit}`)
  if (!res.ok) throw new Error(`RNAcentral API ${res.status}`)
  const data = await res.json()
  return { query: args.query, count: data.count ?? 0, results: (data.results ?? []).slice(0, limit).map((r: any) => ({ id: r.rnacentral_id, description: r.description?.slice(0, 200), length: r.length, rna_type: r.rna_type })) }
}, { method: "search_rna" })
const getRna = sg.wrap(async (args: { rna_id: string }) => {
  if (!args.rna_id) throw new Error("rna_id is required (e.g. URS0000000001)")
  const res = await fetch(`${API}/rna/${args.rna_id}/?format=json`)
  if (!res.ok) throw new Error(`RNAcentral API ${res.status}`)
  const d = await res.json()
  return { id: d.rnacentral_id, description: d.description, sequence: d.sequence?.slice(0, 500), length: d.length, rna_type: d.rna_type, databases: d.count_distinct_organisms }
}, { method: "get_rna" })
export { searchRna, getRna }
console.log("settlegrid-rna-central MCP server ready | 2c/call | Powered by SettleGrid")
