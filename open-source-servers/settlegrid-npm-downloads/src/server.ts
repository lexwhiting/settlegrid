/**
 * settlegrid-npm-downloads — npm Downloads MCP Server
 *
 * Wraps the npm Downloads API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_downloads(package)                   (1¢)
 *   get_range(package, start, end)           (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDownloadsInput {
  package: string
}

interface GetRangeInput {
  package: string
  start: string
  end: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.npmjs.org'
const USER_AGENT = 'settlegrid-npm-downloads/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`npm Downloads API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'npm-downloads',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_downloads: { costCents: 1, displayName: 'Get download counts for a package' },
      get_range: { costCents: 2, displayName: 'Get daily download counts over a date range' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDownloads = sg.wrap(async (args: GetDownloadsInput) => {
  if (!args.package || typeof args.package !== 'string') {
    throw new Error('package is required (npm package name)')
  }

  const params: Record<string, string> = {}
  params['package'] = String(args.package)

  const data = await apiFetch<Record<string, unknown>>(`/downloads/point/last-month/${encodeURIComponent(String(args.package))}`, {
    params,
  })

  return data
}, { method: 'get_downloads' })

const getRange = sg.wrap(async (args: GetRangeInput) => {
  if (!args.package || typeof args.package !== 'string') {
    throw new Error('package is required (npm package name)')
  }
  if (!args.start || typeof args.start !== 'string') {
    throw new Error('start is required (start date yyyy-mm-dd)')
  }
  if (!args.end || typeof args.end !== 'string') {
    throw new Error('end is required (end date yyyy-mm-dd)')
  }

  const params: Record<string, string> = {}
  params['package'] = String(args.package)
  params['start'] = String(args.start)
  params['end'] = String(args.end)

  const data = await apiFetch<Record<string, unknown>>(`/downloads/range/${encodeURIComponent(String(args.start))}:${encodeURIComponent(String(args.end))}/${encodeURIComponent(String(args.package))}`, {
    params,
  })

  return data
}, { method: 'get_range' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDownloads, getRange }

console.log('settlegrid-npm-downloads MCP server ready')
console.log('Methods: get_downloads, get_range')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
