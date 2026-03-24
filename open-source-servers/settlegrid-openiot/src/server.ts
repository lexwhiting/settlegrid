/**
 * settlegrid-openiot — Open IoT Platform MCP Server
 * Wraps the ThingsBoard demo API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TbDevice {
  id: { id: string; entityType: string }
  name: string
  type: string
  label: string
  createdTime: number
  additionalInfo: Record<string, unknown>
}

interface TbDeviceList {
  data: TbDevice[]
  totalPages: number
  totalElements: number
}

interface TelemetryValue {
  ts: number
  value: string
}

interface AttributeKv {
  key: string
  value: unknown
  lastUpdateTs: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://demo.thingsboard.io/api'
const DEMO_TOKEN_URL = `${API}/auth/login`
let authToken: string | null = null

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getAuthToken(): Promise<string> {
  if (authToken) return authToken
  const res = await fetch(DEMO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'tenant@thingsboard.org', password: 'tenant' }),
  })
  if (!res.ok) throw new Error(`ThingsBoard auth failed: ${res.status}`)
  const data = await res.json() as { token: string }
  authToken = data.token
  return authToken
}

async function fetchJSON<T>(path: string): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`${API}${path}`, {
    headers: { 'X-Authorization': `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ThingsBoard API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateUUID(id: string): string {
  const trimmed = id.trim()
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) throw new Error(`Invalid UUID: ${id}`)
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'openiot' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function list_devices(type?: string): Promise<TbDevice[]> {
  return sg.wrap('list_devices', async () => {
    const params = new URLSearchParams({ pageSize: '20', page: '0' })
    if (type) params.set('type', type.trim())
    const result = await fetchJSON<TbDeviceList>(`/tenant/devices?${params}`)
    return result.data
  })
}

export async function get_telemetry(device_id: string, keys?: string): Promise<Record<string, TelemetryValue[]>> {
  const id = validateUUID(device_id)
  return sg.wrap('get_telemetry', async () => {
    const params = new URLSearchParams()
    if (keys) params.set('keys', keys.trim())
    return fetchJSON<Record<string, TelemetryValue[]>>(
      `/plugins/telemetry/DEVICE/${id}/values/timeseries?${params}`
    )
  })
}

export async function get_attributes(device_id: string): Promise<AttributeKv[]> {
  const id = validateUUID(device_id)
  return sg.wrap('get_attributes', async () => {
    return fetchJSON<AttributeKv[]>(`/plugins/telemetry/DEVICE/${id}/values/attributes`)
  })
}

console.log('settlegrid-openiot MCP server loaded')
