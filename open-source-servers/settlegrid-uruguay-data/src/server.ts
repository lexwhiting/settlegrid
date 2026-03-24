import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "uruguay-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_economy: { costCents: 2, displayName: "Get Economy" },
}}})
const departments: Record<string, number> = { montevideo: 1382405, canelones: 520187, maldonado: 164300, salto: 124878, paysandu: 113244, rivera: 103493 }
const getDemographics = sg.wrap(async (args: { department?: string }) => {
  if (args.department) {
    const p = departments[args.department.toLowerCase()]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(departments).join(", ")}`)
    return { country: "Uruguay", department: args.department, population: p }
  }
  return { country: "Uruguay", population: 3444263, year: 2023 }
}, { method: "get_demographics" })
const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 77.2, unit: "billion USD" }, gdp_per_capita: { value: 22420, unit: "USD" },
  unemployment: { value: 7.9, unit: "percent" }, inflation: { value: 5.9, unit: "percent" },
  beef_exports: { value: 2.8, unit: "billion USD" }, soy_exports: { value: 1.2, unit: "billion USD" },
}
const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Uruguay", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })
export { getDemographics, getEconomy }
console.log("settlegrid-uruguay-data MCP server ready | 2c/call | Powered by SettleGrid")
