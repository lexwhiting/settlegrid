/**
 * settlegrid-sonarcloud — SonarCloud MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://sonarcloud.io'
const SLUG = 'sonarcloud'

function getToken(): string {
  const t = process.env.SONARCLOUD_TOKEN
  if (!t) throw new Error('SONARCLOUD_TOKEN environment variable is required')
  return t
}

async function apiFetch(path: string): Promise<unknown> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': `settlegrid-${SLUG}/1.0`,
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SonarCloud API error ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

interface SearchIssuesInput { projectKey: string; severity?: string; type?: string; pageSize?: number }
interface GetProjectMetricsInput { projectKey: string; metricKeys?: string }
interface GetQualityGateInput { projectKey: string }
interface ListProjectsInput { organization: string; pageSize?: number }
interface GetProjectAnalysesInput { projectKey: string; pageSize?: number }
interface SearchHotspotsInput { projectKey: string; status?: string; pageSize?: number }
interface GetIssueChangelogInput { issueKey: string }
interface ListRulesInput { language?: string; type?: string; pageSize?: number }

const sg = settlegrid.init({
  toolSlug: SLUG,
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_issues: { costCents: 2, displayName: 'Search Issues' },
      get_project_metrics: { costCents: 1, displayName: 'Get Project Metrics' },
      get_quality_gate_status: { costCents: 1, displayName: 'Get Quality Gate Status' },
      list_projects: { costCents: 1, displayName: 'List Projects' },
      get_project_analyses: { costCents: 1, displayName: 'Get Project Analyses' },
      search_hotspots: { costCents: 2, displayName: 'Search Hotspots' },
      get_issue_changelog: { costCents: 1, displayName: 'Get Issue Changelog' },
      list_rules: { costCents: 1, displayName: 'List Rules' },
    },
  },
})

const searchIssues = sg.wrap(async (args: SearchIssuesInput) => {
  const key = args.projectKey?.trim()
  if (!key) throw new Error('projectKey is required')
  const pageSize = Math.min(args.pageSize || 20, 50)
  const params = new URLSearchParams({ componentKeys: key, ps: String(pageSize) })
  if (args.severity) params.set('severities', args.severity.toUpperCase())
  if (args.type) params.set('types', args.type.toUpperCase())
  const data = await apiFetch(`/api/issues/search?${params.toString()}`)
  return data
}, { method: 'search_issues' })

const getProjectMetrics = sg.wrap(async (args: GetProjectMetricsInput) => {
  const key = args.projectKey?.trim()
  if (!key) throw new Error('projectKey is required')
  const metrics = args.metricKeys?.trim() || 'bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density'
  const params = new URLSearchParams({ component: key, metricKeys: metrics })
  const data = await apiFetch(`/api/measures/component?${params.toString()}`)
  return data
}, { method: 'get_project_metrics' })

const getQualityGateStatus = sg.wrap(async (args: GetQualityGateInput) => {
  const key = args.projectKey?.trim()
  if (!key) throw new Error('projectKey is required')
  const params = new URLSearchParams({ projectKey: key })
  const data = await apiFetch(`/api/qualitygates/project_status?${params.toString()}`)
  return data
}, { method: 'get_quality_gate_status' })

const listProjects = sg.wrap(async (args: ListProjectsInput) => {
  const org = args.organization?.trim()
  if (!org) throw new Error('organization is required')
  const pageSize = Math.min(args.pageSize || 20, 50)
  const params = new URLSearchParams({ organization: org, ps: String(pageSize) })
  const data = await apiFetch(`/api/components/search?${params.toString()}`)
  return data
}, { method: 'list_projects' })

const getProjectAnalyses = sg.wrap(async (args: GetProjectAnalysesInput) => {
  const key = args.projectKey?.trim()
  if (!key) throw new Error('projectKey is required')
  const pageSize = Math.min(args.pageSize || 10, 50)
  const params = new URLSearchParams({ project: key, ps: String(pageSize) })
  const data = await apiFetch(`/api/project_analyses/search?${params.toString()}`)
  return data
}, { method: 'get_project_analyses' })

const searchHotspots = sg.wrap(async (args: SearchHotspotsInput) => {
  const key = args.projectKey?.trim()
  if (!key) throw new Error('projectKey is required')
  const pageSize = Math.min(args.pageSize || 20, 50)
  const params = new URLSearchParams({ projectKey: key, ps: String(pageSize) })
  if (args.status) params.set('status', args.status.toUpperCase())
  const data = await apiFetch(`/api/hotspots/search?${params.toString()}`)
  return data
}, { method: 'search_hotspots' })

const getIssueChangelog = sg.wrap(async (args: GetIssueChangelogInput) => {
  const issueKey = args.issueKey?.trim()
  if (!issueKey) throw new Error('issueKey is required')
  const params = new URLSearchParams({ issue: issueKey })
  const data = await apiFetch(`/api/issues/changelog?${params.toString()}`)
  return data
}, { method: 'get_issue_changelog' })

const listRules = sg.wrap(async (args: ListRulesInput) => {
  const pageSize = Math.min(args.pageSize || 20, 50)
  const params = new URLSearchParams({ ps: String(pageSize) })
  if (args.language) params.set('languages', args.language.toLowerCase())
  if (args.type) params.set('types', args.type.toUpperCase())
  const data = await apiFetch(`/api/rules/search?${params.toString()}`)
  return data
}, { method: 'list_rules' })

export { searchIssues, getProjectMetrics, getQualityGateStatus, listProjects, getProjectAnalyses, searchHotspots, getIssueChangelog, listRules }
console.log('settlegrid-sonarcloud MCP server ready')
console.log('Methods: search_issues, get_project_metrics, get_quality_gate_status, list_projects, get_project_analyses, search_hotspots, get_issue_changelog, list_rules')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')