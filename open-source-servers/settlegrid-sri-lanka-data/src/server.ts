import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "sri-lanka-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const provinces: Record<string, number> = { western: 6081800, central: 2781200, southern: 2669400, northern: 1148300, eastern: 1743200, north_western: 2564100, north_central: 1373200, uva: 1361900, sabaragamuwa: 2070600 }
const getDemographics = sg.wrap(async (args: { province?: string }) => {
  if (args.province) {
    const p = provinces[args.province.toLowerCase().replace(/ /g, "_")]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(provinces).join(", ")}`)
    return { country: "Sri Lanka", province: args.province, population: p }
  }
  return { country: "Sri Lanka", population: 22156000, year: 2023 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 74.4, unit: "billion USD" }, tea_exports: { value: 1.3, unit: "billion USD" },
  remittances: { value: 5.9, unit: "billion USD" }, inflation: { value: 17.5, unit: "percent" },
  tourism_arrivals: { value: 1487, unit: "thousand" }, debt_to_gdp: { value: 128, unit: "percent" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Sri Lanka", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-sri-lanka-data MCP server ready | 2c/call | Powered by SettleGrid")
