/**
 * settlegrid-home-assistant — Home Automation MCP Server
 *
 * Methods:
 *   get_states()                     (1¢)
 *   get_entity_state(entity_id)      (1¢)
 *   call_service(domain, service, entity_id) (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetEntityInput { entity_id: string }
interface CallServiceInput { domain: string; service: string; entity_id: string }

const USER_AGENT = 'settlegrid-home-assistant/1.0 (contact@settlegrid.ai)'

function getConfig() {
  const url = process.env.HA_URL || ''
  const token = process.env.HA_TOKEN || ''
  if (!url || !token) throw new Error('HA_URL and HA_TOKEN are required')
  return { url: url.replace(/\/$/, ''), token }
}

async function haFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const { url, token } = getConfig()
  const opts: RequestInit = {
    method,
    headers: { 'User-Agent': USER_AGENT, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${url}/api${path}`, opts)
  if (!res.ok) throw new Error(`Home Assistant API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'home-assistant',
  pricing: { defaultCostCents: 1, methods: {
    get_states: { costCents: 1, displayName: 'Get all entity states' },
    get_entity_state: { costCents: 1, displayName: 'Get entity state' },
    call_service: { costCents: 2, displayName: 'Call a service' },
  }},
})

const getStates = sg.wrap(async () => {
  const data = await haFetch<unknown[]>('/states')
  const items = Array.isArray(data) ? data.slice(0, 100) : [data]
  return { count: items.length, states: items }
}, { method: 'get_states' })

const getEntityState = sg.wrap(async (args: GetEntityInput) => {
  if (!args.entity_id) throw new Error('entity_id is required')
  return await haFetch<Record<string, unknown>>(`/states/${encodeURIComponent(args.entity_id)}`)
}, { method: 'get_entity_state' })

const callService = sg.wrap(async (args: CallServiceInput) => {
  if (!args.domain || !args.service || !args.entity_id) throw new Error('domain, service, and entity_id are required')
  return await haFetch<Record<string, unknown>>(
    `/services/${encodeURIComponent(args.domain)}/${encodeURIComponent(args.service)}`,
    'POST',
    { entity_id: args.entity_id }
  )
}, { method: 'call_service' })

export { getStates, getEntityState, callService }

console.log('settlegrid-home-assistant MCP server ready')
console.log('Methods: get_states, get_entity_state, call_service')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
