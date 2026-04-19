/**
 * settlegrid-fiddler-ai — Fiddler AI Model Management MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://app.fiddler.ai'
const SLUG = 'fiddler-ai'

interface ListModelsInput { limit?: number; offset?: number }
interface GetModelInput { model_id: string }
interface CreateModelInput { project_id: string; name: string; task: string; schema?: string }
interface UpdateModelInput { model_id: string; updates: string }
interface DeleteModelInput { model_id: string }
interface GenerateModelFromSamplesInput { project_id: string; name: string; task: string; samples: string }

function getApiKey(): string {
  const k = process.env.FIDDLER_API_KEY
  if (!k) throw new Error('FIDDLER_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': `settlegrid-${SLUG}/1.0`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Fiddler AI API error ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

const sg = settlegrid.init({
  toolSlug: SLUG,
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_models: { costCents: 1, displayName: 'List Models' },
      get_model: { costCents: 1, displayName: 'Get Model' },
      create_model: { costCents: 5, displayName: 'Create Model' },
      update_model: { costCents: 3, displayName: 'Update Model' },
      delete_model: { costCents: 5, displayName: 'Delete Model' },
      generate_model_from_samples: { costCents: 5, displayName: 'Generate Model From Samples' },
    },
  },
})

const listModels = sg.wrap(async (args: ListModelsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const offset = Math.max(args.offset || 0, 0)
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return apiFetch(`/v3/models?${qs.toString()}`)
}, { method: 'list_models' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const id = args.model_id?.trim()
  if (!id) throw new Error('model_id is required')
  return apiFetch(`/v3/models/${encodeURIComponent(id)}`)
}, { method: 'get_model' })

const createModel = sg.wrap(async (args: CreateModelInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const task = args.task?.trim()
  if (!task) throw new Error('task is required')

  let parsedSchema: unknown = undefined
  if (args.schema) {
    try {
      parsedSchema = JSON.parse(args.schema)
    } catch {
      throw new Error('schema must be a valid JSON string')
    }
  }

  const body: Record<string, unknown> = { project_id, name, task }
  if (parsedSchema !== undefined) body['schema'] = parsedSchema

  return apiFetch('/v3/models', { method: 'POST', body })
}, { method: 'create_model' })

const updateModel = sg.wrap(async (args: UpdateModelInput) => {
  const id = args.model_id?.trim()
  if (!id) throw new Error('model_id is required')
  if (!args.updates?.trim()) throw new Error('updates is required')

  let parsedUpdates: unknown
  try {
    parsedUpdates = JSON.parse(args.updates)
  } catch {
    throw new Error('updates must be a valid JSON string')
  }

  return apiFetch(`/v3/models/${encodeURIComponent(id)}`, { method: 'PATCH', body: parsedUpdates })
}, { method: 'update_model' })

const deleteModel = sg.wrap(async (args: DeleteModelInput) => {
  const id = args.model_id?.trim()
  if (!id) throw new Error('model_id is required')
  return apiFetch(`/v3/models/${encodeURIComponent(id)}`, { method: 'DELETE' })
}, { method: 'delete_model' })

const generateModelFromSamples = sg.wrap(async (args: GenerateModelFromSamplesInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')
  const task = args.task?.trim()
  if (!task) throw new Error('task is required')
  if (!args.samples?.trim()) throw new Error('samples is required')

  let parsedSamples: unknown
  try {
    parsedSamples = JSON.parse(args.samples)
  } catch {
    throw new Error('samples must be a valid JSON string')
  }

  const body = { project_id, name, task, samples: parsedSamples }
  return apiFetch('/v3/models/from-samples', { method: 'POST', body })
}, { method: 'generate_model_from_samples' })

export { listModels, getModel, createModel, updateModel, deleteModel, generateModelFromSamples }
console.log('settlegrid-fiddler-ai MCP server ready')
console.log('Methods: list_models, get_model, create_model, update_model, delete_model, generate_model_from_samples')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')