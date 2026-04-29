/**
 * settlegrid-prefect — Prefect Cloud MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

// Input interfaces
interface GetFlowInput { flow_id: string }
interface FilterFlowsInput { name?: string; limit?: number; offset?: number }
interface GetFlowRunInput { flow_run_id: string }
interface FilterFlowRunsInput { deployment_id?: string; state_type?: string; limit?: number; offset?: number }
interface CreateFlowRunFromDeploymentInput { deployment_id: string; parameters?: Record<string, unknown>; name?: string }
interface GetDeploymentInput { deployment_id: string }
interface FilterDeploymentsInput { name?: string; limit?: number; offset?: number }
interface FilterLogsInput { flow_run_id?: string; task_run_id?: string; level?: number; limit?: number; offset?: number }

// Lazy env-var readers
function getApiKey(): string {
  const k = process.env.PREFECT_API_KEY
  if (!k) throw new Error('PREFECT_API_KEY environment variable is required')
  return k
}

function getAccountId(): string {
  const a = process.env.PREFECT_ACCOUNT_ID
  if (!a) throw new Error('PREFECT_ACCOUNT_ID environment variable is required')
  return a
}

function getWorkspaceId(): string {
  const w = process.env.PREFECT_WORKSPACE_ID
  if (!w) throw new Error('PREFECT_WORKSPACE_ID environment variable is required')
  return w
}

function getBaseUrl(): string {
  const accountId = getAccountId()
  const workspaceId = getWorkspaceId()
  return `https://api.prefect.cloud/api/accounts/${accountId}/workspaces/${workspaceId}`
}

async function prefectFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const url = `${base}${path}`
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-prefect/1.0',
    },
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Prefect API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// Initialize SettleGrid
const sg = settlegrid.init({
  toolSlug: 'prefect',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_flow: { costCents: 1, displayName: 'Get Flow' },
      filter_flows: { costCents: 1, displayName: 'Filter Flows' },
      get_flow_run: { costCents: 1, displayName: 'Get Flow Run' },
      filter_flow_runs: { costCents: 2, displayName: 'Filter Flow Runs' },
      create_flow_run_from_deployment: { costCents: 5, displayName: 'Create Flow Run from Deployment' },
      get_deployment: { costCents: 1, displayName: 'Get Deployment' },
      filter_deployments: { costCents: 1, displayName: 'Filter Deployments' },
      filter_logs: { costCents: 2, displayName: 'Filter Logs' },
    },
  },
})

// Method implementations
const getFlow = sg.wrap(async (args: GetFlowInput) => {
  const id = args.flow_id?.trim()
  if (!id) throw new Error('flow_id is required')
  return prefectFetch(`/flows/${encodeURIComponent(id)}`)
}, { method: 'get_flow' })

const filterFlows = sg.wrap(async (args: FilterFlowsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const offset = args.offset || 0
  const body: Record<string, unknown> = { limit, offset }
  if (args.name) {
    body.flows = { name: { like_: `%${args.name}%` } }
  }
  return prefectFetch('/flows/filter', { method: 'POST', body })
}, { method: 'filter_flows' })

const getFlowRun = sg.wrap(async (args: GetFlowRunInput) => {
  const id = args.flow_run_id?.trim()
  if (!id) throw new Error('flow_run_id is required')
  return prefectFetch(`/flow_runs/${encodeURIComponent(id)}`)
}, { method: 'get_flow_run' })

const filterFlowRuns = sg.wrap(async (args: FilterFlowRunsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const offset = args.offset || 0
  const body: Record<string, unknown> = { limit, offset }
  const flowRunsFilter: Record<string, unknown> = {}
  if (args.deployment_id) {
    flowRunsFilter.deployment_id = { any_: [args.deployment_id] }
  }
  if (args.state_type) {
    flowRunsFilter.state = { type: { any_: [args.state_type.toUpperCase()] } }
  }
  if (Object.keys(flowRunsFilter).length > 0) {
    body.flow_runs = flowRunsFilter
  }
  return prefectFetch('/flow_runs/filter', { method: 'POST', body })
}, { method: 'filter_flow_runs' })

const createFlowRunFromDeployment = sg.wrap(async (args: CreateFlowRunFromDeploymentInput) => {
  const id = args.deployment_id?.trim()
  if (!id) throw new Error('deployment_id is required')
  const body: Record<string, unknown> = {}
  if (args.parameters) body.parameters = args.parameters
  if (args.name) body.name = args.name
  return prefectFetch(`/deployments/${encodeURIComponent(id)}/create_flow_run`, { method: 'POST', body })
}, { method: 'create_flow_run_from_deployment' })

const getDeployment = sg.wrap(async (args: GetDeploymentInput) => {
  const id = args.deployment_id?.trim()
  if (!id) throw new Error('deployment_id is required')
  return prefectFetch(`/deployments/${encodeURIComponent(id)}`)
}, { method: 'get_deployment' })

const filterDeployments = sg.wrap(async (args: FilterDeploymentsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const offset = args.offset || 0
  const body: Record<string, unknown> = { limit, offset }
  if (args.name) {
    body.deployments = { name: { like_: `%${args.name}%` } }
  }
  return prefectFetch('/deployments/filter', { method: 'POST', body })
}, { method: 'filter_deployments' })

const filterLogs = sg.wrap(async (args: FilterLogsInput) => {
  if (!args.flow_run_id && !args.task_run_id) {
    throw new Error('At least one of flow_run_id or task_run_id is required')
  }
  const limit = Math.min(args.limit || 20, 50)
  const offset = args.offset || 0
  const body: Record<string, unknown> = { limit, offset }
  const logsFilter: Record<string, unknown> = {}
  if (args.flow_run_id) logsFilter.flow_run_id = { any_: [args.flow_run_id] }
  if (args.task_run_id) logsFilter.task_run_id = { any_: [args.task_run_id] }
  if (args.level !== undefined) logsFilter.level = { ge_: args.level }
  body.logs = logsFilter
  return prefectFetch('/logs/filter', { method: 'POST', body })
}, { method: 'filter_logs' })

export {
  getFlow,
  filterFlows,
  getFlowRun,
  filterFlowRuns,
  createFlowRunFromDeployment,
  getDeployment,
  filterDeployments,
  filterLogs,
}

console.log('settlegrid-prefect MCP server ready')
console.log('Methods: get_flow, filter_flows, get_flow_run, filter_flow_runs, create_flow_run_from_deployment, get_deployment, filter_deployments, filter_logs')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')