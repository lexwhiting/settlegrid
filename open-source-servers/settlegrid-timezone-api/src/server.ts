/**
 * settlegrid-timezone-api — World Timezone MCP Server
 *
 * Wraps the WorldTimeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_time(timezone)    — Current time for timezone  (1¢)
 *   get_time_by_ip(ip?)   — Time by IP geolocation     (1¢)
 *   list_timezones()      — List all timezones          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimezoneInput { timezone: string }
interface IpInput { ip?: string }

interface TimeResponse {
  timezone: string
  datetime: string
  utc_datetime: string
  utc_offset: string
  day_of_week: number
  day_of_year: number
  week_number: number
  abbreviation: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://worldtimeapi.org/api'

async function timeFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Timezone not found')
    const body = await res.text().catch(() => '')
    throw new Error(`WorldTimeAPI ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatTime(t: TimeResponse) {
  return {
    timezone: t.timezone,
    datetime: t.datetime,
    utcDatetime: t.utc_datetime,
    utcOffset: t.utc_offset,
    dayOfWeek: t.day_of_week,
    dayOfYear: t.day_of_year,
    weekNumber: t.week_number,
    abbreviation: t.abbreviation,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'timezone-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_time: { costCents: 1, displayName: 'Get Time' },
      get_time_by_ip: { costCents: 1, displayName: 'Get Time by IP' },
      list_timezones: { costCents: 1, displayName: 'List Timezones' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTime = sg.wrap(async (args: TimezoneInput) => {
  if (!args.timezone || typeof args.timezone !== 'string') throw new Error('timezone is required (e.g. "America/New_York")')
  const tz = args.timezone.trim()
  if (!/^[A-Za-z_]+\/[A-Za-z_\/]+$/.test(tz)) throw new Error('Invalid timezone format. Use IANA format (e.g. "America/New_York")')
  const data = await timeFetch<TimeResponse>(`/timezone/${tz}`)
  return formatTime(data)
}, { method: 'get_time' })

const getTimeByIp = sg.wrap(async (args: IpInput) => {
  const ipPath = args.ip ? `/${args.ip.trim()}` : ''
  if (args.ip && !/^[\d.:a-fA-F]+$/.test(args.ip.trim())) throw new Error('Invalid IP address format')
  const data = await timeFetch<TimeResponse>(`/ip${ipPath}`)
  return formatTime(data)
}, { method: 'get_time_by_ip' })

const listTimezones = sg.wrap(async () => {
  const data = await timeFetch<string[]>('/timezone')
  return { count: data.length, timezones: data }
}, { method: 'list_timezones' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTime, getTimeByIp, listTimezones }

console.log('settlegrid-timezone-api MCP server ready')
console.log('Methods: get_time, get_time_by_ip, list_timezones')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
