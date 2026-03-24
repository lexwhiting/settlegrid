/**
 * settlegrid-fortnite — Fortnite Stats MCP Server
 *
 * Methods:
 *   get_player_stats(name)           (1¢)
 *   get_shop()                       (1¢)
 *   get_news()                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlayerInput { name: string; platform?: string }

const API_BASE = 'https://fortnite-api.com/v2'
const USER_AGENT = 'settlegrid-fortnite/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const key = process.env.FORTNITE_API_KEY || ''
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/json' }
  if (key) headers['Authorization'] = key
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) throw new Error(`Fortnite API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'fortnite',
  pricing: { defaultCostCents: 1, methods: {
    get_player_stats: { costCents: 1, displayName: 'Get player stats' },
    get_shop: { costCents: 1, displayName: 'Get item shop' },
    get_news: { costCents: 1, displayName: 'Get game news' },
  }},
})

const getPlayerStats = sg.wrap(async (args: PlayerInput) => {
  if (!args.name) throw new Error('name is required')
  return await apiFetch<Record<string, unknown>>('/stats/br/v2', { name: args.name, ...(args.platform ? { accountType: args.platform } : {}) })
}, { method: 'get_player_stats' })

const getShop = sg.wrap(async () => {
  return await apiFetch<Record<string, unknown>>('/shop/br/combined')
}, { method: 'get_shop' })

const getNews = sg.wrap(async () => {
  return await apiFetch<Record<string, unknown>>('/news/br')
}, { method: 'get_news' })

export { getPlayerStats, getShop, getNews }

console.log('settlegrid-fortnite MCP server ready')
console.log('Methods: get_player_stats, get_shop, get_news')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
