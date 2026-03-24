/**
 * settlegrid-thingspeak — ThingSpeak IoT Data MCP Server
 * Wraps the ThingSpeak API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ChannelFeed {
  channel: {
    id: number
    name: string
    description: string
    field1?: string
    field2?: string
    field3?: string
    field4?: string
    created_at: string
    updated_at: string
    last_entry_id: number
  }
  feeds: Array<{
    created_at: string
    entry_id: number
    field1?: string
    field2?: string
    field3?: string
    field4?: string
  }>
}

interface PublicChannel {
  id: number
  name: string
  description: string
  tags: Array<{ name: string }>
  last_entry_id: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.thingspeak.com'
const API_KEY = process.env.THINGSPEAK_API_KEY || ''

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ThingSpeak API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateField(field: number): void {
  if (field < 1 || field > 8 || !Number.isInteger(field)) {
    throw new Error('Field must be an integer between 1 and 8')
  }
}

function validateResults(results?: number): number {
  if (results === undefined) return 10
  if (results < 1 || results > 8000) throw new Error('Results must be between 1 and 8000')
  return results
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'thingspeak' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_channel(id: number, results?: number): Promise<ChannelFeed> {
  if (!id || typeof id !== 'number') throw new Error('Channel ID is required and must be a number')
  const limit = validateResults(results)
  return sg.wrap('get_channel', async () => {
    const params = new URLSearchParams({ results: String(limit) })
    if (API_KEY) params.set('api_key', API_KEY)
    return fetchJSON<ChannelFeed>(`${API}/channels/${id}/feeds.json?${params}`)
  })
}

export async function get_field(channel_id: number, field: number, results?: number): Promise<ChannelFeed> {
  if (!channel_id || typeof channel_id !== 'number') throw new Error('Channel ID is required')
  validateField(field)
  const limit = validateResults(results)
  return sg.wrap('get_field', async () => {
    const params = new URLSearchParams({ results: String(limit) })
    if (API_KEY) params.set('api_key', API_KEY)
    return fetchJSON<ChannelFeed>(`${API}/channels/${channel_id}/fields/${field}.json?${params}`)
  })
}

export async function list_public(tag?: string): Promise<PublicChannel[]> {
  return sg.wrap('list_public', async () => {
    const params = new URLSearchParams()
    if (tag) params.set('tag', tag.trim())
    return fetchJSON<PublicChannel[]>(`${API}/channels/public.json?${params}`)
  })
}

console.log('settlegrid-thingspeak MCP server loaded')
