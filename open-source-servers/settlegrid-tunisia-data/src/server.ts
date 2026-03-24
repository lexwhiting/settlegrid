import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "tunisia-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const regions: Record<string, number> = { tunis: 1056247, sfax: 955421, sousse: 674971, kairouan: 570559, bizerte: 568219, gabes: 374300 }
const getDemographics = sg.wrap(async (args: { region?: string }) => {
  if (args.region) {
    const p = regions[args.region.toLowerCase()]
    if (!p) throw new Error(`Unknown region. Available: ${Object.keys(regions).join(", ")}`)
    return { country: "Tunisia", region: args.region, population: p }
  }
  return { country: "Tunisia", population: 12458223, year: 2023, regions: Object.keys(regions) }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 46.3, unit: "billion USD" }, unemployment: { value: 15.2, unit: "percent" },
  inflation: { value: 9.3, unit: "percent" }, olive_oil_production: { value: 240000, unit: "tonnes" },
  tourism_revenue: { value: 2.1, unit: "billion USD" }, phosphate_export: { value: 1.8, unit: "billion USD" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Tunisia", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-tunisia-data MCP server ready | 2c/call | Powered by SettleGrid")
