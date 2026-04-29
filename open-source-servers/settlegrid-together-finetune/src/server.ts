/**
 * settlegrid-together-finetune — Together AI Fine-Tuning MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.together.xyz/v1'

function getApiKey(): string {
  const k = process.env.TOGETHER_API_KEY
  if (!k) throw new Error('TOGETHER_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const apiKey = getApiKey()
  const url = `${BASE}${path}`
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-together-finetune/1.0',
    },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }
  const res = await fetch(url, options)
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error')
    throw new Error(`Together AI API ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

interface CreateFinetuneInput {
  model: string
  training_file: string
  n_epochs?: number
  learning_rate?: number
  suffix?: string
}

interface ListFinetuneJobsInput {
  limit?: number
}

interface GetFinetuneJobInput {
  job_id: string
}

interface CancelFinetuneJobInput {
  job_id: string
}

interface ListFinetuneEventsInput {
  job_id: string
}

interface DeleteFinetuneModelInput {
  model_id: string
}

const sg = settlegrid.init({
  toolSlug: 'together-finetune',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_finetune_job: { costCents: 5, displayName: 'Create Fine-Tune Job' },
      list_finetune_jobs: { costCents: 1, displayName: 'List Fine-Tune Jobs' },
      get_finetune_job: { costCents: 1, displayName: 'Get Fine-Tune Job' },
      cancel_finetune_job: { costCents: 2, displayName: 'Cancel Fine-Tune Job' },
      list_finetune_events: { costCents: 1, displayName: 'List Fine-Tune Events' },
      delete_finetune_model: { costCents: 3, displayName: 'Delete Fine-Tuned Model' },
    },
  },
})

const createFinetuneJob = sg.wrap(async (args: CreateFinetuneInput) => {
  const model = args.model?.trim()
  if (!model) throw new Error('model is required')
  const trainingFile = args.training_file?.trim()
  if (!trainingFile) throw new Error('training_file is required')
  const nEpochs = args.n_epochs !== undefined ? Math.min(Math.max(1, args.n_epochs), 10) : undefined
  const payload: Record<string, unknown> = {
    model,
    training_file: trainingFile,
  }
  if (nEpochs !== undefined) payload.n_epochs = nEpochs
  if (args.learning_rate !== undefined) payload.learning_rate = args.learning_rate
  if (args.suffix) payload.suffix = args.suffix.trim().slice(0, 40)
  return apiFetch('POST', '/fine-tunes', payload)
}, { method: 'create_finetune_job' })

const listFinetuneJobs = sg.wrap(async (args: ListFinetuneJobsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await apiFetch('GET', '/fine-tunes') as { data?: unknown[] }
  const jobs = Array.isArray(data) ? data : (data.data ?? [])
  return { count: (jobs as unknown[]).length, jobs: (jobs as unknown[]).slice(0, limit) }
}, { method: 'list_finetune_jobs' })

const getFinetuneJob = sg.wrap(async (args: GetFinetuneJobInput) => {
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')
  return apiFetch('GET', `/fine-tunes/${encodeURIComponent(jobId)}`)
}, { method: 'get_finetune_job' })

const cancelFinetuneJob = sg.wrap(async (args: CancelFinetuneJobInput) => {
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')
  return apiFetch('POST', `/fine-tunes/${encodeURIComponent(jobId)}/cancel`)
}, { method: 'cancel_finetune_job' })

const listFinetuneEvents = sg.wrap(async (args: ListFinetuneEventsInput) => {
  const jobId = args.job_id?.trim()
  if (!jobId) throw new Error('job_id is required')
  return apiFetch('GET', `/fine-tunes/${encodeURIComponent(jobId)}/events`)
}, { method: 'list_finetune_events' })

const deleteFinetuneModel = sg.wrap(async (args: DeleteFinetuneModelInput) => {
  const modelId = args.model_id?.trim()
  if (!modelId) throw new Error('model_id is required')
  return apiFetch('DELETE', `/models/${encodeURIComponent(modelId)}`)
}, { method: 'delete_finetune_model' })

export {
  createFinetuneJob,
  listFinetuneJobs,
  getFinetuneJob,
  cancelFinetuneJob,
  listFinetuneEvents,
  deleteFinetuneModel,
}
console.log('settlegrid-together-finetune MCP server ready')
console.log('Methods: create_finetune_job, list_finetune_jobs, get_finetune_job, cancel_finetune_job, list_finetune_events, delete_finetune_model')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')