import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "cambodia-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const provinces: Record<string, number> = { phnom_penh: 2281951, kandal: 1195547, battambang: 1036523, siem_reap: 1014234, prey_veng: 947357, kampong_cham: 899791 }
const getDemographics = sg.wrap(async (args: { province?: string }) => {
  if (args.province) {
    const p = provinces[args.province.toLowerCase().replace(/ /g, "_")]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(provinces).join(", ")}`)
    return { country: "Cambodia", province: args.province, population: p }
  }
  return { country: "Cambodia", population: 17168639, year: 2023, median_age: 26.4 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 31.8, unit: "billion USD" }, garment_exports: { value: 11.4, unit: "billion USD" },
  tourism_arrivals: { value: 5.6, unit: "million" }, rice_exports: { value: 0.68, unit: "million tonnes" },
  gdp_growth: { value: 5.6, unit: "percent" }, fdi: { value: 3.6, unit: "billion USD" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Cambodia", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-cambodia-data MCP server ready | 2c/call | Powered by SettleGrid")
