/**
 * settlegrid-github-api — GitHub MCP Server
 *
 * Search repos, issues, and users on GitHub.
 *
 * Methods:
 *   search_repos(query, per_page) — Search GitHub repositories by query  (2¢)
 *   get_repo(owner, repo)         — Get details about a specific repository  (2¢)
 *   search_issues(query, per_page) — Search issues and pull requests across GitHub  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchReposInput {
  query: string
  per_page?: number
}

interface GetRepoInput {
  owner: string
  repo: string
}

interface SearchIssuesInput {
  query: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.github.com'
const API_KEY = process.env.GITHUB_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-github-api/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'github-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_repos: { costCents: 2, displayName: 'Search Repos' },
      get_repo: { costCents: 2, displayName: 'Get Repo' },
      search_issues: { costCents: 2, displayName: 'Search Issues' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRepos = sg.wrap(async (args: SearchReposInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const per_page = typeof args.per_page === 'number' ? args.per_page : 0
  const data = await apiFetch<any>(`/search/repositories?q=${encodeURIComponent(query)}&per_page=${per_page}`)
  const items = (data.items ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        full_name: item.full_name,
        description: item.description,
        stargazers_count: item.stargazers_count,
        language: item.language,
        html_url: item.html_url,
    })),
  }
}, { method: 'search_repos' })

const getRepo = sg.wrap(async (args: GetRepoInput) => {
  if (!args.owner || typeof args.owner !== 'string') throw new Error('owner is required')
  const owner = args.owner.trim()
  if (!args.repo || typeof args.repo !== 'string') throw new Error('repo is required')
  const repo = args.repo.trim()
  const data = await apiFetch<any>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`)
  return {
    full_name: data.full_name,
    description: data.description,
    stargazers_count: data.stargazers_count,
    forks_count: data.forks_count,
    language: data.language,
    open_issues_count: data.open_issues_count,
    html_url: data.html_url,
  }
}, { method: 'get_repo' })

const searchIssues = sg.wrap(async (args: SearchIssuesInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const per_page = typeof args.per_page === 'number' ? args.per_page : 0
  const data = await apiFetch<any>(`/search/issues?q=${encodeURIComponent(query)}&per_page=${per_page}`)
  const items = (data.items ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        title: item.title,
        state: item.state,
        html_url: item.html_url,
        user: item.user,
        created_at: item.created_at,
    })),
  }
}, { method: 'search_issues' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRepos, getRepo, searchIssues }

console.log('settlegrid-github-api MCP server ready')
console.log('Methods: search_repos, get_repo, search_issues')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
