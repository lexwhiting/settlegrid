/**
 * settlegrid-air-quality-indoor — Indoor Air Quality MCP Server
 *
 * Methods:
 *   get_devices()                    (1¢)
 *   get_air_data(device_id)          (1¢)
 *   get_score(device_id)             (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DeviceInput { device_id: string }

const API_BASE = 'https://developer-apis.awair.is/v1'
const USER_AGENT = 'settlegrid-air-quality-indoor/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const token = process.env.AWAIR_TOKEN || ''
  if (!token) throw new Error('AWAIR_TOKEN is required')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Awair API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'air-quality-indoor',
  pricing: { defaultCostCents: 1, methods: {
    get_devices: { costCents: 1, displayName: 'List air quality devices' },
    get_air_data: { costCents: 1, displayName: 'Get air quality data' },
    get_score: { costCents: 1, displayName: 'Get air quality score' },
  }},
})

const getDevices = sg.wrap(async () => {
  return await apiFetch<Record<string, unknown>>('/users/self/devices')
}, { method: 'get_devices' })

const getAirData = sg.wrap(async (args: DeviceInput) => {
  if (!args.device_id) throw new Error('device_id is required')
  return await apiFetch<Record<string, unknown>>(
    `/users/self/devices/${encodeURIComponent(args.device_id)}/air-data/latest`
  )
}, { method: 'get_air_data' })

const getScore = sg.wrap(async (args: DeviceInput) => {
  if (!args.device_id) throw new Error('device_id is required')
  return await apiFetch<Record<string, unknown>>(
    `/users/self/devices/${encodeURIComponent(args.device_id)}/score`
  )
}, { method: 'get_score' })

export { getDevices, getAirData, getScore }

console.log('settlegrid-air-quality-indoor MCP server ready')
console.log('Methods: get_devices, get_air_data, get_score')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
