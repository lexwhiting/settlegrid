/**
 * settlegrid-arize-phoenix — Arize Phoenix Observability MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://app.phoenix.arize.com'

function getApiKey(): string {
  const k = process.env.PHOENIX_API_KEY
  if (!k) throw new Error('PHOENIX_API_KEY environment variable is required')
  return k
}

async function phoenixFetch(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-arize-phoenix/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Phoenix API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

interface ListProjectsInput { limit?: number }
interface GetProjectInput { project_identifier: string }
interface ListSpansInput { limit?: number }
interface ListDatasetsInput { limit?: number }
interface GetDatasetInput { dataset_id: string }
interface ListDatasetExamplesInput { dataset_id: string; limit?: number }
interface ListExperimentsInput { limit?: number }
interface GetExperimentInput { experiment_id: string }

const sg = settlegrid.init({
  toolSlug: 'arize-phoenix',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_projects: { costCents: 1, displayName: 'List Projects' },
      get_project: { costCents: 1, displayName: 'Get Project' },
      list_spans: { costCents: 1, displayName: 'List Spans' },
      list_datasets: { costCents: 1, displayName: 'List Datasets' },
      get_dataset: { costCents: 1, displayName: 'Get Dataset' },
      list_dataset_examples: { costCents: 1, displayName: 'List Dataset Examples' },
      list_experiments: { costCents: 1, displayName: 'List Experiments' },
      get_experiment: { costCents: 1, displayName: 'Get Experiment' },
    },
  },
})

const listProjects = sg.wrap(async (args: ListProjectsInput) => {
  const apiKey = getApiKey()
  const limit = Math.min(args.limit || 20, 50)
  const data = await phoenixFetch(`/v1/projects?limit=${limit}`, apiKey)
  return data
}, { method: 'list_projects' })

const getProject = sg.wrap(async (args: GetProjectInput) => {
  const apiKey = getApiKey()
  const id = args.project_identifier?.trim()
  if (!id) throw new Error('project_identifier is required')
  const data = await phoenixFetch(`/v1/projects/${encodeURIComponent(id)}`, apiKey)
  return data
}, { method: 'get_project' })

const listSpans = sg.wrap(async (args: ListSpansInput) => {
  const apiKey = getApiKey()
  const limit = Math.min(args.limit || 20, 50)
  const data = await phoenixFetch(`/v1/spans?limit=${limit}`, apiKey)
  return data
}, { method: 'list_spans' })

const listDatasets = sg.wrap(async (args: ListDatasetsInput) => {
  const apiKey = getApiKey()
  const limit = Math.min(args.limit || 20, 50)
  const data = await phoenixFetch(`/v1/datasets?limit=${limit}`, apiKey)
  return data
}, { method: 'list_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  const apiKey = getApiKey()
  const id = args.dataset_id?.trim()
  if (!id) throw new Error('dataset_id is required')
  const data = await phoenixFetch(`/v1/datasets/${encodeURIComponent(id)}`, apiKey)
  return data
}, { method: 'get_dataset' })

const listDatasetExamples = sg.wrap(async (args: ListDatasetExamplesInput) => {
  const apiKey = getApiKey()
  const id = args.dataset_id?.trim()
  if (!id) throw new Error('dataset_id is required')
  const limit = Math.min(args.limit || 20, 50)
  const data = await phoenixFetch(`/v1/datasets/${encodeURIComponent(id)}/examples?limit=${limit}`, apiKey)
  return data
}, { method: 'list_dataset_examples' })

const listExperiments = sg.wrap(async (args: ListExperimentsInput) => {
  const apiKey = getApiKey()
  const limit = Math.min(args.limit || 20, 50)
  const data = await phoenixFetch(`/v1/experiments?limit=${limit}`, apiKey)
  return data
}, { method: 'list_experiments' })

const getExperiment = sg.wrap(async (args: GetExperimentInput) => {
  const apiKey = getApiKey()
  const id = args.experiment_id?.trim()
  if (!id) throw new Error('experiment_id is required')
  const data = await phoenixFetch(`/v1/experiments/${encodeURIComponent(id)}`, apiKey)
  return data
}, { method: 'get_experiment' })

export { listProjects, getProject, listSpans, listDatasets, getDataset, listDatasetExamples, listExperiments, getExperiment }
console.log('settlegrid-arize-phoenix MCP server ready')
console.log('Methods: list_projects, get_project, list_spans, list_datasets, get_dataset, list_dataset_examples, list_experiments, get_experiment')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')