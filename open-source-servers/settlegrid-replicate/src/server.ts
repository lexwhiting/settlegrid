/**
 * settlegrid-replicate — Replicate AI MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.replicate.com'

function getApiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN environment variable is required')
  return token
}

async function replicateFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const token = getApiToken()
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-replicate/1.0',
    },
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Replicate API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

interface CreatePredictionInput {
  version: string
  input: Record<string, unknown>
  webhook?: string
}

interface GetPredictionInput {
  prediction_id: string
}

interface ListPredictionsInput {
  cursor?: string
}

interface CancelPredictionInput {
  prediction_id: string
}

interface GetModelInput {
  model_owner: string
  model_name: string
}

interface ListModelVersionsInput {
  model_owner: string
  model_name: string
}

interface CreateModelPredictionInput {
  model_owner: string
  model_name: string
  input: Record<string, unknown>
  webhook?: string
}

const sg = settlegrid.init({
  toolSlug: 'replicate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_prediction: { costCents: 5, displayName: 'Create Prediction' },
      get_prediction: { costCents: 1, displayName: 'Get Prediction' },
      list_predictions: { costCents: 1, displayName: 'List Predictions' },
      cancel_prediction: { costCents: 2, displayName: 'Cancel Prediction' },
      get_model: { costCents: 1, displayName: 'Get Model' },
      list_model_versions: { costCents: 1, displayName: 'List Model Versions' },
      create_model_prediction: { costCents: 5, displayName: 'Create Model Prediction' },
      get_account: { costCents: 1, displayName: 'Get Account' },
    },
  },
})

const createPrediction = sg.wrap(async (args: CreatePredictionInput) => {
  const version = args.version?.trim()
  if (!version) throw new Error('version is required')
  if (!args.input || typeof args.input !== 'object') throw new Error('input must be a JSON object')
  const body: Record<string, unknown> = { version, input: args.input }
  if (args.webhook) body.webhook = args.webhook
  return replicateFetch('/v1/predictions', { method: 'POST', body })
}, { method: 'create_prediction' })

const getPrediction = sg.wrap(async (args: GetPredictionInput) => {
  const id = args.prediction_id?.trim()
  if (!id) throw new Error('prediction_id is required')
  return replicateFetch(`/v1/predictions/${encodeURIComponent(id)}`)
}, { method: 'get_prediction' })

const listPredictions = sg.wrap(async (args: ListPredictionsInput) => {
  const qs = args.cursor ? `?cursor=${encodeURIComponent(args.cursor)}` : ''
  return replicateFetch(`/v1/predictions${qs}`)
}, { method: 'list_predictions' })

const cancelPrediction = sg.wrap(async (args: CancelPredictionInput) => {
  const id = args.prediction_id?.trim()
  if (!id) throw new Error('prediction_id is required')
  return replicateFetch(`/v1/predictions/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}, { method: 'cancel_prediction' })

const getModel = sg.wrap(async (args: GetModelInput) => {
  const owner = args.model_owner?.trim()
  const name = args.model_name?.trim()
  if (!owner) throw new Error('model_owner is required')
  if (!name) throw new Error('model_name is required')
  return replicateFetch(`/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`)
}, { method: 'get_model' })

const listModelVersions = sg.wrap(async (args: ListModelVersionsInput) => {
  const owner = args.model_owner?.trim()
  const name = args.model_name?.trim()
  if (!owner) throw new Error('model_owner is required')
  if (!name) throw new Error('model_name is required')
  return replicateFetch(`/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/versions`)
}, { method: 'list_model_versions' })

const createModelPrediction = sg.wrap(async (args: CreateModelPredictionInput) => {
  const owner = args.model_owner?.trim()
  const name = args.model_name?.trim()
  if (!owner) throw new Error('model_owner is required')
  if (!name) throw new Error('model_name is required')
  if (!args.input || typeof args.input !== 'object') throw new Error('input must be a JSON object')
  const body: Record<string, unknown> = { input: args.input }
  if (args.webhook) body.webhook = args.webhook
  return replicateFetch(
    `/v1/models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/predictions`,
    { method: 'POST', body }
  )
}, { method: 'create_model_prediction' })

const getAccount = sg.wrap(async (_args: Record<string, never>) => {
  return replicateFetch('/v1/account')
}, { method: 'get_account' })

export {
  createPrediction,
  getPrediction,
  listPredictions,
  cancelPrediction,
  getModel,
  listModelVersions,
  createModelPrediction,
  getAccount,
}

console.log('settlegrid-replicate MCP server ready')
console.log('Methods: create_prediction, get_prediction, list_predictions, cancel_prediction, get_model, list_model_versions, create_model_prediction, get_account')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')