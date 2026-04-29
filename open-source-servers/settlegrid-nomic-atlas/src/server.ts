/**
 * settlegrid-nomic-atlas — Nomic Atlas Embeddings & File MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface EmbedTextInput {
  texts: string[]
  model?: string
  task_type?: string
}

interface EmbedImageInput {
  urls: string[]
  model?: string
}

interface ParseFileInput {
  file_id: string
}

interface ExtractFileInput {
  file_id: string
  schema?: string
}

const BASE = 'https://api.nomic.ai'

function getApiKey(): string {
  const k = process.env.NOMIC_API_KEY
  if (!k) throw new Error('NOMIC_API_KEY environment variable is required')
  return k
}

function authHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
    'User-Agent': 'settlegrid-nomic-atlas/1.0',
  }
}

const sg = settlegrid.init({
  toolSlug: 'nomic-atlas',
  pricing: {
    defaultCostCents: 3,
    methods: {
      embed_text: { costCents: 3, displayName: 'Embed Text' },
      embed_image: { costCents: 4, displayName: 'Embed Image' },
      parse_file: { costCents: 5, displayName: 'Parse File' },
      extract_file: { costCents: 5, displayName: 'Extract File' },
    },
  },
})

const embedText = sg.wrap(async (args: EmbedTextInput) => {
  if (!Array.isArray(args.texts) || args.texts.length === 0) {
    throw new Error('texts must be a non-empty array of strings')
  }
  const texts = args.texts.slice(0, 50)
  const model = args.model || 'nomic-embed-text-v1.5'
  const task_type = args.task_type || 'search_document'

  const res = await fetch(`${BASE}/v1/embedding/text`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ texts, model, task_type }),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Nomic Atlas API error ${res.status}: ${errText}`)
  }
  const data = await res.json() as {
    embeddings: number[][]
    model: string
    usage?: { prompt_tokens: number; total_tokens: number }
  }
  return {
    model: data.model,
    count: data.embeddings.length,
    dimensions: data.embeddings[0]?.length ?? 0,
    embeddings: data.embeddings,
    usage: data.usage,
  }
}, { method: 'embed_text' })

const embedImage = sg.wrap(async (args: EmbedImageInput) => {
  if (!Array.isArray(args.urls) || args.urls.length === 0) {
    throw new Error('urls must be a non-empty array of image URL strings')
  }
  const urls = args.urls.slice(0, 20)
  const model = args.model || 'nomic-embed-vision-v1.5'

  const res = await fetch(`${BASE}/v1/embedding/image`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ urls, model }),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Nomic Atlas API error ${res.status}: ${errText}`)
  }
  const data = await res.json() as {
    embeddings: number[][]
    model: string
    usage?: { total_tokens: number }
  }
  return {
    model: data.model,
    count: data.embeddings.length,
    dimensions: data.embeddings[0]?.length ?? 0,
    embeddings: data.embeddings,
    usage: data.usage,
  }
}, { method: 'embed_image' })

const parseFile = sg.wrap(async (args: ParseFileInput) => {
  const file_id = args.file_id?.trim()
  if (!file_id) throw new Error('file_id is required')

  const res = await fetch(`${BASE}/v1/parse`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ file_id }),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Nomic Atlas API error ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'parse_file' })

const extractFile = sg.wrap(async (args: ExtractFileInput) => {
  const file_id = args.file_id?.trim()
  if (!file_id) throw new Error('file_id is required')

  const body: Record<string, unknown> = { file_id }
  if (args.schema) {
    try {
      body.schema = JSON.parse(args.schema)
    } catch {
      throw new Error('schema must be a valid JSON string')
    }
  }

  const res = await fetch(`${BASE}/v1/extract`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Nomic Atlas API error ${res.status}: ${errText}`)
  }
  return res.json()
}, { method: 'extract_file' })

export { embedText, embedImage, parseFile, extractFile }
console.log('settlegrid-nomic-atlas MCP server ready')
console.log('Methods: embed_text, embed_image, parse_file, extract_file')
console.log('Pricing: 3-5¢ per call | Powered by SettleGrid')