/**
 * settlegrid-carbon-intensity — Carbon Intensity MCP Server
 *
 * Wraps the UK Carbon Intensity API with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_current()                         (1¢)
 *   get_forecast()                        (1¢)
 *   get_by_date(date)                     (1¢)
 *   get_by_region(region)                 (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface DateInput { date: string }
interface RegionInput { region: string }

const API_BASE = "https://api.carbonintensity.org.uk"
const USER_AGENT = "settlegrid-carbon-intensity/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Carbon Intensity API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "carbon-intensity",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current: { costCents: 1, displayName: "Get current carbon intensity" },
      get_forecast: { costCents: 1, displayName: "Get carbon intensity forecast" },
      get_by_date: { costCents: 1, displayName: "Get intensity for specific date" },
      get_by_region: { costCents: 1, displayName: "Get intensity by region" },
    },
  },
})

const getCurrent = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/intensity")
}, { method: "get_current" })

const getForecast = sg.wrap(async () => {
  return apiFetch<Record<string, unknown>>("/intensity/date/fw24h")
}, { method: "get_forecast" })

const getByDate = sg.wrap(async (args: DateInput) => {
  if (!args.date || typeof args.date !== "string") throw new Error("date is required (YYYY-MM-DD)")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("date must be YYYY-MM-DD format")
  return apiFetch<Record<string, unknown>>(`/intensity/date/${args.date}`)
}, { method: "get_by_date" })

const getByRegion = sg.wrap(async (args: RegionInput) => {
  if (!args.region || typeof args.region !== "string") throw new Error("region is required")
  const REGIONS: Record<string, number> = {
    "north scotland": 1, "south scotland": 2, "north west england": 3,
    "north east england": 4, "yorkshire": 5, "north wales": 6,
    "south wales": 7, "west midlands": 8, "east midlands": 9,
    "east england": 10, "south west england": 11, "south england": 12,
    "london": 13, "south east england": 14,
  }
  const regionId = REGIONS[args.region.toLowerCase()]
  if (!regionId) throw new Error(`Unknown region. Available: ${Object.keys(REGIONS).join(", ")}`)
  return apiFetch<Record<string, unknown>>(`/regional/regionid/${regionId}`)
}, { method: "get_by_region" })

export { getCurrent, getForecast, getByDate, getByRegion }

console.log("settlegrid-carbon-intensity MCP server ready")
console.log("Methods: get_current, get_forecast, get_by_date, get_by_region")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
