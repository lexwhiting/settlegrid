/**
 * settlegrid-github-jobs — Arbeitnow Developer Jobs MCP Server
 *
 * GitHub Jobs API has been deprecated. This server uses Arbeitnow as an
 * alternative source for developer and tech job listings.
 * No API key needed.
 *
 * Methods:
 *   search_dev_jobs(query?, remote?)    — Search dev jobs      (1¢)
 *   get_latest_dev_jobs(page?)          — Latest dev jobs      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query?: string; remote?: boolean }
interface LatestInput { page?: number }

interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]
  location: string
  created_at: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://arbeitnow.com/api/job-board-api'

async function arbeitnowFetch(page: number): Promise<{ data: ArbeitnowJob[]; meta: { currentPage: number; lastPage: number } }> {
  const res = await fetch(`${API_BASE}?page=${page}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Arbeitnow API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<{ data: ArbeitnowJob[]; meta: { currentPage: number; lastPage: number } }>
}

function formatJob(j: ArbeitnowJob) {
  return {
    slug: j.slug,
    title: j.title,
    company: j.company_name,
    location: j.location || 'Not specified',
    remote: j.remote,
    tags: j.tags || [],
    jobTypes: j.job_types || [],
    url: j.url,
    description: (j.description || '').replace(/<[^>]*>/g, '').slice(0, 400),
    postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'github-jobs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_dev_jobs: { costCents: 1, displayName: 'Search Dev Jobs' },
      get_latest_dev_jobs: { costCents: 1, displayName: 'Latest Dev Jobs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDevJobs = sg.wrap(async (args: SearchInput) => {
  const data = await arbeitnowFetch(1)
  let filtered = data.data

  if (args.query && typeof args.query === 'string') {
    const q = args.query.toLowerCase().trim()
    filtered = filtered.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.company_name.toLowerCase().includes(q) ||
      (j.tags || []).some(t => t.toLowerCase().includes(q))
    )
  }

  if (args.remote === true) {
    filtered = filtered.filter(j => j.remote)
  }

  return { query: args.query || null, remote: args.remote || false, count: filtered.length, jobs: filtered.slice(0, 20).map(formatJob) }
}, { method: 'search_dev_jobs' })

const getLatestDevJobs = sg.wrap(async (args: LatestInput) => {
  const page = Math.min(Math.max(args.page || 1, 1), 50)
  const data = await arbeitnowFetch(page)
  return {
    page: data.meta.currentPage,
    lastPage: data.meta.lastPage,
    count: data.data.length,
    jobs: data.data.slice(0, 20).map(formatJob),
  }
}, { method: 'get_latest_dev_jobs' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDevJobs, getLatestDevJobs }

console.log('settlegrid-github-jobs MCP server ready')
console.log('Methods: search_dev_jobs, get_latest_dev_jobs')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
