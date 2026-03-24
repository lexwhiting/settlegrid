/**
 * settlegrid-visa-requirements — Visa Requirements MCP Server
 *
 * Provides visa requirement data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   check_visa(from, to) — visa requirement (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface VisaInput { from: string; to: string }

const API_BASE = 'https://rough-sun-2523.fly.dev'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'visa-requirements',
  pricing: { defaultCostCents: 1, methods: { check_visa: { costCents: 1, displayName: 'Check Visa' } } },
})

const checkVisa = sg.wrap(async (args: VisaInput) => {
  if (!args.from || !args.to) throw new Error('from and to country codes are required')
  const from = args.from.toUpperCase()
  const to = args.to.toUpperCase()
  try {
    const data = await apiFetch<any>(`/api/${from}/${to}`)
    return { from, to, requirement: data.requirement || data.status || 'unknown', details: data }
  } catch {
    return {
      from, to,
      requirement: 'Unable to determine — check official embassy sources',
      note: 'Visa requirements change frequently. Always verify with official sources.',
    }
  }
}, { method: 'check_visa' })

export { checkVisa }

console.log('settlegrid-visa-requirements MCP server ready')
console.log('Methods: check_visa')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
