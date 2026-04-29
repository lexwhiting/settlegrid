/**
 * settlegrid-microfinance — Microfinance Data MCP Server
 *
 * Microfinance Data tools with SettleGrid billing.
 *
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const INSTITUTIONS = [
  { name: 'Grameen Bank', country: 'Bangladesh', borrowers: 9400000, avg_loan_usd: 271, women_pct: 97, founded: 1983 },
  { name: 'BRAC', country: 'Bangladesh', borrowers: 7800000, avg_loan_usd: 185, women_pct: 84, founded: 1972 },
  { name: 'BancoSol', country: 'Bolivia', borrowers: 1200000, avg_loan_usd: 2100, women_pct: 51, founded: 1992 },
  { name: 'ASA', country: 'Bangladesh', borrowers: 6200000, avg_loan_usd: 180, women_pct: 90, founded: 1978 },
  { name: 'SKS Microfinance', country: 'India', borrowers: 5800000, avg_loan_usd: 210, women_pct: 100, founded: 1998 },
  { name: 'Compartamos Banco', country: 'Mexico', borrowers: 2900000, avg_loan_usd: 450, women_pct: 90, founded: 1990 },
]

const sg = settlegrid.init({
  toolSlug: 'microfinance',
  pricing: { defaultCostCents: 2, methods: {
    get_institution: { costCents: 2, displayName: 'Get Institution' },
    list_institutions: { costCents: 2, displayName: 'List Institutions' },
    get_global_stats: { costCents: 2, displayName: 'Get Global Stats' },
  }},
})

const getInstitution = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error('name required')
  const inst = INSTITUTIONS.find(i => i.name.toLowerCase().includes(args.name.toLowerCase()))
  if (!inst) throw new Error(`Not found. Available: ${INSTITUTIONS.map(i => i.name).join(', ')}`)
  return inst
}, { method: 'get_institution' })

const listInstitutions = sg.wrap(async (args: { country?: string }) => {
  let results = [...INSTITUTIONS]
  if (args.country) results = results.filter(i => i.country.toLowerCase().includes(args.country!.toLowerCase()))
  return { count: results.length, institutions: results }
}, { method: 'list_institutions' })

const getGlobalStats = sg.wrap(async (_a: Record<string, never>) => {
  return { total_borrowers_million: 140, total_institutions: 10000, avg_loan_size_usd: 500, women_borrowers_pct: 80, global_portfolio_billion_usd: 124, countries_served: 100 }
}, { method: 'get_global_stats' })

export { getInstitution, listInstitutions, getGlobalStats }
console.log('settlegrid-microfinance MCP server ready | Powered by SettleGrid')
