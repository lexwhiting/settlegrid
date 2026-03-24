/**
 * settlegrid-fdic-banks — FDIC Bank Data MCP Server
 *
 * Wraps the FDIC BankFind API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_institutions(search, limit?)  — Search banks     (1¢)
 *   get_financials(certNumber)           — Bank financials  (1¢)
 *   get_failures(limit?)                 — Bank failures    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { search: string; limit?: number }
interface FinancialsInput { certNumber: string }
interface FailuresInput { limit?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://banks.data.fdic.gov/api'
const UA = 'settlegrid-fdic-banks/1.0 (contact@settlegrid.ai)'

async function fdicFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FDIC API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fdic-banks',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_institutions: { costCents: 1, displayName: 'Search Banks' },
      get_financials: { costCents: 1, displayName: 'Bank Financials' },
      get_failures: { costCents: 1, displayName: 'Bank Failures' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchInstitutions = sg.wrap(async (args: SearchInput) => {
  if (!args.search || typeof args.search !== 'string') {
    throw new Error('search is required (bank name)')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const data = await fdicFetch<{ data: Array<Record<string, unknown>>; totals: Record<string, number> }>(
    '/financials',
    { search: args.search.trim(), limit: String(limit), sort_by: 'REPDTE', sort_order: 'DESC' }
  )
  return { query: args.search, count: data.data?.length ?? 0, institutions: data.data ?? [] }
}, { method: 'search_institutions' })

const getFinancials = sg.wrap(async (args: FinancialsInput) => {
  if (!args.certNumber || typeof args.certNumber !== 'string') {
    throw new Error('certNumber is required (FDIC certificate number)')
  }
  const data = await fdicFetch<{ data: Array<Record<string, unknown>> }>(
    '/financials',
    { filters: `CERT:${args.certNumber.trim()}`, limit: '10', sort_by: 'REPDTE', sort_order: 'DESC' }
  )
  return { certNumber: args.certNumber, count: data.data?.length ?? 0, reports: data.data ?? [] }
}, { method: 'get_financials' })

const getFailures = sg.wrap(async (args: FailuresInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const data = await fdicFetch<{ data: Array<Record<string, unknown>> }>(
    '/failures',
    { limit: String(limit), sort_by: 'FAILDATE', sort_order: 'DESC' }
  )
  return { count: data.data?.length ?? 0, failures: data.data ?? [] }
}, { method: 'get_failures' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchInstitutions, getFinancials, getFailures }

console.log('settlegrid-fdic-banks MCP server ready')
console.log('Methods: search_institutions, get_financials, get_failures')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
