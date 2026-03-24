/**
 * settlegrid-osrs — Old School RuneScape Data MCP Server
 *
 * Methods:
 *   get_hiscores(username)           (1¢)
 *   get_ge_price(item_id)            (1¢)
 *   get_ge_latest()                  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HiscoresInput { username: string }
interface GePriceInput { item_id: string }
interface GeLatestInput { limit?: number }

const HISCORES_API = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json'
const GE_API = 'https://prices.runescape.wiki/api/v1/osrs'
const USER_AGENT = 'settlegrid-osrs/1.0 (contact@settlegrid.ai)'

const sg = settlegrid.init({
  toolSlug: 'osrs',
  pricing: { defaultCostCents: 1, methods: {
    get_hiscores: { costCents: 1, displayName: 'Get player hiscores' },
    get_ge_price: { costCents: 1, displayName: 'Get GE item price' },
    get_ge_latest: { costCents: 1, displayName: 'Get latest GE prices' },
  }},
})

const getHiscores = sg.wrap(async (args: HiscoresInput) => {
  if (!args.username) throw new Error('username is required')
  const res = await fetch(`${HISCORES_API}?player=${encodeURIComponent(args.username)}`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`OSRS Hiscores ${res.status}`)
  const data = await res.json()
  return { username: args.username, ...data }
}, { method: 'get_hiscores' })

const getGePrice = sg.wrap(async (args: GePriceInput) => {
  if (!args.item_id) throw new Error('item_id is required')
  const res = await fetch(`${GE_API}/latest?id=${encodeURIComponent(args.item_id)}`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`OSRS GE API ${res.status}`)
  const data = await res.json()
  return { item_id: args.item_id, ...data }
}, { method: 'get_ge_price' })

const getGeLatest = sg.wrap(async (args: GeLatestInput) => {
  const res = await fetch(`${GE_API}/latest`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`OSRS GE API ${res.status}`)
  const data = await res.json() as { data: Record<string, unknown> }
  const entries = Object.entries(data.data || {}).slice(0, args.limit ?? 50)
  return { count: entries.length, prices: Object.fromEntries(entries) }
}, { method: 'get_ge_latest' })

export { getHiscores, getGePrice, getGeLatest }

console.log('settlegrid-osrs MCP server ready')
console.log('Methods: get_hiscores, get_ge_price, get_ge_latest')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
