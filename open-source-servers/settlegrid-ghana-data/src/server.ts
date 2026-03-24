/**
 * settlegrid-ghana-data — Ghana Statistical Service MCP Server
 */
import { settlegrid } from "@settlegrid/mcp"

interface RegionInput { region?: string }
interface EconInput { indicator: string }

const sg = settlegrid.init({
  toolSlug: "ghana-data",
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_demographics: { costCents: 2, displayName: "Get Demographics" },
      get_economy: { costCents: 2, displayName: "Get Economy" },
    },
  },
})

const regions: Record<string, { population: number; capital: string }> = {
  greater_accra: { population: 5455692, capital: "Accra" },
  ashanti: { population: 5432485, capital: "Kumasi" },
  eastern: { population: 2917751, capital: "Koforidua" },
  western: { population: 2060585, capital: "Sekondi-Takoradi" },
  northern: { population: 2310939, capital: "Tamale" },
  central: { population: 2563228, capital: "Cape Coast" },
  volta: { population: 1651632, capital: "Ho" },
}

const getDemographics = sg.wrap(async (args: RegionInput) => {
  if (args.region) {
    const r = regions[args.region.toLowerCase().replace(/ /g, "_")]
    if (!r) throw new Error(`Unknown region. Available: ${Object.keys(regions).join(", ")}`)
    return { country: "Ghana", region: args.region, ...r }
  }
  return { country: "Ghana", total_population: 32833031, year: 2021, regions: Object.keys(regions) }
}, { method: "get_demographics" })

const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 72.84, unit: "billion USD" },
  gdp_growth: { value: 3.2, unit: "percent" },
  inflation: { value: 23.5, unit: "percent" },
  unemployment: { value: 13.4, unit: "percent" },
  cocoa_production: { value: 683000, unit: "tonnes" },
  gold_production: { value: 117.6, unit: "tonnes" },
}

const getEconomy = sg.wrap(async (args: EconInput) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown indicator. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Ghana", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })

export { getDemographics, getEconomy }
console.log("settlegrid-ghana-data MCP server ready | 2c/call | Powered by SettleGrid")
