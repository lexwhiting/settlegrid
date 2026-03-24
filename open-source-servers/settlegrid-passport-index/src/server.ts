/**
 * settlegrid-passport-index — Passport Power Ranking MCP Server
 *
 * Provides passport strength rankings and visa-free destination counts.
 * Uses the Passport Index API. No API key needed.
 *
 * Methods:
 *   get_passport_rank(country_code)       (1¢)
 *   compare_passports(code_a, code_b)     (1¢)
 *   get_top_passports(limit)              (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetPassportRankInput { country_code: string }
interface ComparePassportsInput { code_a: string; code_b: string }
interface GetTopPassportsInput { limit?: number }

const API_BASE = 'https://api.passportindex.org/passport'
const USER_AGENT = 'settlegrid-passport-index/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Passport Index API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'passport-index',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_passport_rank: { costCents: 1, displayName: 'Get passport ranking' },
      compare_passports: { costCents: 1, displayName: 'Compare two passports' },
      get_top_passports: { costCents: 1, displayName: 'Get top passports' },
    },
  },
})

const getPassportRank = sg.wrap(async (args: GetPassportRankInput) => {
  if (!args.country_code || typeof args.country_code !== 'string') {
    throw new Error('country_code is required (ISO alpha-2 or alpha-3)')
  }
  const code = args.country_code.toUpperCase().trim()
  const data = await apiFetch<Record<string, unknown>>(`/byPassport?passport=${encodeURIComponent(code)}`)
  return { country_code: code, ...data }
}, { method: 'get_passport_rank' })

const comparePassports = sg.wrap(async (args: ComparePassportsInput) => {
  if (!args.code_a || !args.code_b) {
    throw new Error('code_a and code_b are required (ISO alpha-2 or alpha-3)')
  }
  const a = args.code_a.toUpperCase().trim()
  const b = args.code_b.toUpperCase().trim()
  const [dataA, dataB] = await Promise.all([
    apiFetch<Record<string, unknown>>(`/byPassport?passport=${encodeURIComponent(a)}`),
    apiFetch<Record<string, unknown>>(`/byPassport?passport=${encodeURIComponent(b)}`),
  ])
  return { passport_a: { code: a, ...dataA }, passport_b: { code: b, ...dataB } }
}, { method: 'compare_passports' })

const getTopPassports = sg.wrap(async (args: GetTopPassportsInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 50)
  const data = await apiFetch<Record<string, unknown>>('/byRank')
  const items = Array.isArray(data) ? data.slice(0, limit) : [data]
  return { limit, count: items.length, results: items }
}, { method: 'get_top_passports' })

export { getPassportRank, comparePassports, getTopPassports }

console.log('settlegrid-passport-index MCP server ready')
console.log('Methods: get_passport_rank, compare_passports, get_top_passports')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
