import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "marine-species", pricing: { defaultCostCents: 2, methods: {
  search_species: { costCents: 2, displayName: "Search Species" },
  get_species: { costCents: 2, displayName: "Get Species" },
}}})
const API = "https://www.marinespecies.org/rest"
const searchSpecies = sg.wrap(async (args: { query: string; limit?: number }) => {
  if (!args.query) throw new Error("query is required")
  const limit = Math.min(args.limit ?? 10, 50)
  const res = await fetch(`${API}/AphiaRecordsByName/${encodeURIComponent(args.query)}?like=true&offset=1`)
  if (!res.ok) throw new Error(`WoRMS API ${res.status}`)
  const data = await res.json()
  const results = (Array.isArray(data) ? data : []).slice(0, limit).map((r: any) => ({
    aphia_id: r.AphiaID, name: r.scientificname, authority: r.authority, status: r.status, rank: r.rank, kingdom: r.kingdom, phylum: r.phylum,
  }))
  return { query: args.query, count: results.length, species: results }
}, { method: "search_species" })
const getSpecies = sg.wrap(async (args: { aphia_id: number }) => {
  if (!args.aphia_id) throw new Error("aphia_id is required")
  const res = await fetch(`${API}/AphiaRecordByAphiaID/${args.aphia_id}`)
  if (!res.ok) throw new Error(`WoRMS API ${res.status}`)
  const r = await res.json()
  return { aphia_id: r.AphiaID, name: r.scientificname, authority: r.authority, status: r.status, rank: r.rank, kingdom: r.kingdom, phylum: r.phylum, class: r.class, order: r.order, family: r.family, genus: r.genus }
}, { method: "get_species" })
export { searchSpecies, getSpecies }
console.log("settlegrid-marine-species MCP server ready | 2c/call | Powered by SettleGrid")
