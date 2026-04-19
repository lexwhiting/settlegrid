/**
 * settlegrid-patronus-ai — Patronus AI Evaluation MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.patronus.ai'

interface RunEvaluationInput {
  evaluator: string
  input: string
  output: string
  context?: string
  expected?: string
}

interface ListEvaluatorsInput {
  limit?: number
}

interface CreateExperimentInput {
  name: string
  description?: string
  tags?: string[]
}

interface ListExperimentsInput {
  limit?: number
}

interface ListDatasetsInput {
  limit?: number
}

interface CreateDatasetInput {
  name: string
  description?: string
}

function getApiKey(): string {
  const k = process.env.PATRONUS_API_KEY
  if (!k) throw new Error('PATRONUS_API_KEY environment variable is required')
  return k
}

async function patronusFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const method = options.method ?? 'GET'
  const init: RequestInit = {
    method,
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-patronus-ai/1.0',
    },
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Patronus AI API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'patronus-ai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      run_evaluation: { costCents: 5, displayName: 'Run Evaluation' },
      list_evaluators: { costCents: 1, displayName: 'List Evaluators' },
      create_experiment: { costCents: 3, displayName: 'Create Experiment' },
      list_experiments: { costCents: 1, displayName: 'List Experiments' },
      list_datasets: { costCents: 1, displayName: 'List Datasets' },
      create_dataset: { costCents: 3, displayName: 'Create Dataset' },
    },
  },
})

const runEvaluation = sg.wrap(async (args: RunEvaluationInput) => {
  const evaluator = args.evaluator?.trim()
  if (!evaluator) throw new Error('evaluator is required')
  const input = args.input?.trim()
  if (!input) throw new Error('input is required')
  const output = args.output?.trim()
  if (!output) throw new Error('output is required')

  const body: Record<string, unknown> = {
    evaluators: [{ evaluator_id: evaluator }],
    evaluated_model_input: input,
    evaluated_model_output: output,
  }
  if (args.context) body.evaluated_model_retrieved_context = args.context
  if (args.expected) body.evaluated_model_gold_answer = args.expected

  return patronusFetch('/v1/evaluate', { method: 'POST', body })
}, { method: 'run_evaluation' })

const listEvaluators = sg.wrap(async (args: ListEvaluatorsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return patronusFetch(`/v1/evaluators?limit=${limit}`)
}, { method: 'list_evaluators' })

const createExperiment = sg.wrap(async (args: CreateExperimentInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')

  const body: Record<string, unknown> = { name }
  if (args.description) body.description = args.description
  if (args.tags && args.tags.length > 0) body.tags = args.tags

  return patronusFetch('/v1/experiments', { method: 'POST', body })
}, { method: 'create_experiment' })

const listExperiments = sg.wrap(async (args: ListExperimentsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return patronusFetch(`/v1/experiments?limit=${limit}`)
}, { method: 'list_experiments' })

const listDatasets = sg.wrap(async (args: ListDatasetsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return patronusFetch(`/v1/datasets?limit=${limit}`)
}, { method: 'list_datasets' })

const createDataset = sg.wrap(async (args: CreateDatasetInput) => {
  const name = args.name?.trim()
  if (!name) throw new Error('name is required')

  const body: Record<string, unknown> = { name }
  if (args.description) body.description = args.description

  return patronusFetch('/v1/datasets', { method: 'POST', body })
}, { method: 'create_dataset' })

export { runEvaluation, listEvaluators, createExperiment, listExperiments, listDatasets, createDataset }
console.log('settlegrid-patronus-ai MCP server ready')
console.log('Methods: run_evaluation, list_evaluators, create_experiment, list_experiments, list_datasets, create_dataset')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')