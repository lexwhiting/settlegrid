import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "meteorite-data", pricing: { defaultCostCents: 2, methods: {
  search_meteorites: { costCents: 2, displayName: "Search Meteorites" },
  get_classification: { costCents: 2, displayName: "Get Classification" },
}}})
const API = "https://data.nasa.gov/resource/gh4g-9sfh.json"
const searchMeteorites = sg.wrap(async (args: { name?: string; year?: number; limit?: number }) => {
  const params = new URLSearchParams({ "$limit": String(Math.min(args.limit ?? 10, 50)) })
  if (args.name) params.append("$where", `upper(name) LIKE '%${args.name.toUpperCase()}%'`)
  if (args.year) params.append("year", `${args.year}-01-01T00:00:00.000`)
  const res = await fetch(`${API}?${params}`)
  if (!res.ok) throw new Error(`NASA API ${res.status}`)
  const data = await res.json()
  return { count: data.length, meteorites: data.map((m: any) => ({ name: m.name, id: m.id, mass_g: m.mass, year: m.year?.slice(0, 4), class: m.recclass, fall: m.fall, lat: m.reclat, lon: m.reclong })) }
}, { method: "search_meteorites" })
const classes: Record<string, { parent: string; description: string; iron_pct: string }> = {
  H: { parent: "ordinary chondrite", description: "High iron, olivine-bronzite", iron_pct: "25-31%" },
  L: { parent: "ordinary chondrite", description: "Low iron, olivine-hypersthene", iron_pct: "20-25%" },
  LL: { parent: "ordinary chondrite", description: "Low iron, low metal", iron_pct: "19-22%" },
  CI: { parent: "carbonaceous chondrite", description: "Ivuna-type, most primitive", iron_pct: "18-25%" },
  iron: { parent: "iron meteorite", description: "Mostly Fe-Ni alloy", iron_pct: "90-95%" },
  pallasite: { parent: "stony-iron", description: "Olivine crystals in Fe-Ni matrix", iron_pct: "~50%" },
}
const getClassification = sg.wrap(async (args: { class_name: string }) => {
  if (!args.class_name) throw new Error("class_name is required")
  const c = classes[args.class_name.toUpperCase()] || classes[args.class_name.toLowerCase()]
  if (!c) throw new Error(`Unknown class. Available: ${Object.keys(classes).join(", ")}`)
  return { classification: args.class_name, ...c }
}, { method: "get_classification" })
export { searchMeteorites, getClassification }
console.log("settlegrid-meteorite-data MCP server ready | 2c/call | Powered by SettleGrid")
