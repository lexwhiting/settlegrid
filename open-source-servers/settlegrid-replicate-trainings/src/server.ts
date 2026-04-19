/**
 * settlegrid-replicate-trainings — Replicate Trainings MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface CreateTrainingInput {
  model_owner: string
  model_name: string
  version_id: string
  destination: string
  input?: Record<string, unknown>
  webhook?: string
}

interface ListTrainingsInput {
  cursor?: string
}

interface GetTrainingInput {
  training_id: string
}

interface CancelTrainingInput {
  training_id: string
}

interface GetModelInput {
  model_owner: string
  model_name: string
}

interface ListModelVersionsInput {
  model_owner: string
  model_name: string
}

const BASE = 'https://api.replicate.com'

function getApiKey(): string {
  const k = process.env.REPLICATE_API_TOKEN
  if (!k) throw new Error('REPLICATE_API_TOKEN environment variable is required')
  return k
}

function authHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
    'User-Agent': 'settlegrid-replicate-trainings/1.0',
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Replicate API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'replicate-trainings',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_training: { costCents: 5, displayName: 'Create Training' },
      list_trainings: { costCents: 1, displayName: 'List Trainings' },
      get_training: { costCents: 1, displayName: 'Get Training' },
      cancel_training: { costCents: 2, displayName: 'Cancel Training' },
      get_model: { costCents: 1, displayName: 'Get Model' },
      list_model_versions: { costCents: 1, displayName: 'List Model Versions' },
      get_account: { costCents: 1, displayName: 'Get Account' },
      list_hardware: { costCents: 1, displayName: 'List Hardware' },
    },
  },
})

const createTraining = sg.wrap(async (args: CreateTrainingInput) => {
  const owner = args.model_owner?.trim()
  const name = args.model_name?.trim()
  const version = args.version_id?.trim()
  const dest = args.destination?.trim()
  if (!owner) throw new Error('model_owner is required')
  if (!name) throw new Error('model_name is required')
  if (!version) throw new Error('version_id is required')
  if (!dest) throw new Error('destination is required')
  const body: Record<string, unknown> = { destination: dest }
  if (args.input) body.input = args.input
  if (args.webhook) body.webhook = args.webhook
  return apiFetch(
    `/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}/trainings`,
    { method: 'POST', body: JSON.stringify(body) }
  )
}, { method: 'create_training' })

const listTrainings = sg.wrap(async (args: ListTrainingsInput) => {
  const qs = args.cursor ? `?cursor=${encodeURIComponent(args.cursor)}` : ''
  return apiFetch(`/v1/trainings${qs}`)
}, { method: 'list_trainings' })

const getTraining = sg.wrap(async (args: GetTrainingInput) => {
  const id = args.training_id?.trim()
  if (!id) throw new Error('training_id is required')
  return apiFetch(`/v1/trainings/${encodeURIComponent(id)}`)
}, { method: 'get_training' })

const cancelTraining = sg.wrap(async (args: CancelTrainingInput) => {
  const id = args.training_id?.trim()
  if (!id) throw new Error('training_id is required')
  return apiFetch(`/v1/trainings/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}, { method: 'cancel_training' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const owner = args.model_owner?.trim()
  const name = args.model_name?.trim()
  if (!owner) throw new Error('model_owner is required')
  if (!name) throw new Error('model_name is required')
  return apiFetch(`/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`)
}, { method: 'get_model' })

const listModelVersions = sg.wrap(async (args: ListModelVersionsInput) => {
  const owner = args.model_owner?.trim()
  const name = args.model_name?.trim()
  if (!owner) throw new Error('model_owner is required')
  if (!name) throw new Error('model_name is required')
  return apiFetch(`/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/versions`)
}, { method: 'list_model_versions' })

const getAccount = sg.wrap(async (_args: Record<string, never>) => {
  return apiFetch('/v1/account')
}, { method: 'get_account' })

const listHardware = sg.wrap(async (_args: Record<string, never>) => {
  return apiFetch('/v1/hardware')
}, { method: 'list_hardware' })

export {
  createTraining,
  listTrainings,
  getTraining,
  cancelTraining,
  getModel,
  listModelVersions,
  getAccount,
  listHardware,
}

console.log('settlegrid-replicate-trainings MCP server ready')
console.log('Methods: create_training, list_trainings, get_training, cancel_training, get_model, list_model_versions, get_account, list_hardware')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')