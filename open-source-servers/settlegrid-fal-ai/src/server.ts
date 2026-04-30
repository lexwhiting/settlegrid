/**
 * settlegrid-fal-ai — Fal.ai Async Inference MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://queue.fal.run'

interface SubmitRequestInput {
  appId: string
  input: Record<string, unknown>
}

interface RequestIdInput {
  requestId: string
}

function getApiKey(): string {
  const k = process.env.FAL_API_KEY
  if (!k) throw new Error('FAL_API_KEY environment variable is required')
  return k
}

async function falFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const apiKey = getApiKey()
  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-fal-ai/1.0',
    },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300)
    throw new Error(`Fal.ai API error ${res.status}: ${text}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'fal-ai',
  pricing: {
    defaultCostCents: 2,
    methods: {
      submit_request: { costCents: 5, displayName: 'Submit Request' },
      get_request_status: { costCents: 1, displayName: 'Get Request Status' },
      get_request_result: { costCents: 2, displayName: 'Get Request Result' },
      cancel_request: { costCents: 1, displayName: 'Cancel Request' },
    },
  },
})

const submitRequest = sg.wrap(async (args: SubmitRequestInput) => {
  const appId = args.appId?.trim()
  if (!appId) throw new Error('appId is required')
  if (!args.input || typeof args.input !== 'object') throw new Error('input must be a non-null object')
  const data = await falFetch('POST', `/fal/queue/submit/${encodeURIComponent(appId)}`, args.input)
  return data
}, { method: 'submit_request' })

const getRequestStatus = sg.wrap(async (args: RequestIdInput) => {
  const requestId = args.requestId?.trim()
  if (!requestId) throw new Error('requestId is required')
  const data = await falFetch('GET', `/fal/queue/requests/${encodeURIComponent(requestId)}/status`)
  return data
}, { method: 'get_request_status' })

const getRequestResult = sg.wrap(async (args: RequestIdInput) => {
  const requestId = args.requestId?.trim()
  if (!requestId) throw new Error('requestId is required')
  const data = await falFetch('GET', `/fal/queue/requests/${encodeURIComponent(requestId)}/response`)
  return data
}, { method: 'get_request_result' })

const cancelRequest = sg.wrap(async (args: RequestIdInput) => {
  const requestId = args.requestId?.trim()
  if (!requestId) throw new Error('requestId is required')
  const data = await falFetch('GET', `/fal/queue/requests/${encodeURIComponent(requestId)}/cancel`)
  return data
}, { method: 'cancel_request' })

export { submitRequest, getRequestStatus, getRequestResult, cancelRequest }
console.log('settlegrid-fal-ai MCP server ready')
console.log('Methods: submit_request, get_request_status, get_request_result, cancel_request')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')