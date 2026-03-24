import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "panama-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_canal_stats: { costCents: 2, displayName: "Get Canal Stats" },
}}})
const getDemographics = sg.wrap(async (args: { year?: number }) => {
  const year = args.year ?? 2023
  const pop: Record<number, number> = { 2020: 4278500, 2021: 4351267, 2022: 4408581, 2023: 4468087 }
  return { country: "Panama", year, population: pop[year] ?? 4468087, gdp_billion_usd: 76.5, currency: "USD/PAB" }
}, { method: "get_demographics" })
const getCanalStats = sg.wrap(async (args: { fiscal_year?: number }) => {
  const fy = args.fiscal_year ?? 2023
  return {
    canal: "Panama Canal", fiscal_year: fy,
    transits: 13100, cargo_million_tonnes: 252.0, revenue_billion_usd: 4.3,
    toll_per_transit_avg_usd: 328000, panamax_transits: 7800, neopanamax_transits: 5300,
    top_users: ["United States", "China", "Japan", "South Korea", "Chile"],
  }
}, { method: "get_canal_stats" })
export { getDemographics, getCanalStats }
console.log("settlegrid-panama-data MCP server ready | 2c/call | Powered by SettleGrid")
