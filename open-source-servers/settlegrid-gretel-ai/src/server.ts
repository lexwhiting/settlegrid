/**
 * settlegrid-gretel-ai — Gretel.ai MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.gretel.cloud'

function getApiKey(): string {
  const k = process.env.GRETEL_API_KEY
  if (!k) throw new Error('GRETEL_API_KEY environment variable is required')
  return k
}

async function gretelFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `grtu${key.startsWith('grtu') ? key.slice(4) : key}`.startsWith('grtu') && key.startsWith('grtu')
        ? key
        : `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-gretel-ai/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gretel API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

function buildAuthHeader(key: string): string {
  return key.startsWith('grtu') ? key : `Bearer ${key}`
}

async function gretelRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': buildAuthHeader(key),
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-gretel-ai/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gretel API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

interface ListProjectsInput { query?: string; limit?: number }
interface GetProjectInput { project_id: string }
interface CreateProjectInput { name: string; description?: string }
interface ListModelsInput { project_id: string; query?: string }
interface GetModelInput { project_id: string; model_id: string }
interface GetProjectRecordsInput { project_id: string; query?: string; sort?: string }
interface GetModelRecordsInput { project_id: string; model_id: string }
interface ListArtifactsInput { project_id: string }

const sg = settlegrid.init({
  toolSlug: 'gretel-ai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_projects: { costCents: 1, displayName: 'List Projects' },
      get_project: { costCents: 1, displayName: 'Get Project' },
      create_project: { costCents: 3, displayName: 'Create Project' },
      list_models: { costCents: 1, displayName: 'List Models' },
      get_model: { costCents: 1, displayName: 'Get Model' },
      get_project_records: { costCents: 2, displayName: 'Get Project Records' },
      get_model_records: { costCents: 2, displayName: 'Get Model Records' },
      list_artifacts: { costCents: 1, displayName: 'List Artifacts' },
    },
  },
})

const listProjects = sg.wrap(async (args: ListProjectsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const params = new URLSearchParams()
  if (args.query) params.set('query', args.query)
  params.set('limit', String(limit))
  const qs = params.toString()
  return gretelRequest(`/v1/projects${qs ? '?' + qs : ''}`)
}, { method: 'list_projects' })

const getProject = sg.wrap(async (args: GetProjectInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  return gretelRequest(`/v1/projects/${encodeURIComponent(id)}`)
}, { method: 'get_project' })

const createProject = sg.wrap(async (args: CreateProjectInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const body: Record<string, string> = { name }
  if (args.description) body.description = args.description
  return gretelRequest('/v1/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}, { method: 'create_project' })

const listModels = sg.wrap(async (args: ListModelsInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  const params = new URLSearchParams()
  if (args.query) params.set('query', args.query)
  const qs = params.toString()
  return gretelRequest(`/v1/projects/${encodeURIComponent(id)}/models${qs ? '?' + qs : ''}`)
}, { method: 'list_models' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const pid = args.project_id?.trim()
  const mid = args.model_id?.trim()
  if (!pid) throw new Error('project_id is required')
  if (!mid) throw new Error('model_id is required')
  return gretelRequest(`/v1/projects/${encodeURIComponent(pid)}/models/${encodeURIComponent(mid)}`)
}, { method: 'get_model' })

const getProjectRecords = sg.wrap(async (args: GetProjectRecordsInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  const params = new URLSearchParams()
  if (args.query) params.set('query', args.query)
  if (args.sort) params.set('sort', args.sort)
  const qs = params.toString()
  return gretelRequest(`/v1/projects/${encodeURIComponent(id)}/records${qs ? '?' + qs : ''}`)
}, { method: 'get_project_records' })

const getModelRecords = sg.wrap(async (args: GetModelRecordsInput) => {
  const pid = args.project_id?.trim()
  const mid = args.model_id?.trim()
  if (!pid) throw new Error('project_id is required')
  if (!mid) throw new Error('model_id is required')
  return gretelRequest(`/v1/projects/${encodeURIComponent(pid)}/models/${encodeURIComponent(mid)}/records`)
}, { method: 'get_model_records' })

const listArtifacts = sg.wrap(async (args: ListArtifactsInput) => {
  const id = args.project_id?.trim()
  if (!id) throw new Error('project_id is required')
  return gretelRequest(`/v1/projects/${encodeURIComponent(id)}/artifacts`)
}, { method: 'list_artifacts' })

export { listProjects, getProject, createProject, listModels, getModel, getProjectRecords, getModelRecords, listArtifacts }
console.log('settlegrid-gretel-ai MCP server ready')
console.log('Methods: list_projects, get_project, create_project, list_models, get_model, get_project_records, get_model_records, list_artifacts')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')