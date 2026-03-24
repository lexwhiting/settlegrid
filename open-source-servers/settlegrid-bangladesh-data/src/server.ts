import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "bangladesh-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const divisions: Record<string, number> = { dhaka: 44214100, chittagong: 33202300, rajshahi: 20353500, khulna: 17280700, sylhet: 11309100, rangpur: 17610900, barisal: 9328900, mymensingh: 12285100 }
const getDemographics = sg.wrap(async (args: { division?: string }) => {
  if (args.division) {
    const p = divisions[args.division.toLowerCase()]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(divisions).join(", ")}`)
    return { country: "Bangladesh", division: args.division, population: p }
  }
  return { country: "Bangladesh", population: 169828911, year: 2023, density_per_km2: 1265 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 460.2, unit: "billion USD" }, garment_exports: { value: 47.4, unit: "billion USD" },
  remittances: { value: 21.6, unit: "billion USD" }, inflation: { value: 9.5, unit: "percent" },
  unemployment: { value: 5.2, unit: "percent" }, rice_production: { value: 38.1, unit: "million tonnes" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Bangladesh", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-bangladesh-data MCP server ready | 2c/call | Powered by SettleGrid")
