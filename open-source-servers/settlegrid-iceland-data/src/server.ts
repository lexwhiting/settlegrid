import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "iceland-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_energy: { costCents: 2, displayName: "Get Energy Stats" },
}}})
const getDemographics = sg.wrap(async (args: { year?: number }) => {
  const pop: Record<number, number> = { 2020: 366463, 2021: 372520, 2022: 382003, 2023: 393600, 2024: 404000 }
  const y = args.year ?? 2023
  return { country: "Iceland", year: y, population: pop[y] ?? 393600, capital: "Reykjavik", area_km2: 103000, density_per_km2: 3.8 }
}, { method: "get_demographics" })
const getEnergy = sg.wrap(async (args: { source?: string }) => {
  const sources: Record<string, { share: number; capacity_mw: number }> = {
    geothermal: { share: 66, capacity_mw: 755 }, hydro: { share: 20, capacity_mw: 2127 },
    wind: { share: 0.1, capacity_mw: 3 }, total_renewable: { share: 99.99, capacity_mw: 2885 },
  }
  if (args.source) {
    const d = sources[args.source.toLowerCase()]
    if (!d) throw new Error(`Unknown. Available: ${Object.keys(sources).join(", ")}`)
    return { country: "Iceland", source: args.source, ...d }
  }
  return { country: "Iceland", renewable_percent: 99.99, sources, aluminum_smelting_gwh: 4800 }
}, { method: "get_energy" })
export { getDemographics, getEnergy }
console.log("settlegrid-iceland-data MCP server ready | 2c/call | Powered by SettleGrid")
