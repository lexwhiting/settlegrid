/**
 * settlegrid-indeed — Adzuna Job Search MCP Server
 *
 * Wraps the Adzuna API for job listings (Indeed alternative) with SettleGrid billing.
 * Requires Adzuna App ID and API key.
 *
 * Methods:
 *   search_jobs(query, location?, country?)    — Search jobs        (2¢)
 *   get_salary(query, location?, country?)     — Salary estimates   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface JobSearchInput { query: string; location?: string; country?: string }
interface SalaryInput { query: string; location?: string; country?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.adzuna.com/v1/api/jobs'
const APP_ID = process.env.ADZUNA_APP_ID || ''
const API_KEY = process.env.ADZUNA_API_KEY || ''
const VALID_COUNTRIES = new Set(['us', 'gb', 'au', 'ca', 'de', 'fr', 'in', 'nl', 'nz', 'pl', 'za'])

async function adzunaFetch<T>(path: string): Promise<T> {
  if (!APP_ID || !API_KEY) throw new Error('ADZUNA_APP_ID and ADZUNA_API_KEY environment variables are required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(`${path}${separator}app_id=${APP_ID}&app_key=${API_KEY}`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Adzuna credentials')
    const body = await res.text().catch(() => '')
    throw new Error(`Adzuna API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function getCountry(c?: string): string {
  const code = (c || 'us').toLowerCase().trim()
  if (!VALID_COUNTRIES.has(code)) throw new Error(`country must be one of: ${[...VALID_COUNTRIES].join(', ')}`)
  return code
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'indeed',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_jobs: { costCents: 2, displayName: 'Search Jobs' },
      get_salary: { costCents: 2, displayName: 'Get Salary Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchJobs = sg.wrap(async (args: JobSearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const country = getCountry(args.country)
  let url = `${API_BASE}/${country}/search/1?what=${encodeURIComponent(query)}&results_per_page=15`
  if (args.location) url += `&where=${encodeURIComponent(args.location.trim())}`
  const data = await adzunaFetch<{ count: number; results: Array<{ title: string; description: string; redirect_url: string; salary_min: number; salary_max: number; company: { display_name: string }; location: { display_name: string }; created: string; category: { label: string } }> }>(url)
  return {
    query, country, location: args.location || null, totalCount: data.count,
    jobs: (data.results || []).map(j => ({
      title: j.title, description: j.description?.slice(0, 300), url: j.redirect_url,
      salaryMin: j.salary_min || null, salaryMax: j.salary_max || null,
      company: j.company?.display_name || null, location: j.location?.display_name || null,
      posted: j.created, category: j.category?.label || null,
    })),
  }
}, { method: 'search_jobs' })

const getSalary = sg.wrap(async (args: SalaryInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const country = getCountry(args.country)
  let url = `${API_BASE}/${country}/history?what=${encodeURIComponent(query)}&months=12`
  if (args.location) url += `&where=${encodeURIComponent(args.location.trim())}`
  const data = await adzunaFetch<{ month: Record<string, number> }>(url)
  const months = Object.entries(data.month || {}).sort(([a], [b]) => a.localeCompare(b))
  const salaries = months.map(([month, salary]) => ({ month, averageSalary: Math.round(salary) }))
  const avg = salaries.length > 0 ? Math.round(salaries.reduce((s, m) => s + m.averageSalary, 0) / salaries.length) : null
  return { query, country, location: args.location || null, averageSalary: avg, history: salaries }
}, { method: 'get_salary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchJobs, getSalary }

console.log('settlegrid-indeed MCP server ready')
console.log('Methods: search_jobs, get_salary')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
