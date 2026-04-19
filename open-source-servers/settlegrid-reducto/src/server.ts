/**
 * settlegrid-reducto — Reducto Document Parsing MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface ParseDocumentInput {
  document_url: string
  chunk_size?: number
  extract_tables?: boolean
  extract_images?: boolean
}

const BASE = 'https://v1.api.reducto.ai'

function getApiKey(): string {
  const k = process.env.REDUCTO_API_KEY
  if (!k) throw new Error('REDUCTO_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'reducto',
  pricing: {
    defaultCostCents: 8,
    methods: {
      parse_document: { costCents: 8, displayName: 'Parse Document' },
    },
  },
})

const parseDocument = sg.wrap(async (args: ParseDocumentInput) => {
  const apiKey = getApiKey()

  const url = args.document_url?.trim()
  if (!url) throw new Error('document_url is required')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('document_url must be a valid URL')
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('document_url must use http or https protocol')
  }

  const chunkSize = Math.min(Math.max(args.chunk_size ?? 512, 1), 4096)
  const extractTables = args.extract_tables ?? true
  const extractImages = args.extract_images ?? false

  const body: Record<string, unknown> = {
    document_url: url,
    chunk_size: chunkSize,
    extract_tables: extractTables,
    extract_images: extractImages,
  }

  let res: Response
  try {
    res = await fetch(`${BASE}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'settlegrid-reducto/1.0',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error(`Network error calling Reducto API: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!res.ok) {
    let errText = ''
    try { errText = (await res.text()).slice(0, 300) } catch {}
    throw new Error(`Reducto API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data
}, { method: 'parse_document' })

export { parseDocument }
console.log('settlegrid-reducto MCP server ready')
console.log('Methods: parse_document')
console.log('Pricing: 8¢ per call | Powered by SettleGrid')