/**
 * settlegrid-helicone — Helicone LLM Observability MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.helicone.ai'

function getApiKey(): string {
  const k = process.env.HELICONE_API_KEY
  if (!k) throw new Error('HELICONE_API_KEY environment variable is required')
  return k
}

interface GetRequestsInput { limit?: number; offset?: number }
interface GetRequestByIdInput { requestId: string }
interface SubmitFeedbackInput { requestId: string; rating: boolean }
interface QueryHqlInput { query: string }
interface EmptyInput {}

async function heliconeGet(path: string): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-helicone/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Helicone API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function heliconePost(path: string, body: unknown): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-helicone/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Helicone API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'helicone',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_requests:          { costCents: 1, displayName: 'Get Requests' },
      get_request_by_id:     { costCents: 1, displayName: 'Get Request By ID' },
      submit_request_feedback: { costCents: 2, displayName: 'Submit Request Feedback' },
      query_hql:             { costCents: 3, displayName: 'Query HQL' },
      get_datasets:          { costCents: 1, displayName: 'Get Datasets' },
      get_alerts:            { costCents: 1, displayName: 'Get Alerts' },
      get_sessions:          { costCents: 1, displayName: 'Get Sessions' },
      get_user_metrics:      { costCents: 2, displayName: 'Get User Metrics' },
    },
  },
})

const getRequests = sg.wrap(async (args: GetRequestsInput) => {
  const limit = Math.min(args.limit || 20, 100)
  const offset = Math.max(args.offset || 0, 0)
  return heliconeGet(`/v1/request?limit=${limit}&offset=${offset}`)
}, { method: 'get_requests' })

const getRequestById = sg.wrap(async (args: GetRequestByIdInput) => {
  const id = args.requestId?.trim()
  if (!id) throw new Error('requestId is required')
  return heliconeGet(`/v1/request/${encodeURIComponent(id)}`)
}, { method: 'get_request_by_id' })

const submitRequestFeedback = sg.wrap(async (args: SubmitFeedbackInput) => {
  const id = args.requestId?.trim()
  if (!id) throw new Error('requestId is required')
  if (typeof args.rating !== 'boolean') throw new Error('rating must be a boolean')
  return heliconePost(`/v1/request/${encodeURIComponent(id)}/feedback`, { rating: args.rating })
}, { method: 'submit_request_feedback' })

const queryHql = sg.wrap(async (args: QueryHqlInput) => {
  const query = args.query?.trim()
  if (!query) throw new Error('query is required')
  return heliconePost('/v1/hql/query', { query })
}, { method: 'query_hql' })

const getDatasets = sg.wrap(async (_args: EmptyInput) => {
  return heliconeGet('/v1/datasets')
}, { method: 'get_datasets' })

const getAlerts = sg.wrap(async (_args: EmptyInput) => {
  return heliconeGet('/v1/alerts')
}, { method: 'get_alerts' })

const getSessions = sg.wrap(async (_args: EmptyInput) => {
  return heliconeGet('/v1/sessions')
}, { method: 'get_sessions' })

const getUserMetrics = sg.wrap(async (_args: EmptyInput) => {
  return heliconeGet('/v1/user/metrics')
}, { method: 'get_user_metrics' })

export {
  getRequests,
  getRequestById,
  submitRequestFeedback,
  queryHql,
  getDatasets,
  getAlerts,
  getSessions,
  getUserMetrics,
}

console.log('settlegrid-helicone MCP server ready')
console.log('Methods: get_requests, get_request_by_id, submit_request_feedback, query_hql, get_datasets, get_alerts, get_sessions, get_user_metrics')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')