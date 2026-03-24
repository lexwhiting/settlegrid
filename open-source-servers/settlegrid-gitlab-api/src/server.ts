/**
 * settlegrid-gitlab-api — GitLab MCP Server
 *
 * Search projects, merge requests, and pipelines on GitLab.
 *
 * Methods:
 *   search_projects(query)        — Search GitLab projects by name or keyword  (2¢)
 *   get_project(id)               — Get details of a specific GitLab project by ID  (2¢)
 *   list_pipelines(project_id)    — List recent CI/CD pipelines for a project  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchProjectsInput {
  query: string
}

interface GetProjectInput {
  id: number
}

interface ListPipelinesInput {
  project_id: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://gitlab.com/api/v4'
const API_KEY = process.env.GITLAB_TOKEN ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-gitlab-api/1.0', 'PRIVATE-TOKEN': API_KEY },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitLab API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gitlab-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_projects: { costCents: 2, displayName: 'Search Projects' },
      get_project: { costCents: 2, displayName: 'Get Project' },
      list_pipelines: { costCents: 2, displayName: 'List Pipelines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchProjects = sg.wrap(async (args: SearchProjectsInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const data = await apiFetch<any>(`/projects?search=${encodeURIComponent(query)}&order_by=stars_count&per_page=10`)
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    star_count: data.star_count,
    web_url: data.web_url,
  }
}, { method: 'search_projects' })

const getProject = sg.wrap(async (args: GetProjectInput) => {
  if (typeof args.id !== 'number') throw new Error('id is required and must be a number')
  const id = args.id
  const data = await apiFetch<any>(`/projects/${id}`)
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    star_count: data.star_count,
    forks_count: data.forks_count,
    web_url: data.web_url,
    default_branch: data.default_branch,
  }
}, { method: 'get_project' })

const listPipelines = sg.wrap(async (args: ListPipelinesInput) => {
  if (typeof args.project_id !== 'number') throw new Error('project_id is required and must be a number')
  const project_id = args.project_id
  const data = await apiFetch<any>(`/projects/${project_id}/pipelines?per_page=10`)
  return {
    id: data.id,
    status: data.status,
    ref: data.ref,
    created_at: data.created_at,
    web_url: data.web_url,
  }
}, { method: 'list_pipelines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchProjects, getProject, listPipelines }

console.log('settlegrid-gitlab-api MCP server ready')
console.log('Methods: search_projects, get_project, list_pipelines')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
