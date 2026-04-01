/**
 * settlegrid-ci-status — CI/CD Status Checker MCP Server
 *
 * Checks GitHub Actions workflow status via the GitHub API.
 * Provides workflow run status, job details, and build summaries.
 *
 * Methods:
 *   get_workflow_status(owner, repo)    — Get latest workflow runs     (2c)
 *   get_run_details(owner, repo, id)    — Get specific run details    (2c)
 *   list_workflows(owner, repo)         — List repository workflows   (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface GetStatusInput {
  owner: string
  repo: string
  branch?: string
  per_page?: number
}

interface GetRunInput {
  owner: string
  repo: string
  run_id: number
}

interface ListWorkflowsInput {
  owner: string
  repo: string
}

// --- Helpers ----------------------------------------------------------------

async function githubFetch<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'settlegrid-ci-status/1.0',
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'ci-status',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_workflow_status: { costCents: 2, displayName: 'Get Workflow Status' },
      get_run_details: { costCents: 2, displayName: 'Get Run Details' },
      list_workflows: { costCents: 2, displayName: 'List Workflows' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const getWorkflowStatus = sg.wrap(async (args: GetStatusInput) => {
  if (!args.owner || !args.repo) throw new Error('owner and repo are required')
  const perPage = Math.min(args.per_page ?? 5, 20)
  const branchParam = args.branch ? `&branch=${encodeURIComponent(args.branch)}` : ''
  const data = await githubFetch<{ workflow_runs: Array<{
    id: number; name: string; status: string; conclusion: string | null;
    head_branch: string; created_at: string; updated_at: string;
    html_url: string; run_number: number
  }> }>(`/repos/${args.owner}/${args.repo}/actions/runs?per_page=${perPage}${branchParam}`)

  return {
    repository: `${args.owner}/${args.repo}`,
    runs: data.workflow_runs.map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      conclusion: r.conclusion,
      branch: r.head_branch,
      run_number: r.run_number,
      created_at: r.created_at,
      url: r.html_url,
    })),
    count: data.workflow_runs.length,
  }
}, { method: 'get_workflow_status' })

const getRunDetails = sg.wrap(async (args: GetRunInput) => {
  if (!args.owner || !args.repo || !args.run_id) throw new Error('owner, repo, and run_id required')
  const [run, jobs] = await Promise.all([
    githubFetch<{
      id: number; name: string; status: string; conclusion: string | null;
      head_branch: string; head_sha: string; created_at: string;
      updated_at: string; html_url: string; run_number: number
    }>(`/repos/${args.owner}/${args.repo}/actions/runs/${args.run_id}`),
    githubFetch<{ jobs: Array<{
      id: number; name: string; status: string; conclusion: string | null;
      started_at: string; completed_at: string | null
    }> }>(`/repos/${args.owner}/${args.repo}/actions/runs/${args.run_id}/jobs`),
  ])

  return {
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    commit_sha: run.head_sha.slice(0, 8),
    run_number: run.run_number,
    created_at: run.created_at,
    updated_at: run.updated_at,
    url: run.html_url,
    jobs: jobs.jobs.map(j => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      started_at: j.started_at,
      completed_at: j.completed_at,
    })),
    job_count: jobs.jobs.length,
  }
}, { method: 'get_run_details' })

const listWorkflows = sg.wrap(async (args: ListWorkflowsInput) => {
  if (!args.owner || !args.repo) throw new Error('owner and repo are required')
  const data = await githubFetch<{ workflows: Array<{
    id: number; name: string; path: string; state: string; created_at: string
  }> }>(`/repos/${args.owner}/${args.repo}/actions/workflows`)

  return {
    repository: `${args.owner}/${args.repo}`,
    workflows: data.workflows.map(w => ({
      id: w.id,
      name: w.name,
      path: w.path,
      state: w.state,
    })),
    count: data.workflows.length,
  }
}, { method: 'list_workflows' })

// --- Exports ----------------------------------------------------------------

export { getWorkflowStatus, getRunDetails, listWorkflows }

console.log('settlegrid-ci-status MCP server ready')
console.log('Methods: get_workflow_status, get_run_details, list_workflows')
console.log('Pricing: 2c per call | Powered by SettleGrid')
