import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "remittance-data", pricing: { defaultCostCents: 2, methods: {
  get_country: { costCents: 2, displayName: "Get Country Remittances" },
  get_corridor: { costCents: 2, displayName: "Get Corridor Data" },
}}})
const countries: Record<string, { inflow_billion_usd: number; outflow_billion_usd: number; pct_of_gdp: number; top_sources: string[] }> = {
  india: { inflow_billion_usd: 125, outflow_billion_usd: 7.2, pct_of_gdp: 3.3, top_sources: ["UAE", "US", "Saudi Arabia", "UK"] },
  mexico: { inflow_billion_usd: 63.3, outflow_billion_usd: 1.2, pct_of_gdp: 4.2, top_sources: ["United States"] },
  philippines: { inflow_billion_usd: 37.2, outflow_billion_usd: 0.8, pct_of_gdp: 8.9, top_sources: ["US", "UAE", "Saudi Arabia", "Japan"] },
  egypt: { inflow_billion_usd: 24.1, outflow_billion_usd: 0.5, pct_of_gdp: 6.2, top_sources: ["Saudi Arabia", "UAE", "Kuwait", "US"] },
  pakistan: { inflow_billion_usd: 27.0, outflow_billion_usd: 0.3, pct_of_gdp: 7.9, top_sources: ["Saudi Arabia", "UAE", "UK", "US"] },
  nepal: { inflow_billion_usd: 10.4, outflow_billion_usd: 0.1, pct_of_gdp: 24.1, top_sources: ["India", "Malaysia", "Qatar", "Saudi Arabia"] },
}
const getCountry = sg.wrap(async (args: { country: string }) => {
  if (!args.country) throw new Error("country is required")
  const d = countries[args.country.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(countries).join(", ")}`)
  return { country: args.country, year: 2023, ...d }
}, { method: "get_country" })
const corridors: Record<string, { volume_billion_usd: number; avg_cost_pct: number; transfer_time_days: number }> = {
  "us_mexico": { volume_billion_usd: 63.3, avg_cost_pct: 3.5, transfer_time_days: 1 },
  "uae_india": { volume_billion_usd: 18.2, avg_cost_pct: 2.8, transfer_time_days: 1 },
  "us_india": { volume_billion_usd: 16.4, avg_cost_pct: 3.1, transfer_time_days: 2 },
  "saudi_pakistan": { volume_billion_usd: 8.2, avg_cost_pct: 4.2, transfer_time_days: 1 },
  "us_philippines": { volume_billion_usd: 12.8, avg_cost_pct: 4.8, transfer_time_days: 2 },
}
const getCorridor = sg.wrap(async (args: { corridor: string }) => {
  if (!args.corridor) throw new Error("corridor is required (e.g. us_mexico)")
  const c = corridors[args.corridor.toLowerCase()]
  if (!c) throw new Error(`Unknown. Available: ${Object.keys(corridors).join(", ")}`)
  return { corridor: args.corridor, ...c }
}, { method: "get_corridor" })
export { getCountry, getCorridor }
console.log("settlegrid-remittance-data MCP server ready | 2c/call | Powered by SettleGrid")
