/**
 * settlegrid-galileo-insights — Galileo Insights MCP Server
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
      'User-Agent': 'settlegrid-galileo-insights/1.0',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Galileo API ${res.status}: ${errText.slice(0, 200)}`)
  }
  return res.json()
}

interface ListScorersInput { limit?: number }
interface GetScorerInput { scorer_id: string }
interface ListScorerVersionsInput { scorer_id: string }
interface ListAnnotationTemplatesInput { project_id: string }
interface GetAnnotationTemplateInput { project_id: string; template_id: string }
interface GetDatasetInput { dataset_id: string }
interface GetDatasetContentInput { dataset_id: string }

const sg = settlegrid.init({
  toolSlug: 'galileo-insights',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_scorers: { costCents: 1, displayName: 'List Scorers' },
      get_scorer: { costCents: 1, displayName: 'Get Scorer' },
      list_scorer_versions: { costCents: 1, displayName: 'List Scorer Versions' },
      list_annotation_templates: { costCents: 1, displayName: 'List Annotation Templates' },
      get_annotation_template: { costCents: 1, displayName: 'Get Annotation Template' },
      list_datasets: { costCents: 1, displayName: 'List Datasets' },
      get_dataset: { costCents: 1, displayName: 'Get Dataset' },
      get_dataset_content: { costCents: 2, displayName: 'Get Dataset Content' },
    },
  },
})

const listScorers = sg.wrap(async (args: ListScorersInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await galileoFetch('/v2/scorers/list', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  })
  return data
}, { method: 'list_scorers' })

const getScorer = sg.wrap(async (args: GetScorerInput) => {
  const id = args.scorer_id?.trim()
  if (!id) throw new Error('scorer_id is required')
  return galileoFetch(`/v2/scorers/${encodeURIComponent(id)}`)
}, { method: 'get_scorer' })

const listScorerVersions = sg.wrap(async (args: ListScorerVersionsInput) => {
  const id = args.scorer_id?.trim()
  if (!id) throw new Error('scorer_id is required')
  return galileoFetch(`/v2/scorers/${encodeURIComponent(id)}/versions`)
}, { method: 'list_scorer_versions' })

const listAnnotationTemplates = sg.wrap(async (args: ListAnnotationTemplatesInput) => {
  const pid = args.project_id?.trim()
  if (!pid) throw new Error('project_id is required')
  return galileoFetch(`/v2/projects/${encodeURIComponent(pid)}/annotation/templates`)
}, { method: 'list_annotation_templates' })

const getAnnotationTemplate = sg.wrap(async (args: GetAnnotationTemplateInput) => {
  const pid = args.project_id?.trim()
  const tid = args.template_id?.trim()
  if (!pid) throw new Error('project_id is required')
  if (!tid) throw new Error('template_id is required')
  return galileoFetch(`/v2/projects/${encodeURIComponent(pid)}/annotation/templates/${encodeURIComponent(tid)}`)
}, { method: 'get_annotation_template' })

const listDatasets = sg.wrap(async (_args: Record<string, never>) => {
  return galileoFetch('/v2/datasets')
}, { method: 'list_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  const id = args.dataset_id?.trim()
  if (!id) throw new Error('dataset_id is required')
  return galileoFetch(`/v2/datasets/${encodeURIComponent(id)}`)
}, { method: 'get_dataset' })

const getDatasetContent = sg.wrap(async (args: GetDatasetContentInput) => {
  const id = args.dataset_id?.trim()
  if (!id) throw new Error('dataset_id is required')
  return galileoFetch(`/v2/datasets/${encodeURIComponent(id)}/content`)
}, { method: 'get_dataset_content' })

export {
  listScorers,
  getScorer,
  listScorerVersions,
  listAnnotationTemplates,
  getAnnotationTemplate,
  listDatasets,
  getDataset,
  getDatasetContent,
}

console.log('settlegrid-galileo-insights MCP server ready')
console.log('Methods: list_scorers, get_scorer, list_scorer_versions, list_annotation_templates, get_annotation_template, list_datasets, get_dataset, get_dataset_content')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')