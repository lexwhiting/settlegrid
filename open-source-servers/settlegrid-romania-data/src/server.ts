/**
 * settlegrid-romania-data — Romania INS Statistics MCP Server
 *
 * Methods:
 *   get_demographics(region)   — Get Romania demographics    (2¢)
 *   get_economy(indicator)     — Get economic indicators     (2¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface DemoInput { region?: string }
interface EconInput { indicator: string }

const sg = settlegrid.init({
  toolSlug: "romania-data",
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_demographics: { costCents: 2, displayName: "Get Demographics" },
      get_economy: { costCents: 2, displayName: "Get Economy" },
    },
  },
})

const regions: Record<string, { population: number; area_km2: number; capital: string }> = {
  bucharest: { population: 1794590, area_km2: 228, capital: "Bucharest" },
  cluj: { population: 691106, area_km2: 6674, capital: "Cluj-Napoca" },
  timis: { population: 705745, area_km2: 8697, capital: "Timisoara" },
  iasi: { population: 772348, area_km2: 5476, capital: "Iasi" },
  constanta: { population: 684082, area_km2: 7071, capital: "Constanta" },
  brasov: { population: 549217, area_km2: 5363, capital: "Brasov" },
}

const getDemographics = sg.wrap(async (args: DemoInput) => {
  if (args.region) {
    const key = args.region.toLowerCase()
    const r = regions[key]
    if (!r) throw new Error(`Unknown region. Available: ${Object.keys(regions).join(", ")}`)
    return { country: "Romania", region: args.region, ...r }
  }
  return { country: "Romania", total_population: 19053815, regions: Object.keys(regions) }
}, { method: "get_demographics" })

const getEconomy = sg.wrap(async (args: EconInput) => {
  if (!args.indicator) throw new Error("indicator is required")
  const data: Record<string, { value: number; unit: string; year: number }> = {
    gdp: { value: 301.2, unit: "billion EUR", year: 2023 },
    gdp_growth: { value: 2.1, unit: "percent", year: 2023 },
    unemployment: { value: 5.4, unit: "percent", year: 2023 },
    inflation: { value: 10.4, unit: "percent", year: 2023 },
    min_wage: { value: 3300, unit: "RON/month", year: 2024 },
    exports: { value: 86.5, unit: "billion EUR", year: 2023 },
  }
  const result = data[args.indicator.toLowerCase()]
  if (!result) throw new Error(`Unknown indicator. Available: ${Object.keys(data).join(", ")}`)
  return { country: "Romania", indicator: args.indicator, ...result }
}, { method: "get_economy" })

export { getDemographics, getEconomy }

console.log("settlegrid-romania-data MCP server ready")
console.log("Methods: get_demographics, get_economy")
console.log("Pricing: 2¢ per call | Powered by SettleGrid")
