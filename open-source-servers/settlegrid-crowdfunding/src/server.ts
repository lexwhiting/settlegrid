/**
 * settlegrid-crowdfunding — Crowdfunding Data MCP Server
 * Wraps Kickstarter public data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Project {
  id: number
  name: string
  blurb: string
  goal: number
  pledged: number
  backers: number
  state: string
  category: string
  creator: string
  url: string
  percentFunded: number
}

interface CategoryStats {
  category: string
  totalProjects: number
  successRate: number
  avgPledged: number
  avgBackers: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://www.kickstarter.com/discover/advanced.json'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'SettleGrid/1.0' } })
  if (!res.ok) throw new Error(`Kickstarter API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

function mapProject(p: any): Project {
  return {
    id: p.id || 0, name: p.name || '', blurb: p.blurb || '',
    goal: p.goal || 0, pledged: p.pledged || 0, backers: p.backers_count || 0,
    state: p.state || '', category: p.category?.name || '',
    creator: p.creator?.name || '', url: p.urls?.web?.project || '',
    percentFunded: p.goal ? Math.round((p.pledged / p.goal) * 100) : 0,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'crowdfunding' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchProjects(query: string, category?: string): Promise<Project[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_projects', async () => {
    let url = `${API}?term=${encodeURIComponent(query)}&sort=magic&page=1`
    if (category) url += `&category_id=${encodeURIComponent(category)}`
    const data = await fetchJSON<any>(url)
    return (data.projects || []).slice(0, 15).map(mapProject)
  })
}

async function getStats(category: string): Promise<CategoryStats> {
  if (!category) throw new Error('Category name is required')
  return sg.wrap('get_stats', async () => {
    const data = await fetchJSON<any>(`${API}?category_id=${encodeURIComponent(category)}&sort=end_date&page=1`)
    const projects = data.projects || []
    const funded = projects.filter((p: any) => p.state === 'successful')
    return {
      category,
      totalProjects: projects.length,
      successRate: projects.length ? Math.round((funded.length / projects.length) * 100) : 0,
      avgPledged: projects.length ? Math.round(projects.reduce((s: number, p: any) => s + (p.pledged || 0), 0) / projects.length) : 0,
      avgBackers: projects.length ? Math.round(projects.reduce((s: number, p: any) => s + (p.backers_count || 0), 0) / projects.length) : 0,
    }
  })
}

async function getTrending(limit?: number): Promise<Project[]> {
  return sg.wrap('get_trending', async () => {
    const data = await fetchJSON<any>(`${API}?sort=popularity&page=1`)
    return (data.projects || []).slice(0, limit || 10).map(mapProject)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchProjects, getStats, getTrending }
console.log('settlegrid-crowdfunding server started')
