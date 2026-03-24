/**
 * settlegrid-protein-data-bank — Protein Data Bank MCP Server
 *
 * Wraps the Protein Data Bank API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_entry(entryId)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetEntryInput {
  entryId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.rcsb.org/rest/v1/core'
const USER_AGENT = 'settlegrid-protein-data-bank/1.0 (contact@settlegrid.ai)'

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
    throw new Error(`Protein Data Bank API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'protein-data-bank',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_entry: { costCents: 1, displayName: 'Get PDB entry details by ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEntry = sg.wrap(async (args: GetEntryInput) => {
  if (!args.entryId || typeof args.entryId !== 'string') {
    throw new Error('entryId is required (pdb entry id (e.g. 4hhb))')
  }

  const params: Record<string, string> = {}
  params['entryId'] = String(args.entryId)

  const data = await apiFetch<Record<string, unknown>>(`/entry/${encodeURIComponent(String(args.entryId))}`, {
    params,
  })

  return data
}, { method: 'get_entry' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEntry }

console.log('settlegrid-protein-data-bank MCP server ready')
console.log('Methods: get_entry')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
