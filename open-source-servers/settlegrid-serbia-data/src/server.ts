/**
 * settlegrid-serbia-data — Serbia SORS Statistics MCP Server
 */
import { settlegrid } from "@settlegrid/mcp"

interface DemoInput { region?: string }
interface EconInput { indicator: string }

const sg = settlegrid.init({
  toolSlug: "serbia-data",
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_demographics: { costCents: 2, displayName: "Get Demographics" },
      get_economy: { costCents: 2, displayName: "Get Economy" },
    },
  },
})

const regions: Record<string, { population: number; area_km2: number }> = {
  belgrade: { population: 1688667, area_km2: 3234 },
  vojvodina: { population: 1852093, area_km2: 21506 },
  sumadija: { population: 2013286, area_km2: 26195 },
  southern: { population: 1574895, area_km2: 26195 },
}

const getDemographics = sg.wrap(async (args: DemoInput) => {
  if (args.region) {
    const r = regions[args.region.toLowerCase()]
    if (!r) throw new Error(`Unknown region. Available: ${Object.keys(regions).join(", ")}`)
    return { country: "Serbia", region: args.region, ...r }
  }
  return { country: "Serbia", total_population: 6647003, year: 2023, regions: Object.keys(regions) }
}, { method: "get_demographics" })

const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 63.5, unit: "billion EUR" },
  unemployment: { value: 9.2, unit: "percent" },
  inflation: { value: 12.4, unit: "percent" },
  avg_wage: { value: 850, unit: "EUR/month" },
  exports: { value: 27.8, unit: "billion EUR" },
}

const getEconomy = sg.wrap(async (args: EconInput) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown indicator. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Serbia", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })

export { getDemographics, getEconomy }
console.log("settlegrid-serbia-data MCP server ready | 2c/call | Powered by SettleGrid")
