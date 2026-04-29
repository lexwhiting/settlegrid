/**
 * settlegrid-snyk — Snyk Security MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.snyk.io'
const REST_VERSION = '2024-01-23'

function getApiKey(): string {
  const k = process.env.SNYK_API_KEY
  if (!k) throw new Error('SNYK_API_KEY environment variable is required. Get your key at https://app.snyk.io/account')
  return k
}

interface GetCurrentUserInput {}
interface ListOrgsInput {}
interface ListProjectsInput { orgId: string }
interface GetProjectIssuesInput { orgId: string; projectId: string; severity?: string }
interface ListOrgIssuesInput { orgId: string; limit?: number }

async function snykFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `token ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-snyk/1.0',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Snyk API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function snykRestFetch(path: string): Promise<unknown> {
  const apiKey = getApiKey()
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}version=${REST_VERSION}`, {
    headers: {
      'Authorization': `token ${apiKey}`,
      'Content-Type': 'application/vnd.api+json',
      'User-Agent': 'settlegrid-snyk/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Snyk REST API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'snyk',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current_user: { costCents: 1, displayName: 'Get Current User' },
      list_orgs: { costCents: 1, displayName: 'List Organizations' },
      list_projects: { costCents: 1, displayName: 'List Projects' },
      get_project_issues: { costCents: 2, displayName: 'Get Project Issues' },
      list_org_issues: { costCents: 2, displayName: 'List Org Issues' },
    },
  },
})

const getCurrentUser = sg.wrap(async (_args: GetCurrentUserInput) => {
  return snykFetch('/v1/user/me')
}, { method: 'get_current_user' })

const listOrgs = sg.wrap(async (_args: ListOrgsInput) => {
  return snykFetch('/v1/orgs')
}, { method: 'list_orgs' })

const listProjects = sg.wrap(async (args: ListProjectsInput) => {
  const orgId = args.orgId?.trim()
  if (!orgId) throw new Error('orgId is required')
  return snykFetch(`/v1/org/${encodeURIComponent(orgId)}/projects`)
}, { method: 'list_projects' })

const getProjectIssues = sg.wrap(async (args: GetProjectIssuesInput) => {
  const orgId = args.orgId?.trim()
  const projectId = args.projectId?.trim()
  if (!orgId) throw new Error('orgId is required')
  if (!projectId) throw new Error('projectId is required')

  const validSeverities = ['critical', 'high', 'medium', 'low']
  const filters: Record<string, unknown> = {}
  if (args.severity) {
    const sev = args.severity.toLowerCase()
    if (!validSeverities.includes(sev)) {
      throw new Error(`severity must be one of: ${validSeverities.join(', ')}`)
    }
    filters.severities = [sev]
  }

  return snykFetch(
    `/v1/org/${encodeURIComponent(orgId)}/project/${encodeURIComponent(projectId)}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({ filters }),
    }
  )
}, { method: 'get_project_issues' })

const listOrgIssues = sg.wrap(async (args: ListOrgIssuesInput) => {
  const orgId = args.orgId?.trim()
  if (!orgId) throw new Error('orgId is required')
  const limit = Math.min(args.limit || 10, 50)
  return snykRestFetch(`/rest/orgs/${encodeURIComponent(orgId)}/issues?limit=${limit}`)
}, { method: 'list_org_issues' })

export { getCurrentUser, listOrgs, listProjects, getProjectIssues, listOrgIssues }
console.log('settlegrid-snyk MCP server ready')
console.log('Methods: get_current_user, list_orgs, list_projects, get_project_issues, list_org_issues')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')