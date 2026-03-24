import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "malta-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const getDemographics = sg.wrap(async (args: { year?: number }) => {
  return { country: "Malta", population: 542051, year: args.year ?? 2023, area_km2: 316, density_per_km2: 1715, capital: "Valletta", eu_member_since: 2004, euro_since: 2008, languages: ["Maltese", "English"] }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 17.2, unit: "billion EUR" }, gdp_per_capita: { value: 31700, unit: "EUR" },
  unemployment: { value: 3.1, unit: "percent" }, igaming_revenue: { value: 2.1, unit: "billion EUR" },
  tourism_arrivals: { value: 3.1, unit: "million" }, financial_services: { value: 12, unit: "percent of GDP" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Malta", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-malta-data MCP server ready | 2c/call | Powered by SettleGrid")
