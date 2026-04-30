/**
 * settlegrid-langwatch — LangWatch Traces MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface SearchTracesInput {
  query?: string
  limit?: number
}

interface GetTraceInput {
  traceId: string
}

const BASE = 'https://langwatch.ai'

function getApiKey(): string {
  const k = process.env.LANGWATCH_API_KEY
  if (!k) throw new Error('LANGWATCH_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'langwatch',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_traces: { costCents: 2, displayName: 'Search Traces' },
      get_trace: { costCents: 1, displayName: 'Get Trace' },
    },
  },
})

const searchTraces = sg.wrap(async (args: SearchTracesInput) => {
  const apiKey = getApiKey()
  const limit = Math.min(args.limit || 20, 50)
  const url = new URL(`${BASE}/api/traces`)
  if (args.query && args.query.trim()) {
    url.searchParams.set('query', args.query.trim())
  }
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-langwatch/1.0',
    },
  })

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`LangWatch API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data
}, { method: 'search_traces' })

const getTrace = sg.wrap(async (args: GetTraceInput) => {
  const apiKey = getApiKey()
  const traceId = args.traceId?.trim()
  if (!traceId) throw new Error('traceId is required')

  const res = await fetch(`${BASE}/api/traces/${encodeURIComponent(traceId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-langwatch/1.0',
    },
  })

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`LangWatch API error ${res.status}: ${errText}`)
  }

  return res.json()
}, { method: 'get_trace' })

export { searchTraces, getTrace }
console.log('settlegrid-langwatch MCP server ready')
console.log('Methods: search_traces, get_trace')
console.log('Pricing: search_traces=2¢, get_trace=1¢ | Powered by SettleGrid')