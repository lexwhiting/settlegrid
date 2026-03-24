/**
 * settlegrid-gitlab — GitLab MCP Server
 *
 * Wraps the GitLab API with SettleGrid billing.
 * Requires GITLAB_TOKEN environment variable.
 *
 * Methods:
 *   search_projects(search)                  (1¢)
 *   get_project(id)                          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchProjectsInput {
  search: string
  per_page?: number
}

interface GetProjectInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://gitlab.com/api/v4'
const USER_AGENT = 'settlegrid-gitlab/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.GITLAB_TOKEN
  if (!key) throw new Error('GITLAB_TOKEN environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'PRIVATE-TOKEN': `${getApiKey()}`,
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitLab API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gitlab',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_projects: { costCents: 1, displayName: 'Search for GitLab projects' },
      get_project: { costCents: 1, displayName: 'Get project details by ID' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchProjects = sg.wrap(async (args: SearchProjectsInput) => {
  if (!args.search || typeof args.search !== 'string') {
    throw new Error('search is required (search query)')
  }

  const params: Record<string, string> = {}
  params['search'] = args.search
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/projects', {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 50) : [data]

  return { search: args.search, count: items.length, results: items }
}, { method: 'search_projects' })

const getProject = sg.wrap(async (args: GetProjectInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (project id or url-encoded path)')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/projects/${encodeURIComponent(String(args.id))}`, {
    params,
  })

  return data
}, { method: 'get_project' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchProjects, getProject }

console.log('settlegrid-gitlab MCP server ready')
console.log('Methods: search_projects, get_project')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
