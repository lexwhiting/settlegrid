/**
 * settlegrid-venture-capital — Venture Capital & Startups MCP Server
 * Uses GitHub API as a proxy for tech startup activity with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface StartupResult {
  name: string
  fullName: string
  description: string
  stars: number
  forks: number
  language: string
  url: string
  createdAt: string
  updatedAt: string
}

interface ActivityData {
  org: string
  repos: number
  totalStars: number
  topRepos: { name: string; stars: number; language: string }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.github.com'
const HEADERS: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'SettleGrid/1.0' }

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'venture-capital' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchStartups(query: string): Promise<StartupResult[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_startups', async () => {
    const data = await fetchJSON<any>(`${API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=10`)
    return (data.items || []).map((r: any) => ({
      name: r.name, fullName: r.full_name, description: r.description || '',
      stars: r.stargazers_count || 0, forks: r.forks_count || 0,
      language: r.language || '', url: r.html_url || '',
      createdAt: r.created_at || '', updatedAt: r.updated_at || '',
    }))
  })
}

async function getFundingRounds(company: string): Promise<ActivityData> {
  if (!company) throw new Error('Company/org name is required')
  return sg.wrap('get_funding_rounds', async () => {
    const repos = await fetchJSON<any[]>(`${API}/orgs/${encodeURIComponent(company)}/repos?sort=stars&per_page=10`)
    return {
      org: company,
      repos: repos.length,
      totalStars: repos.reduce((s: number, r: any) => s + (r.stargazers_count || 0), 0),
      topRepos: repos.slice(0, 5).map((r: any) => ({
        name: r.name, stars: r.stargazers_count || 0, language: r.language || '',
      })),
    }
  })
}

async function listRecent(limit?: number): Promise<StartupResult[]> {
  return sg.wrap('list_recent', async () => {
    const since = new Date()
    since.setMonth(since.getMonth() - 3)
    const dateStr = since.toISOString().slice(0, 10)
    const data = await fetchJSON<any>(`${API}/search/repositories?q=created:>${dateStr}&sort=stars&per_page=${limit || 10}`)
    return (data.items || []).map((r: any) => ({
      name: r.name, fullName: r.full_name, description: r.description || '',
      stars: r.stargazers_count || 0, forks: r.forks_count || 0,
      language: r.language || '', url: r.html_url || '',
      createdAt: r.created_at || '', updatedAt: r.updated_at || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchStartups, getFundingRounds, listRecent }
console.log('settlegrid-venture-capital server started')
