/**
 * settlegrid-weave — Weights & Biases Weave Service API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

// --- Types ---
interface GetCallInput { project_id: string; call_id: string }
interface QueryCallsInput { project_id: string; filter?: string; limit?: number }
interface GetCallStatsInput { project_id: string; filter?: string }
interface QueryObjectsInput { project_id: string; object_type?: string; limit?: number }
interface QueryFeedbackInput { project_id: string; call_id?: string; limit?: number }
interface CreateFeedbackInput { project_id: string; call_id: string; feedback_type: string; payload: string }
interface QueryCostInput { project_id: string; filter?: string; limit?: number }
interface ReadRefsInput { refs: string[] }

const BASE = 'https://trace.wandb.ai'

// --- Lazy env-var read ---
function getApiKey(): string {
  const k = process.env.WANDB_API_KEY
  if (!k) throw new Error('WANDB_API_KEY environment variable is required')
  return k
}

function basicAuth(): string {
  return 'Basic ' + Buffer.from(`api:${getApiKey()}`).toString('base64')
}

async function weavePost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': basicAuth(),
      'User-Agent': 'settlegrid-weave/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Weave API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

async function weaveGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': basicAuth(),
      'User-Agent': 'settlegrid-weave/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Weave API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

// --- Init SettleGrid ---
const sg = settlegrid.init({
  toolSlug: 'weave',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_call:       { costCents: 1, displayName: 'Get Call' },
      query_calls:    { costCents: 2, displayName: 'Query Calls' },
      get_call_stats: { costCents: 2, displayName: 'Get Call Stats' },
      query_objects:  { costCents: 2, displayName: 'Query Objects' },
      query_feedback: { costCents: 2, displayName: 'Query Feedback' },
      create_feedback:{ costCents: 3, displayName: 'Create Feedback' },
      query_cost:     { costCents: 2, displayName: 'Query Cost' },
      read_refs:      { costCents: 2, displayName: 'Read Refs' },
    },
  },
})

// --- Handlers ---

const getCall = sg.wrap(async (args: GetCallInput) => {
  const project_id = args.project_id?.trim()
  const call_id = args.call_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  if (!call_id) throw new Error('call_id is required')
  return weaveGet(`/${encodeURIComponent(project_id)}/call/${encodeURIComponent(call_id)}`)
}, { method: 'get_call' })

const queryCalls = sg.wrap(async (args: QueryCallsInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  const limit = Math.min(args.limit || 20, 50)
  let filter: unknown = {}
  if (args.filter) {
    try { filter = JSON.parse(args.filter) } catch { throw new Error('filter must be valid JSON') }
  }
  return weavePost(`/${encodeURIComponent(project_id)}/calls/stream_query`, {
    project_id,
    filter,
    limit,
  })
}, { method: 'query_calls' })

const getCallStats = sg.wrap(async (args: GetCallStatsInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  let filter: unknown = {}
  if (args.filter) {
    try { filter = JSON.parse(args.filter) } catch { throw new Error('filter must be valid JSON') }
  }
  return weavePost(`/${encodeURIComponent(project_id)}/calls/query_stats`, {
    project_id,
    filter,
  })
}, { method: 'get_call_stats' })

const queryObjects = sg.wrap(async (args: QueryObjectsInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  const limit = Math.min(args.limit || 20, 50)
  const filter: Record<string, unknown> = {}
  if (args.object_type) filter['object_type'] = args.object_type.trim()
  return weavePost(`/${encodeURIComponent(project_id)}/objs/query`, {
    project_id,
    filter,
    limit,
  })
}, { method: 'query_objects' })

const queryFeedback = sg.wrap(async (args: QueryFeedbackInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  const limit = Math.min(args.limit || 20, 50)
  const filter: Record<string, unknown> = {}
  if (args.call_id) filter['weave_ref'] = args.call_id.trim()
  return weavePost(`/${encodeURIComponent(project_id)}/feedback/query`, {
    project_id,
    filter,
    limit,
  })
}, { method: 'query_feedback' })

const createFeedback = sg.wrap(async (args: CreateFeedbackInput) => {
  const project_id = args.project_id?.trim()
  const call_id = args.call_id?.trim()
  const feedback_type = args.feedback_type?.trim()
  if (!project_id) throw new Error('project_id is required')
  if (!call_id) throw new Error('call_id is required')
  if (!feedback_type) throw new Error('feedback_type is required')
  if (!args.payload) throw new Error('payload is required')
  let payload: unknown
  try { payload = JSON.parse(args.payload) } catch { throw new Error('payload must be valid JSON') }
  return weavePost(`/${encodeURIComponent(project_id)}/feedback/create`, {
    project_id,
    weave_ref: call_id,
    feedback_type,
    payload,
  })
}, { method: 'create_feedback' })

const queryCost = sg.wrap(async (args: QueryCostInput) => {
  const project_id = args.project_id?.trim()
  if (!project_id) throw new Error('project_id is required')
  const limit = Math.min(args.limit || 20, 50)
  let filter: unknown = {}
  if (args.filter) {
    try { filter = JSON.parse(args.filter) } catch { throw new Error('filter must be valid JSON') }
  }
  return weavePost(`/${encodeURIComponent(project_id)}/cost/query`, {
    project_id,
    filter,
    limit,
  })
}, { method: 'query_cost' })

const readRefs = sg.wrap(async (args: ReadRefsInput) => {
  if (!Array.isArray(args.refs) || args.refs.length === 0) throw new Error('refs must be a non-empty array')
  const refs = args.refs.slice(0, 50)
  // refs/read_batch is project-agnostic; derive project from first ref or use empty string
  const firstRef = refs[0]
  const match = firstRef.match(/^weave:\/\/\/([^/]+\/[^/]+)\//)  
  const project_id = match ? match[1] : ''
  return weavePost(`${project_id ? '/' + encodeURIComponent(project_id) : ''}/refs/read_batch`, {
    refs,
  })
}, { method: 'read_refs' })

export { getCall, queryCalls, getCallStats, queryObjects, queryFeedback, createFeedback, queryCost, readRefs }

console.log('settlegrid-weave MCP server ready')
console.log('Methods: get_call, query_calls, get_call_stats, query_objects, query_feedback, create_feedback, query_cost, read_refs')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')