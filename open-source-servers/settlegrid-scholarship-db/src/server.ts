/**
 * settlegrid-scholarship-db — Scholarship Database MCP Server
 *
 * Scholarship Database tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const SCHOLARSHIPS: Array<{ name: string; amount_usd: number; eligibility: string; deadline_month: number; field: string; country: string; renewable: boolean }> = [
  { name: 'Fulbright Program', amount_usd: 50000, eligibility: 'US citizens, graduate', deadline_month: 10, field: 'All fields', country: 'US', renewable: false },
  { name: 'Rhodes Scholarship', amount_usd: 75000, eligibility: 'Outstanding academic achievement', deadline_month: 10, field: 'All fields', country: 'UK', renewable: true },
  { name: 'Chevening Scholarship', amount_usd: 45000, eligibility: 'International, leadership potential', deadline_month: 11, field: 'All fields', country: 'UK', renewable: false },
  { name: 'DAAD Scholarship', amount_usd: 18000, eligibility: 'International, graduate', deadline_month: 10, field: 'All fields', country: 'Germany', renewable: true },
  { name: 'Gates Cambridge', amount_usd: 60000, eligibility: 'Non-UK, outstanding academic', deadline_month: 12, field: 'All fields', country: 'UK', renewable: true },
  { name: 'Erasmus Mundus', amount_usd: 24000, eligibility: 'International, master\'s', deadline_month: 1, field: 'Various', country: 'EU', renewable: false },
  { name: 'Australia Awards', amount_usd: 40000, eligibility: 'Developing countries', deadline_month: 4, field: 'All fields', country: 'Australia', renewable: true },
  { name: 'Schwarzman Scholars', amount_usd: 70000, eligibility: '18-28, bachelor\'s degree', deadline_month: 9, field: 'Global affairs', country: 'China', renewable: false },
]

const sg = settlegrid.init({ toolSlug: 'scholarship-db', pricing: { defaultCostCents: 2, methods: {
  search_scholarships: { costCents: 2, displayName: 'Search Scholarships' },
  list_scholarships: { costCents: 2, displayName: 'List All' },
}}})

const searchScholarships = sg.wrap(async (args: { field?: string; country?: string; min_amount?: number }) => {
  let results = [...SCHOLARSHIPS]
  if (args.field) results = results.filter(s => s.field.toLowerCase().includes(args.field!.toLowerCase()))
  if (args.country) results = results.filter(s => s.country.toLowerCase().includes(args.country!.toLowerCase()))
  if (args.min_amount) results = results.filter(s => s.amount_usd >= args.min_amount!)
  return { results, count: results.length }
}, { method: 'search_scholarships' })

const listScholarships = sg.wrap(async (_a: Record<string, never>) => {
  return { scholarships: SCHOLARSHIPS, count: SCHOLARSHIPS.length, total_value: SCHOLARSHIPS.reduce((s, sc) => s + sc.amount_usd, 0) }
}, { method: 'list_scholarships' })

export { searchScholarships, listScholarships }
console.log('settlegrid-scholarship-db MCP server ready | Powered by SettleGrid')
