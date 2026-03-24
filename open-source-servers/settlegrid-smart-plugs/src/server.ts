/**
 * settlegrid-smart-plugs — Smart Device Status MCP Server
 *
 * Methods:
 *   get_devices()                    (1¢)
 *   get_device_status(device_id)     (1¢)
 *   toggle_device(device_id)         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DeviceInput { device_id: string }

const API_BASE = 'https://openapi.tuyaus.com/v1.0'
const USER_AGENT = 'settlegrid-smart-plugs/1.0 (contact@settlegrid.ai)'

let accessToken: string | null = null

async function getToken(): Promise<string> {
  if (accessToken) return accessToken
  const clientId = process.env.TUYA_CLIENT_ID || ''
  const clientSecret = process.env.TUYA_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) throw new Error('TUYA_CLIENT_ID and TUYA_CLIENT_SECRET are required')
  const timestamp = Date.now().toString()
  const sign = clientId + timestamp
  const res = await fetch(`${API_BASE}/token?grant_type=1`, {
    headers: { client_id: clientId, sign, t: timestamp, sign_method: 'HMAC-SHA256' },
  })
  if (!res.ok) throw new Error(`Tuya auth failed: ${res.status}`)
  const data = await res.json() as { result: { access_token: string } }
  accessToken = data.result.access_token
  return accessToken
}

async function apiFetch<T>(path: string, method = 'GET'): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'User-Agent': USER_AGENT, access_token: token, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Tuya API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'smart-plugs',
  pricing: { defaultCostCents: 1, methods: {
    get_devices: { costCents: 1, displayName: 'List smart devices' },
    get_device_status: { costCents: 1, displayName: 'Get device status' },
    toggle_device: { costCents: 2, displayName: 'Toggle device on/off' },
  }},
})

const getDevices = sg.wrap(async () => {
  return await apiFetch<Record<string, unknown>>('/devices')
}, { method: 'get_devices' })

const getDeviceStatus = sg.wrap(async (args: DeviceInput) => {
  if (!args.device_id) throw new Error('device_id is required')
  return await apiFetch<Record<string, unknown>>(`/devices/${encodeURIComponent(args.device_id)}/status`)
}, { method: 'get_device_status' })

const toggleDevice = sg.wrap(async (args: DeviceInput) => {
  if (!args.device_id) throw new Error('device_id is required')
  return await apiFetch<Record<string, unknown>>(`/devices/${encodeURIComponent(args.device_id)}/commands`, 'POST')
}, { method: 'toggle_device' })

export { getDevices, getDeviceStatus, toggleDevice }

console.log('settlegrid-smart-plugs MCP server ready')
console.log('Methods: get_devices, get_device_status, toggle_device')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
