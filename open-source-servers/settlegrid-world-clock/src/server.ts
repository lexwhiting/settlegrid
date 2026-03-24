/**
 * settlegrid-world-clock — World Clock MCP Server
 *
 * Wraps the WorldTimeAPI with SettleGrid billing.
 * No external API key required.
 *
 * Methods:
 *   get_time(timezone)                    (1¢)
 *   list_timezones()                      (1¢)
 *   convert_time(from, to, time)          (1¢)
 *   get_offset(timezone)                  (1¢)
 */

import { settlegrid } from "@settlegrid/mcp"

interface GetTimeInput { timezone: string }
interface ConvertTimeInput { from_tz: string; to_tz: string; time: string }
interface GetOffsetInput { timezone: string }

const API_BASE = "https://worldtimeapi.org/api"
const USER_AGENT = "settlegrid-world-clock/1.0 (contact@settlegrid.ai)"

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`WorldTimeAPI ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: "world-clock",
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_time: { costCents: 1, displayName: "Get current time in timezone" },
      list_timezones: { costCents: 1, displayName: "List all timezones" },
      convert_time: { costCents: 1, displayName: "Convert time between zones" },
      get_offset: { costCents: 1, displayName: "Get UTC offset" },
    },
  },
})

const getTime = sg.wrap(async (args: GetTimeInput) => {
  if (!args.timezone || typeof args.timezone !== "string") throw new Error("timezone is required (e.g. America/New_York)")
  return apiFetch<Record<string, unknown>>(`/timezone/${encodeURIComponent(args.timezone)}`)
}, { method: "get_time" })

const listTimezones = sg.wrap(async () => {
  const data = await apiFetch<string[]>("/timezone")
  return { count: data.length, timezones: data }
}, { method: "list_timezones" })

const convertTime = sg.wrap(async (args: ConvertTimeInput) => {
  if (!args.from_tz || typeof args.from_tz !== "string") throw new Error("from_tz is required")
  if (!args.to_tz || typeof args.to_tz !== "string") throw new Error("to_tz is required")
  if (!args.time || typeof args.time !== "string") throw new Error("time is required (ISO 8601)")
  const fromData = await apiFetch<{ utc_offset: string }>(`/timezone/${encodeURIComponent(args.from_tz)}`)
  const toData = await apiFetch<{ utc_offset: string }>(`/timezone/${encodeURIComponent(args.to_tz)}`)
  const parseOffset = (o: string) => { const m = o.match(/([+-])(\d{2}):(\d{2})/); return m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2]) * 60 + parseInt(m[3])) : 0 }
  const diff = parseOffset(toData.utc_offset) - parseOffset(fromData.utc_offset)
  const dt = new Date(args.time)
  dt.setMinutes(dt.getMinutes() + diff)
  return { from: { timezone: args.from_tz, offset: fromData.utc_offset }, to: { timezone: args.to_tz, offset: toData.utc_offset }, input_time: args.time, converted_time: dt.toISOString(), diff_minutes: diff }
}, { method: "convert_time" })

const getOffset = sg.wrap(async (args: GetOffsetInput) => {
  if (!args.timezone || typeof args.timezone !== "string") throw new Error("timezone is required")
  const data = await apiFetch<{ utc_offset: string; abbreviation: string; timezone: string }>(`/timezone/${encodeURIComponent(args.timezone)}`)
  return { timezone: data.timezone, utc_offset: data.utc_offset, abbreviation: data.abbreviation }
}, { method: "get_offset" })

export { getTime, listTimezones, convertTime, getOffset }

console.log("settlegrid-world-clock MCP server ready")
console.log("Methods: get_time, list_timezones, convert_time, get_offset")
console.log("Pricing: 1¢ per call | Powered by SettleGrid")
