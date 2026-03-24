/**
 * settlegrid-minecraft — Minecraft Server Status MCP Server
 *
 * Check Minecraft server status, player counts, and info.
 * Uses mcsrvstat.us API. No API key needed.
 *
 * Methods:
 *   get_server_status(address)       (1¢)
 *   get_server_icon(address)         (1¢)
 *   get_bedrock_status(address)      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ServerInput { address: string }

const API_BASE = 'https://api.mcsrvstat.us/3'
const USER_AGENT = 'settlegrid-minecraft/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`MCSRVSTAT API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'minecraft',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_server_status: { costCents: 1, displayName: 'Get Java server status' },
      get_server_icon: { costCents: 1, displayName: 'Get server icon' },
      get_bedrock_status: { costCents: 1, displayName: 'Get Bedrock server status' },
    },
  },
})

const getServerStatus = sg.wrap(async (args: ServerInput) => {
  if (!args.address) throw new Error('address is required (e.g. mc.hypixel.net)')
  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(args.address)}`)
  return { address: args.address, ...data }
}, { method: 'get_server_status' })

const getServerIcon = sg.wrap(async (args: ServerInput) => {
  if (!args.address) throw new Error('address is required')
  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(args.address)}`)
  const icon = (data as Record<string, unknown>).icon || null
  return { address: args.address, icon }
}, { method: 'get_server_icon' })

const getBedrockStatus = sg.wrap(async (args: ServerInput) => {
  if (!args.address) throw new Error('address is required')
  const res = await fetch(`https://api.mcsrvstat.us/bedrock/3/${encodeURIComponent(args.address)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`MCSRVSTAT API ${res.status}`)
  const data = await res.json()
  return { address: args.address, platform: 'bedrock', ...data }
}, { method: 'get_bedrock_status' })

export { getServerStatus, getServerIcon, getBedrockStatus }

console.log('settlegrid-minecraft MCP server ready')
console.log('Methods: get_server_status, get_server_icon, get_bedrock_status')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
