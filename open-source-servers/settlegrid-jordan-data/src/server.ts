import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "jordan-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const governorates: Record<string, number> = { amman: 4007526, zarqa: 1364878, irbid: 1957000, mafraq: 549948, balqa: 491709, karak: 316629 }
const getDemographics = sg.wrap(async (args: { governorate?: string }) => {
  if (args.governorate) {
    const p = governorates[args.governorate.toLowerCase()]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(governorates).join(", ")}`)
    return { country: "Jordan", governorate: args.governorate, population: p }
  }
  return { country: "Jordan", population: 11459000, year: 2023 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 47.5, unit: "billion USD" }, unemployment: { value: 22.8, unit: "percent" },
  inflation: { value: 2.1, unit: "percent" }, remittances: { value: 4.2, unit: "billion USD" },
  phosphate_exports: { value: 1.8, unit: "billion USD" }, tourism_revenue: { value: 6.8, unit: "billion USD" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Jordan", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-jordan-data MCP server ready | 2c/call | Powered by SettleGrid")
