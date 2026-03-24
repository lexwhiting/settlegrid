/**
 * settlegrid-particle — Particle IoT Devices MCP Server
 * Wraps the Particle Cloud API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ParticleDevice {
  id: string
  name: string
  platform_id: number
  product_id: number
  connected: boolean
  last_heard: string
  last_ip_address: string
  status: string
  cellular: boolean
  notes: string
  functions: string[]
  variables: Record<string, string>
}

interface DeviceVariable {
  name: string
  result: string | number | boolean
  coreInfo: {
    deviceID: string
    connected: boolean
    last_heard: string
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.particle.io/v1'
const TOKEN = process.env.PARTICLE_ACCESS_TOKEN
if (!TOKEN) throw new Error('PARTICLE_ACCESS_TOKEN environment variable is required')

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Particle API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateId(id: string): string {
  const trimmed = id.trim()
  if (!trimmed) throw new Error('Device ID or name is required')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'particle' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function list_devices(): Promise<ParticleDevice[]> {
  return sg.wrap('list_devices', async () => {
    return fetchJSON<ParticleDevice[]>('/devices')
  })
}

export async function get_device(id: string): Promise<ParticleDevice> {
  const deviceId = validateId(id)
  return sg.wrap('get_device', async () => {
    return fetchJSON<ParticleDevice>(`/devices/${deviceId}`)
  })
}

export async function get_variable(device_id: string, variable: string): Promise<DeviceVariable> {
  const deviceId = validateId(device_id)
  const varName = variable.trim()
  if (!varName) throw new Error('Variable name is required')
  return sg.wrap('get_variable', async () => {
    return fetchJSON<DeviceVariable>(`/devices/${deviceId}/${varName}`)
  })
}

console.log('settlegrid-particle MCP server loaded')
