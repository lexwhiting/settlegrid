/**
 * settlegrid-this-day — This Day in History MCP Server
 *
 * Methods:
 *   get_today_events()               (1¢)
 *   get_events_on(month, day)        (1¢)
 *   get_today_births()               (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetEventsOnInput { month: number; day: number }

const API_BASE = 'https://byabbe.se/on-this-day'
const USER_AGENT = 'settlegrid-this-day/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`On This Day API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'this-day',
  pricing: { defaultCostCents: 1, methods: {
    get_today_events: { costCents: 1, displayName: 'Get today\'s historical events' },
    get_events_on: { costCents: 1, displayName: 'Get events on a date' },
    get_today_births: { costCents: 1, displayName: 'Get notable births today' },
  }},
})

const getTodayEvents = sg.wrap(async () => {
  const now = new Date()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return await apiFetch<Record<string, unknown>>(`/${m}/${d}/events.json`)
}, { method: 'get_today_events' })

const getEventsOn = sg.wrap(async (args: GetEventsOnInput) => {
  if (!args.month || !args.day) throw new Error('month and day are required')
  if (args.month < 1 || args.month > 12 || args.day < 1 || args.day > 31) throw new Error('Invalid month/day')
  return await apiFetch<Record<string, unknown>>(`/${args.month}/${args.day}/events.json`)
}, { method: 'get_events_on' })

const getTodayBirths = sg.wrap(async () => {
  const now = new Date()
  return await apiFetch<Record<string, unknown>>(`/${now.getMonth() + 1}/${now.getDate()}/births.json`)
}, { method: 'get_today_births' })

export { getTodayEvents, getEventsOn, getTodayBirths }

console.log('settlegrid-this-day MCP server ready')
console.log('Methods: get_today_events, get_events_on, get_today_births')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
