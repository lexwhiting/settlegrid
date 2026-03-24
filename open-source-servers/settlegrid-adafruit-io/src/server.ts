/**
 * settlegrid-adafruit-io — Adafruit IO Feeds MCP Server
 * Wraps the Adafruit IO API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Feed {
  id: number
  key: string
  name: string
  description: string
  unit_type: string
  unit_symbol: string
  last_value: string
  status: string
  created_at: string
  updated_at: string
}

interface DataPoint {
  id: string
  value: string
  feed_id: number
  feed_key: string
  created_at: string
  created_epoch: number
  expiration: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://io.adafruit.com/api/v2'
const IO_KEY = process.env.ADAFRUIT_IO_KEY
if (!IO_KEY) throw new Error('ADAFRUIT_IO_KEY environment variable is required')

// ─── Helpers ────────────────────────────────────────────────────────────────
async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'X-AIO-Key': IO_KEY! },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Adafruit IO API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

function validateStr(val: string, label: string): string {
  const trimmed = val.trim()
  if (!trimmed) throw new Error(`${label} is required`)
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'adafruit-io' })

// ─── Handlers ───────────────────────────────────────────────────────────────
export async function get_feed(username: string, feed: string): Promise<Feed> {
  const user = validateStr(username, 'Username')
  const feedKey = validateStr(feed, 'Feed key')
  return sg.wrap('get_feed', async () => {
    return fetchJSON<Feed>(`/${user}/feeds/${feedKey}`)
  })
}

export async function get_data(username: string, feed: string, limit?: number): Promise<DataPoint[]> {
  const user = validateStr(username, 'Username')
  const feedKey = validateStr(feed, 'Feed key')
  const lim = limit ?? 10
  if (lim < 1 || lim > 1000) throw new Error('Limit must be between 1 and 1000')
  return sg.wrap('get_data', async () => {
    return fetchJSON<DataPoint[]>(`/${user}/feeds/${feedKey}/data?limit=${lim}`)
  })
}

export async function list_feeds(username: string): Promise<Feed[]> {
  const user = validateStr(username, 'Username')
  return sg.wrap('list_feeds', async () => {
    return fetchJSON<Feed[]>(`/${user}/feeds`)
  })
}

console.log('settlegrid-adafruit-io MCP server loaded')
