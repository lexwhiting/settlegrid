/**
 * settlegrid-carbon — Carbon MCP Server
 *
 * Wraps the Carbon API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   create_image(code)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateImageInput {
  code: string
  language?: string
  theme?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://carbonara-42.herokuapp.com/api'
const USER_AGENT = 'settlegrid-carbon/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Carbon API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'carbon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_image: { costCents: 1, displayName: 'Generate a code snippet image' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createImage = sg.wrap(async (args: CreateImageInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required (code to render)')
  }

  const body: Record<string, unknown> = {}
  body['code'] = args.code
  if (args.language !== undefined) body['language'] = args.language
  if (args.theme !== undefined) body['theme'] = args.theme

  const data = await apiFetch<Record<string, unknown>>('/cook', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'create_image' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createImage }

console.log('settlegrid-carbon MCP server ready')
console.log('Methods: create_image')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
