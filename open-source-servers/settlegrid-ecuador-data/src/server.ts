import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "ecuador-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const provinces: Record<string, number> = { guayas: 4387434, pichincha: 3228233, manabi: 1562079, azuay: 881394, tungurahua: 590600, el_oro: 715751 }
const getDemographics = sg.wrap(async (args: { province?: string }) => {
  if (args.province) {
    const p = provinces[args.province.toLowerCase().replace(/ /g, "_")]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(provinces).join(", ")}`)
    return { country: "Ecuador", province: args.province, population: p }
  }
  return { country: "Ecuador", population: 18190484, year: 2023 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 118.8, unit: "billion USD" }, oil_production: { value: 481000, unit: "barrels/day" },
  inflation: { value: 2.2, unit: "percent" }, unemployment: { value: 3.3, unit: "percent" },
  banana_exports: { value: 3.6, unit: "billion USD" }, shrimp_exports: { value: 6.7, unit: "billion USD" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Ecuador", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-ecuador-data MCP server ready | 2c/call | Powered by SettleGrid")
