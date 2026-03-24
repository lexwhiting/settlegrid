/**
 * settlegrid-timezone-data — TimeZone Data MCP Server
 *
 * Wraps WorldTimeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_timezone(timezone) — current time (1¢)
 *   list_timezones() — all timezones (1¢)
 *   get_time_by_ip(ip) — timezone by IP (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TzInput { timezone: string }
interface IpInput { ip: string }

const API_BASE = 'https://worldtimeapi.org/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'timezone-data',
  pricing: { defaultCostCents: 1, methods: { get_timezone: { costCents: 1, displayName: 'Get Timezone' }, list_timezones: { costCents: 1, displayName: 'List Timezones' }, get_time_by_ip: { costCents: 1, displayName: 'Time By IP' } } },
})

const getTimezone = sg.wrap(async (args: TzInput) => {
  if (!args.timezone) throw new Error('timezone is required')
  const data = await apiFetch<any>(`/timezone/${args.timezone}`)
  return {
    timezone: data.timezone, datetime: data.datetime, utc_offset: data.utc_offset,
    abbreviation: data.abbreviation, day_of_week: data.day_of_week,
    day_of_year: data.day_of_year, week_number: data.week_number, dst: data.dst,
  }
}, { method: 'get_timezone' })

const listTimezones = sg.wrap(async () => {
  const data = await apiFetch<string[]>('/timezone')
  return { count: data.length, timezones: data }
}, { method: 'list_timezones' })

const getTimeByIp = sg.wrap(async (args: IpInput) => {
  if (!args.ip) throw new Error('ip is required')
  const data = await apiFetch<any>(`/ip/${args.ip}`)
  return {
    ip: args.ip, timezone: data.timezone, datetime: data.datetime,
    utc_offset: data.utc_offset, abbreviation: data.abbreviation,
  }
}, { method: 'get_time_by_ip' })

export { getTimezone, listTimezones, getTimeByIp }

console.log('settlegrid-timezone-data MCP server ready')
console.log('Methods: get_timezone, list_timezones, get_time_by_ip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
