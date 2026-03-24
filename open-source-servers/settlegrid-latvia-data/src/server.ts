import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "latvia-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const regions: Record<string, number> = { riga: 614618, pieriga: 383300, vidzeme: 178800, kurzeme: 213100, zemgale: 210800, latgale: 246200 }
const getDemographics = sg.wrap(async (args: { region?: string }) => {
  if (args.region) {
    const p = regions[args.region.toLowerCase()]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(regions).join(", ")}`)
    return { country: "Latvia", region: args.region, population: p }
  }
  return { country: "Latvia", population: 1842226, year: 2023, eu_member_since: 2004, euro_since: 2014 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 41.1, unit: "billion EUR" }, unemployment: { value: 6.3, unit: "percent" },
  inflation: { value: 9.1, unit: "percent" }, avg_wage: { value: 1537, unit: "EUR/month" },
  exports: { value: 19.8, unit: "billion EUR" }, timber_exports: { value: 3.2, unit: "billion EUR" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Latvia", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-latvia-data MCP server ready | 2c/call | Powered by SettleGrid")
