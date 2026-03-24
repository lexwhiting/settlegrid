/**
 * settlegrid-remoteok — RemoteOK Jobs MCP Server
 *
 * Wraps the RemoteOK API for remote job listings with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_remote_jobs(query?, tags?)   — Search remote jobs    (1¢)
 *   get_latest_jobs()                   — Latest remote jobs    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query?: string; tags?: string }

interface RemoteJob {
  id: string
  slug: string
  company: string
  position: string
  tags: string[]
  description: string
  location: string
  salary_min: number
  salary_max: number
  date: string
  url: string
  company_logo: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://remoteok.com/api'

async function remoteokFetch(): Promise<RemoteJob[]> {
  const res = await fetch(API_BASE, {
    headers: { 'User-Agent': 'settlegrid-remoteok/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`RemoteOK API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json() as unknown[]
  // First element is a legal notice, skip it
  return data.filter((item): item is RemoteJob => typeof item === 'object' && item !== null && 'position' in item)
}

function formatJob(j: RemoteJob) {
  return {
    id: j.id,
    position: j.position,
    company: j.company,
    tags: j.tags || [],
    location: j.location || 'Worldwide',
    salaryMin: j.salary_min || null,
    salaryMax: j.salary_max || null,
    date: j.date,
    url: j.url || `https://remoteok.com/l/${j.slug}`,
    companyLogo: j.company_logo || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'remoteok',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_remote_jobs: { costCents: 1, displayName: 'Search Remote Jobs' },
      get_latest_jobs: { costCents: 1, displayName: 'Latest Remote Jobs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRemoteJobs = sg.wrap(async (args: SearchInput) => {
  const allJobs = await remoteokFetch()
  let filtered = allJobs

  if (args.query && typeof args.query === 'string') {
    const q = args.query.toLowerCase().trim()
    filtered = filtered.filter(j =>
      j.position.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      (j.tags || []).some(t => t.toLowerCase().includes(q))
    )
  }

  if (args.tags && typeof args.tags === 'string') {
    const tags = args.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    filtered = filtered.filter(j =>
      tags.some(tag => (j.tags || []).some(t => t.toLowerCase().includes(tag)))
    )
  }

  return { query: args.query || null, tags: args.tags || null, count: filtered.length, jobs: filtered.slice(0, 20).map(formatJob) }
}, { method: 'search_remote_jobs' })

const getLatestJobs = sg.wrap(async () => {
  const allJobs = await remoteokFetch()
  return { count: allJobs.length, jobs: allJobs.slice(0, 20).map(formatJob) }
}, { method: 'get_latest_jobs' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRemoteJobs, getLatestJobs }

console.log('settlegrid-remoteok MCP server ready')
console.log('Methods: search_remote_jobs, get_latest_jobs')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
