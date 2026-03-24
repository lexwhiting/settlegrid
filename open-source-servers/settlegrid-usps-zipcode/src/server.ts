/**
 * settlegrid-usps-zipcode — Zippopotamus MCP Server
 *
 * Wraps the Zippopotamus API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   lookup_zip(country, code)                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupZipInput {
  country: string
  code: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.zippopotam.us'
const USER_AGENT = 'settlegrid-usps-zipcode/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Zippopotamus API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usps-zipcode',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_zip: { costCents: 1, displayName: 'Get location info for a zip/postal code' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupZip = sg.wrap(async (args: LookupZipInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (country code (e.g. us, de, fr))')
  }
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required (zip/postal code)')
  }

  const params: Record<string, string> = {}
  params['country'] = String(args.country)
  params['code'] = String(args.code)

  const data = await apiFetch<Record<string, unknown>>(`/${encodeURIComponent(String(args.country))}/${encodeURIComponent(String(args.code))}`, {
    params,
  })

  return data
}, { method: 'lookup_zip' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupZip }

console.log('settlegrid-usps-zipcode MCP server ready')
console.log('Methods: lookup_zip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
