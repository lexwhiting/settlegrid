/**
 * settlegrid-codacy — Codacy Code Quality MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://app.codacy.com'

function getApiKey(): string {
  const k = process.env.CODACY_API_KEY
  if (!k) throw new Error('CODACY_API_KEY environment variable is required')
  return k
}

async function codacyFetch(path: string): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'api-token': apiKey,
      'Accept': 'application/json',
      'User-Agent': 'settlegrid-codacy/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Codacy API error ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

interface ListReposInput { provider: string; remoteOrganizationName: string; limit?: number }
interface GetRepoAnalysisInput { provider: string; remoteOrganizationName: string; repositoryName: string }
interface SearchIssuesInput { provider: string; remoteOrganizationName: string; repositoryName: string; branchName: string; limit?: number }
interface ListCommitsInput { provider: string; remoteOrganizationName: string; repositoryName: string; limit?: number }
interface GetCommitAnalysisInput { provider: string; remoteOrganizationName: string; repositoryName: string; commitUuid: string }
interface ListToolsInput { limit?: number }

const sg = settlegrid.init({
  toolSlug: 'codacy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_authenticated_user: { costCents: 1, displayName: 'Get Authenticated User' },
      list_organizations: { costCents: 1, displayName: 'List Organizations' },
      list_repositories: { costCents: 1, displayName: 'List Repositories' },
      get_repository_analysis: { costCents: 1, displayName: 'Get Repository Analysis' },
      search_repository_issues: { costCents: 2, displayName: 'Search Repository Issues' },
      list_repository_commits: { costCents: 1, displayName: 'List Repository Commits' },
      get_commit_analysis: { costCents: 1, displayName: 'Get Commit Analysis' },
      list_tools: { costCents: 1, displayName: 'List Tools' },
    },
  },
})

const getAuthenticatedUser = sg.wrap(async () => {
  return codacyFetch('/api/v3/user')
}, { method: 'get_authenticated_user' })

const listOrganizations = sg.wrap(async () => {
  return codacyFetch('/api/v3/user/organizations')
}, { method: 'list_organizations' })

const listRepositories = sg.wrap(async (args: ListReposInput) => {
  const provider = args.provider?.trim()
  const org = args.remoteOrganizationName?.trim()
  if (!provider) throw new Error('provider is required')
  if (!org) throw new Error('remoteOrganizationName is required')
  const limit = Math.min(args.limit || 20, 50)
  return codacyFetch(`/api/v3/organizations/${encodeURIComponent(provider)}/${encodeURIComponent(org)}/repositories?limit=${limit}`)
}, { method: 'list_repositories' })

const getRepositoryAnalysis = sg.wrap(async (args: GetRepoAnalysisInput) => {
  const provider = args.provider?.trim()
  const org = args.remoteOrganizationName?.trim()
  const repo = args.repositoryName?.trim()
  if (!provider) throw new Error('provider is required')
  if (!org) throw new Error('remoteOrganizationName is required')
  if (!repo) throw new Error('repositoryName is required')
  return codacyFetch(`/api/v3/analysis/organizations/${encodeURIComponent(provider)}/${encodeURIComponent(org)}/repositories/${encodeURIComponent(repo)}`)
}, { method: 'get_repository_analysis' })

const searchRepositoryIssues = sg.wrap(async (args: SearchIssuesInput) => {
  const provider = args.provider?.trim()
  const org = args.remoteOrganizationName?.trim()
  const repo = args.repositoryName?.trim()
  const branch = args.branchName?.trim()
  if (!provider) throw new Error('provider is required')
  if (!org) throw new Error('remoteOrganizationName is required')
  if (!repo) throw new Error('repositoryName is required')
  if (!branch) throw new Error('branchName is required')
  const limit = Math.min(args.limit || 20, 50)
  return codacyFetch(`/api/v3/analysis/organizations/${encodeURIComponent(provider)}/${encodeURIComponent(org)}/repositories/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}/issues/search?limit=${limit}`)
}, { method: 'search_repository_issues' })

const listRepositoryCommits = sg.wrap(async (args: ListCommitsInput) => {
  const provider = args.provider?.trim()
  const org = args.remoteOrganizationName?.trim()
  const repo = args.repositoryName?.trim()
  if (!provider) throw new Error('provider is required')
  if (!org) throw new Error('remoteOrganizationName is required')
  if (!repo) throw new Error('repositoryName is required')
  const limit = Math.min(args.limit || 20, 50)
  return codacyFetch(`/api/v3/analysis/organizations/${encodeURIComponent(provider)}/${encodeURIComponent(org)}/repositories/${encodeURIComponent(repo)}/commits?limit=${limit}`)
}, { method: 'list_repository_commits' })

const getCommitAnalysis = sg.wrap(async (args: GetCommitAnalysisInput) => {
  const provider = args.provider?.trim()
  const org = args.remoteOrganizationName?.trim()
  const repo = args.repositoryName?.trim()
  const commit = args.commitUuid?.trim()
  if (!provider) throw new Error('provider is required')
  if (!org) throw new Error('remoteOrganizationName is required')
  if (!repo) throw new Error('repositoryName is required')
  if (!commit) throw new Error('commitUuid is required')
  return codacyFetch(`/api/v3/analysis/organizations/${encodeURIComponent(provider)}/${encodeURIComponent(org)}/repositories/${encodeURIComponent(repo)}/commits/${encodeURIComponent(commit)}`)
}, { method: 'get_commit_analysis' })

const listTools = sg.wrap(async (args: ListToolsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return codacyFetch(`/api/v3/tools?limit=${limit}`)
}, { method: 'list_tools' })

export {
  getAuthenticatedUser,
  listOrganizations,
  listRepositories,
  getRepositoryAnalysis,
  searchRepositoryIssues,
  listRepositoryCommits,
  getCommitAnalysis,
  listTools,
}
console.log('settlegrid-codacy MCP server ready')
console.log('Methods: get_authenticated_user, list_organizations, list_repositories, get_repository_analysis, search_repository_issues, list_repository_commits, get_commit_analysis, list_tools')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')