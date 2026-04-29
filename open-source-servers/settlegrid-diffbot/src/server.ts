/**
 * settlegrid-diffbot — Diffbot Analyze API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface AnalyzeUrlInput {
  url: string
  mode?: string
  fallback?: string
  fields?: string
  discussion?: boolean
  timeout?: number
}

const BASE = 'https://api.diffbot.com'

function getApiKey(): string {
  const k = process.env.DIFFBOT_API_KEY
  if (!k) throw new Error('DIFFBOT_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'diffbot',
  pricing: {
    defaultCostCents: 5,
    methods: {
      analyze_url: { costCents: 5, displayName: 'Analyze URL' },
    },
  },
})

const analyzeUrl = sg.wrap(async (args: AnalyzeUrlInput) => {
  const token = getApiKey()

  const pageUrl = args.url?.trim()
  if (!pageUrl) throw new Error('url is required')

  const params = new URLSearchParams()
  params.set('token', token)
  params.set('url', pageUrl)

  if (args.mode) {
    const allowedModes = ['article', 'product', 'discussion', 'image', 'video', 'list', 'event']
    const mode = args.mode.trim().toLowerCase()
    if (!allowedModes.includes(mode)) {
      throw new Error(`Invalid mode. Must be one of: ${allowedModes.join(', ')}`)
    }
    params.set('mode', mode)
  }

  if (args.fallback) {
    params.set('fallback', args.fallback.trim())
  }

  if (args.fields) {
    params.set('fields', args.fields.trim())
  }

  if (args.discussion === false) {
    params.set('discussion', 'false')
  }

  if (args.timeout !== undefined) {
    const clampedTimeout = Math.min(Math.max(args.timeout, 1), 60000)
    params.set('timeout', String(clampedTimeout))
  }

  const requestUrl = `${BASE}/v3/analyze?${params.toString()}`

  let res: Response
  try {
    res = await fetch(requestUrl, {
      headers: { 'User-Agent': 'settlegrid-diffbot/1.0' },
    })
  } catch (err) {
    throw new Error(`Network error calling Diffbot API: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Diffbot API error ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json() as {
    type?: string
    resolvedPageUrl?: string
    humanLanguage?: string
    objects?: unknown[]
    request?: unknown
    error?: string
    errorCode?: number
  }

  if (data.error) {
    throw new Error(`Diffbot extraction error (${data.errorCode ?? 'unknown'}): ${data.error}`)
  }

  return {
    type: data.type,
    resolvedPageUrl: data.resolvedPageUrl,
    humanLanguage: data.humanLanguage,
    objectCount: Array.isArray(data.objects) ? data.objects.length : 0,
    objects: data.objects ?? [],
    request: data.request,
  }
}, { method: 'analyze_url' })

export { analyzeUrl }
console.log('settlegrid-diffbot MCP server ready')
console.log('Methods: analyze_url')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')