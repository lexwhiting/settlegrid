/**
 * settlegrid-financial-modeling — Financial Modeling Prep MCP Server
 *
 * Wraps the Financial Modeling Prep API with SettleGrid billing.
 * Requires FMP_API_KEY environment variable.
 *
 * Methods:
 *   get_profile(symbol)            — Company profile       (2¢)
 *   get_income_statement(symbol)   — Income statement      (2¢)
 *   get_dcf(symbol)                — DCF valuation         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SymbolInput { symbol: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://financialmodelingprep.com/api/v3'

function getKey(): string {
  const k = process.env.FMP_API_KEY
  if (!k) throw new Error('FMP_API_KEY environment variable is required')
  return k
}

async function fmpFetch<T>(path: string): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('apikey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-financial-modeling/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FMP API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'financial-modeling',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_profile: { costCents: 2, displayName: 'Company Profile' },
      get_income_statement: { costCents: 2, displayName: 'Income Statement' },
      get_dcf: { costCents: 2, displayName: 'DCF Valuation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProfile = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fmpFetch<Array<Record<string, unknown>>>(`/profile/${encodeURIComponent(args.symbol.toUpperCase().trim())}`)
  return data[0] ?? null
}, { method: 'get_profile' })

const getIncomeStatement = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fmpFetch<Array<Record<string, unknown>>>(`/income-statement/${encodeURIComponent(args.symbol.toUpperCase().trim())}?limit=5`)
  return { symbol: args.symbol.toUpperCase(), count: data.length, statements: data }
}, { method: 'get_income_statement' })

const getDcf = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fmpFetch<Array<Record<string, unknown>>>(`/discounted-cash-flow/${encodeURIComponent(args.symbol.toUpperCase().trim())}`)
  return data[0] ?? null
}, { method: 'get_dcf' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProfile, getIncomeStatement, getDcf }

console.log('settlegrid-financial-modeling MCP server ready')
console.log('Methods: get_profile, get_income_statement, get_dcf')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
