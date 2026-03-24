/**
 * settlegrid-github — GitHub MCP Server
 *
 * Wraps the GitHub API with SettleGrid billing.
 * Requires GITHUB_TOKEN environment variable.
 *
 * Methods:
 *   get_repo(owner, repo)                    (1¢)
 *   search_repos(q)                          (2¢)
 *   get_user(username)                       (1¢)
 *   list_issues(owner, repo)                 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetRepoInput {
  owner: string
  repo: string
}

interface SearchReposInput {
  q: string
  sort?: string
  per_page?: number
}

interface GetUserInput {
  username: string
}

interface ListIssuesInput {
  owner: string
  repo: string
  state?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.github.com'
const USER_AGENT = 'settlegrid-github/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.GITHUB_TOKEN
  if (!key) throw new Error('GITHUB_TOKEN environment variable is required')
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
    Authorization: `Bearer ${getApiKey()}`,
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
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'github',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_repo: { costCents: 1, displayName: 'Get repository details' },
      search_repos: { costCents: 2, displayName: 'Search for repositories' },
      get_user: { costCents: 1, displayName: 'Get user profile information' },
      list_issues: { costCents: 1, displayName: 'List issues for a repository' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRepo = sg.wrap(async (args: GetRepoInput) => {
  if (!args.owner || typeof args.owner !== 'string') {
    throw new Error('owner is required (repository owner)')
  }
  if (!args.repo || typeof args.repo !== 'string') {
    throw new Error('repo is required (repository name)')
  }

  const params: Record<string, string> = {}
  params['owner'] = String(args.owner)
  params['repo'] = String(args.repo)

  const data = await apiFetch<Record<string, unknown>>(`/repos/${encodeURIComponent(String(args.owner))}/${encodeURIComponent(String(args.repo))}`, {
    params,
  })

  return data
}, { method: 'get_repo' })

const searchRepos = sg.wrap(async (args: SearchReposInput) => {
  if (!args.q || typeof args.q !== 'string') {
    throw new Error('q is required (search query)')
  }

  const params: Record<string, string> = {}
  params['q'] = args.q
  if (args.sort !== undefined) params['sort'] = String(args.sort)
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)

  const data = await apiFetch<Record<string, unknown>>('/search/repositories', {
    params,
  })

  return data
}, { method: 'search_repos' })

const getUser = sg.wrap(async (args: GetUserInput) => {
  if (!args.username || typeof args.username !== 'string') {
    throw new Error('username is required (github username)')
  }

  const params: Record<string, string> = {}
  params['username'] = String(args.username)

  const data = await apiFetch<Record<string, unknown>>(`/users/${encodeURIComponent(String(args.username))}`, {
    params,
  })

  return data
}, { method: 'get_user' })

const listIssues = sg.wrap(async (args: ListIssuesInput) => {
  if (!args.owner || typeof args.owner !== 'string') {
    throw new Error('owner is required (repository owner)')
  }
  if (!args.repo || typeof args.repo !== 'string') {
    throw new Error('repo is required (repository name)')
  }

  const params: Record<string, string> = {}
  if (args.state !== undefined) params['state'] = String(args.state)

  const data = await apiFetch<Record<string, unknown>>(`/repos/${encodeURIComponent(String(args.owner))}/${encodeURIComponent(String(args.repo))}/issues`, {
    params,
  })

  const items = Array.isArray(data) ? data.slice(0, 30) : [data]

  return { owner: args.owner, repo: args.repo, count: items.length, results: items }
}, { method: 'list_issues' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRepo, searchRepos, getUser, listIssues }

console.log('settlegrid-github MCP server ready')
console.log('Methods: get_repo, search_repos, get_user, list_issues')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
