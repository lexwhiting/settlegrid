/**
 * settlegrid-visual-crossing — Visual Crossing Weather MCP Server
 *
 * Wraps the Visual Crossing Weather API with SettleGrid billing.
 * Requires VISUAL_CROSSING_API_KEY environment variable.
 *
 * Methods:
 *   get_timeline(location)                   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTimelineInput {
  location: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
const USER_AGENT = 'settlegrid-visual-crossing/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.VISUAL_CROSSING_API_KEY
  if (!key) throw new Error('VISUAL_CROSSING_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  url.searchParams.set('key', getApiKey())
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Visual Crossing Weather API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'visual-crossing',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_timeline: { costCents: 2, displayName: 'Get weather timeline for a location' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTimeline = sg.wrap(async (args: GetTimelineInput) => {
  if (!args.location || typeof args.location !== 'string') {
    throw new Error('location is required (city name or lat,lon)')
  }

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.location))}`, {
    params,
  })

  return data
}, { method: 'get_timeline' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTimeline }

console.log('settlegrid-visual-crossing MCP server ready')
console.log('Methods: get_timeline')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
