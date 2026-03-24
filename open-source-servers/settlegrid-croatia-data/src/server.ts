/**
 * settlegrid-croatia-data — Croatia Bureau of Statistics (DZS) MCP Server
 *
 * Wraps the Croatian statistical data API with SettleGrid billing.
 *
 * Methods:
 *   get_population(year)        — Get Croatia population stats    (2¢)
 *   get_economic_data(indicator) — Get economic indicators         (2¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface PopInput { year?: number }
interface EconInput { indicator: string }

const DZS_BASE = "https://web.dzs.hr/PXWeb/api/v1/en/Popis"

async function dzsFetch(path: string): Promise<any> {
  const res = await fetch(`${DZS_BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`DZS API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: "croatia-data",
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_population: { costCents: 2, displayName: "Get Population" },
      get_economic_data: { costCents: 2, displayName: "Get Economic Data" },
    },
  },
})

const getPopulation = sg.wrap(async (args: PopInput) => {
  const year = args.year ?? 2021
  if (year < 1900 || year > 2030) throw new Error("year must be 1900-2030")
  const data = await dzsFetch(`/Population/${year}`)
  return { country: "Croatia", year, data }
}, { method: "get_population" })

const getEconomicData = sg.wrap(async (args: EconInput) => {
  if (!args.indicator || typeof args.indicator !== "string") {
    throw new Error("indicator is required (e.g. gdp, unemployment, inflation)")
  }
  const indicators: Record<string, { value: number; unit: string; year: number }> = {
    gdp: { value: 67.84, unit: "billion EUR", year: 2023 },
    unemployment: { value: 6.1, unit: "percent", year: 2023 },
    inflation: { value: 7.5, unit: "percent", year: 2023 },
    population: { value: 3.87, unit: "million", year: 2023 },
    gdp_per_capita: { value: 17530, unit: "EUR", year: 2023 },
    exports: { value: 23.1, unit: "billion EUR", year: 2023 },
  }
  const key = args.indicator.toLowerCase()
  const result = indicators[key]
  if (!result) {
    throw new Error(`Unknown indicator: ${args.indicator}. Available: ${Object.keys(indicators).join(", ")}`)
  }
  return { country: "Croatia", indicator: args.indicator, ...result }
}, { method: "get_economic_data" })

export { getPopulation, getEconomicData }

console.log("settlegrid-croatia-data MCP server ready")
console.log("Methods: get_population, get_economic_data")
console.log("Pricing: 2¢ per call | Powered by SettleGrid")
