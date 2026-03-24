/**
 * settlegrid-bulgaria-data — Bulgaria NSI Statistics MCP Server
 *
 * Methods:
 *   get_population(year)     — Bulgaria population data  (2c)
 *   get_indicators(type)     — Economic indicators       (2c)
 */

import { settlegrid } from "@settlegrid/mcp"

interface PopInput { year?: number }
interface IndInput { type: string }

const sg = settlegrid.init({
  toolSlug: "bulgaria-data",
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_population: { costCents: 2, displayName: "Get Population" },
      get_indicators: { costCents: 2, displayName: "Get Indicators" },
    },
  },
})

const popData: Record<number, number> = {
  2020: 6951482, 2021: 6838937, 2022: 6519789, 2023: 6447710, 2024: 6375451,
}

const indicators: Record<string, { value: number; unit: string; year: number }> = {
  gdp: { value: 100.7, unit: "billion EUR", year: 2023 },
  unemployment: { value: 4.3, unit: "percent", year: 2023 },
  inflation: { value: 8.6, unit: "percent", year: 2023 },
  trade: { value: 82.4, unit: "billion EUR exports", year: 2023 },
  avg_salary: { value: 2100, unit: "BGN/month", year: 2024 },
  tourism: { value: 8.3, unit: "million visitors", year: 2023 },
}

const getPopulation = sg.wrap(async (args: PopInput) => {
  const year = args.year ?? 2023
  if (year < 2020 || year > 2024) throw new Error("year must be 2020-2024")
  return { country: "Bulgaria", year, population: popData[year] ?? 6447710 }
}, { method: "get_population" })

const getIndicators = sg.wrap(async (args: IndInput) => {
  if (!args.type) throw new Error("type is required")
  const d = indicators[args.type.toLowerCase()]
  if (!d) throw new Error(`Unknown type. Available: ${Object.keys(indicators).join(", ")}`)
  return { country: "Bulgaria", indicator: args.type, ...d }
}, { method: "get_indicators" })

export { getPopulation, getIndicators }
console.log("settlegrid-bulgaria-data MCP server ready")
console.log("Methods: get_population, get_indicators | 2c/call | Powered by SettleGrid")
