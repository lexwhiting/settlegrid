import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "costa-rica-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_environment: { costCents: 2, displayName: "Get Environment Stats" },
}}})
const provinces: Record<string, number> = { san_jose: 1453500, alajuela: 1018900, cartago: 541200, heredia: 530500, guanacaste: 387400, puntarenas: 478100, limon: 443100 }
const getDemographics = sg.wrap(async (args: { province?: string }) => {
  if (args.province) {
    const p = provinces[args.province.toLowerCase().replace(/ /g, "_")]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(provinces).join(", ")}`)
    return { country: "Costa Rica", province: args.province, population: p }
  }
  return { country: "Costa Rica", population: 5212173, year: 2023, gdp_billion_usd: 68.4 }
}, { method: "get_demographics" })
const getEnvironment = sg.wrap(async (args: { metric?: string }) => {
  const metrics: Record<string, { value: number; unit: string }> = {
    forest_cover: { value: 59.4, unit: "percent" }, protected_areas: { value: 26.3, unit: "percent of land" },
    renewable_energy: { value: 99.2, unit: "percent of electricity" }, biodiversity_species: { value: 500000, unit: "estimated species" },
    national_parks: { value: 28, unit: "parks" }, co2_per_capita: { value: 1.5, unit: "tonnes" },
  }
  if (args.metric) {
    const d = metrics[args.metric.toLowerCase()]
    if (!d) throw new Error(`Unknown. Available: ${Object.keys(metrics).join(", ")}`)
    return { country: "Costa Rica", metric: args.metric, ...d }
  }
  return { country: "Costa Rica", metrics }
}, { method: "get_environment" })
export { getDemographics, getEnvironment }
console.log("settlegrid-costa-rica-data MCP server ready | 2c/call | Powered by SettleGrid")
