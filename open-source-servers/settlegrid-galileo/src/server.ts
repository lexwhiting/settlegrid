/**
 * settlegrid-galileo — Galileo AI MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.galileo.ai'

function getApiKey(): string {
  const k = process.env.GALILEO_API_KEY
  if (!k) throw new Error('GALILEO_API_KEY environment variable is required')
  return k
}

async function galileoFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-galileo/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Galileo API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

interface ListAnnotationTemplatesInput { project_id: string }
interface GetAnnotationTemplateInput { project_id: string; template_id: string }
interface GetAnnotationRatingInput { project_id: string; template_id: string; trace_id: string }
interface GetScorerInput { scorer_id: string }
interface ListScorersInput { limit?: number }
interface ListScorerVersionsInput { scorer_id: string }
interface GetDatasetInput { dataset_id: string }
interface ListDatasetsInput {}

const sg = settlegrid.init({
  toolSlug: 'galileo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_annotation_templates: { costCents: 1, displayName: 'List Annotation Templates' },
      get_annotation_template: { costCents: 1, displayName: 'Get Annotation Template' },
      get_annotation_rating: { costCents: 1, displayName: 'Get Annotation Rating' },
      get_scorer: { costCents: 1, displayName: 'Get Scorer' },
      list_scorers: { costCents: 1, displayName: 'List Scorers' },
      list_scorer_versions: { costCents: 1, displayName: 'List Scorer Versions' },
      get_dataset: { costCents: 1, displayName: 'Get Dataset' },
      list_datasets: { costCents: 1, displayName: 'List Datasets' },
    },
  },
})

const listAnnotationTemplates = sg.wrap(async (args: ListAnnotationTemplatesInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  return galileoFetch(`/v2/projects/${encodeURIComponent(project_id)}/annotation/templates`)
}, { method: 'list_annotation_templates' })

const getAnnotationTemplate = sg.wrap(async (args: GetAnnotationTemplateInput) => {
  const project_id = args.project_id?.trim()
  const template_id = args.template_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  if (!template_id) throw new Error('template_id is required')
  return galileoFetch(`/v2/projects/${encodeURIComponent(project_id)}/annotation/templates/${encodeURIComponent(template_id)}`)
}, { method: 'get_annotation_template' })

const getAnnotationRating = sg.wrap(async (args: GetAnnotationRatingInput) => {
  const project_id = args.project_id?.trim()
  const template_id = args.template_id?.trim()
  const trace_id = args.trace_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  if (!template_id) throw new Error('template_id is required')
  if (!trace_id) throw new Error('trace_id is required')
  return galileoFetch(`/v2/projects/${encodeURIComponent(project_id)}/annotation/templates/${encodeURIComponent(template_id)}/traces/${encodeURIComponent(trace_id)}/rating`)
}, { method: 'get_annotation_rating' })

const getScorer = sg.wrap(async (args: GetScorerInput) => {
  const scorer_id = args.scorer_id?.trim()
  if (!scorer_id) throw new Error('scorer_id is required')
  return galileoFetch(`/v2/scorers/${encodeURIComponent(scorer_id)}`)
}, { method: 'get_scorer' })

const listScorers = sg.wrap(async (args: ListScorersInput) => {
  const limit = Math.min(args.limit || 20, 50)
  return galileoFetch('/v2/scorers/list', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  })
}, { method: 'list_scorers' })

const listScorerVersions = sg.wrap(async (args: ListScorerVersionsInput) => {
  const scorer_id = args.scorer_id?.trim()
  if (!scorer_id) throw new Error('scorer_id is required')
  return galileoFetch(`/v2/scorers/${encodeURIComponent(scorer_id)}/versions`)
}, { method: 'list_scorer_versions' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  const dataset_id = args.dataset_id?.trim()
  if (!dataset_id) throw new Error('dataset_id is required')
  return galileoFetch(`/v2/datasets/${encodeURIComponent(dataset_id)}`)
}, { method: 'get_dataset' })

const listDatasets = sg.wrap(async (_args: ListDatasetsInput) => {
  return galileoFetch('/v2/datasets')
}, { method: 'list_datasets' })

export {
  listAnnotationTemplates,
  getAnnotationTemplate,
  getAnnotationRating,
  getScorer,
  listScorers,
  listScorerVersions,
  getDataset,
  listDatasets,
}

console.log('settlegrid-galileo MCP server ready')
console.log('Methods: list_annotation_templates, get_annotation_template, get_annotation_rating, get_scorer, list_scorers, list_scorer_versions, get_dataset, list_datasets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')