import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "lithuania-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const counties: Record<string, number> = { vilnius: 810400, kaunas: 566700, klaipeda: 318600, siauliai: 267900, panevezys: 214900 }
const getDemographics = sg.wrap(async (args: { county?: string }) => {
  if (args.county) {
    const p = counties[args.county.toLowerCase()]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(counties).join(", ")}`)
    return { country: "Lithuania", county: args.county, population: p }
  }
  return { country: "Lithuania", population: 2832718, year: 2023, eu_member_since: 2004, euro_since: 2015 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 67.4, unit: "billion EUR" }, unemployment: { value: 6.8, unit: "percent" },
  inflation: { value: 8.7, unit: "percent" }, avg_wage: { value: 2050, unit: "EUR/month" },
  laser_exports: { value: 0.8, unit: "billion EUR" }, it_sector: { value: 5.2, unit: "billion EUR" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Lithuania", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-lithuania-data MCP server ready | 2c/call | Powered by SettleGrid")
