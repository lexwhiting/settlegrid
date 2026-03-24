/**
 * settlegrid-bored-api — Bored Activity MCP Server
 *
 * Wraps Bored API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_activity(type?, participants?) — random activity (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ActivityInput { type?: string; participants?: number }

const API_BASE = 'https://bored-api.appbrewery.com/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'bored-api',
  pricing: { defaultCostCents: 1, methods: { get_activity: { costCents: 1, displayName: 'Get Activity' } } },
})

const getActivity = sg.wrap(async (args: ActivityInput) => {
  let params: string[] = []
  if (args.type) params.push(`type=${args.type}`)
  if (args.participants) params.push(`participants=${args.participants}`)
  const query = params.length ? `?${params.join('&')}` : ''
  const data = await apiFetch<any>(`/activity${query}`)
  return {
    activity: data.activity, type: data.type, participants: data.participants,
    price: data.price, accessibility: data.accessibility, key: data.key,
  }
}, { method: 'get_activity' })

export { getActivity }

console.log('settlegrid-bored-api MCP server ready')
console.log('Methods: get_activity')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
