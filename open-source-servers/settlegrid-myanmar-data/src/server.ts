import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "myanmar-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const regions: Record<string, number> = { yangon: 7360703, mandalay: 6165723, sagaing: 5325347, shan: 5824432, ayeyarwady: 6184829, bago: 4867373 }
const getDemographics = sg.wrap(async (args: { region?: string }) => {
  if (args.region) {
    const p = regions[args.region.toLowerCase()]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(regions).join(", ")}`)
    return { country: "Myanmar", region: args.region, population: p }
  }
  return { country: "Myanmar", population: 54179306, year: 2023 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 59.4, unit: "billion USD" }, jade_exports: { value: 8.5, unit: "billion USD est." },
  rice_production: { value: 25.6, unit: "million tonnes" }, inflation: { value: 28.6, unit: "percent" },
  natural_gas: { value: 17.8, unit: "billion cubic meters" }, garment_exports: { value: 5.6, unit: "billion USD" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Myanmar", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-myanmar-data MCP server ready | 2c/call | Powered by SettleGrid")
