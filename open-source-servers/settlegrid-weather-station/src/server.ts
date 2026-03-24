/**
 * settlegrid-weather-station — Personal Weather Station MCP Server
 *
 * Methods:
 *   get_devices()                    (1¢)
 *   get_device_data(mac_address)     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetDeviceDataInput { mac_address: string; limit?: number }

const API_BASE = 'https://rt.ambientweather.net/v1'
const USER_AGENT = 'settlegrid-weather-station/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const appKey = process.env.AMBIENT_APP_KEY || ''
  const apiKey = process.env.AMBIENT_API_KEY || ''
  if (!appKey || !apiKey) throw new Error('AMBIENT_APP_KEY and AMBIENT_API_KEY are required')
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('applicationKey', appKey)
  url.searchParams.set('apiKey', apiKey)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Ambient Weather API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'weather-station',
  pricing: { defaultCostCents: 1, methods: {
    get_devices: { costCents: 1, displayName: 'List weather stations' },
    get_device_data: { costCents: 1, displayName: 'Get station readings' },
  }},
})

const getDevices = sg.wrap(async () => {
  return await apiFetch<Record<string, unknown>>('/devices')
}, { method: 'get_devices' })

const getDeviceData = sg.wrap(async (args: GetDeviceDataInput) => {
  if (!args.mac_address) throw new Error('mac_address is required')
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 288)
  return await apiFetch<Record<string, unknown>>(`/devices/${encodeURIComponent(args.mac_address)}`, { limit: String(limit) })
}, { method: 'get_device_data' })

export { getDevices, getDeviceData }

console.log('settlegrid-weather-station MCP server ready')
console.log('Methods: get_devices, get_device_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
