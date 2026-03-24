import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "fiji-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const getDemographics = sg.wrap(async (args: { year?: number }) => {
  return { country: "Fiji", population: 936375, year: args.year ?? 2023, islands: 332, inhabited_islands: 110, capital: "Suva", area_km2: 18274, ethnic: { itaukei: 56.8, indian: 37.5, other: 5.7 } }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 5.5, unit: "billion USD" }, tourism_revenue: { value: 2.1, unit: "billion USD" },
  sugar_exports: { value: 0.12, unit: "billion USD" }, remittances: { value: 0.34, unit: "billion USD" },
  fish_exports: { value: 0.09, unit: "billion USD" }, gdp_growth: { value: 8.0, unit: "percent" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Fiji", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-fiji-data MCP server ready | 2c/call | Powered by SettleGrid")
