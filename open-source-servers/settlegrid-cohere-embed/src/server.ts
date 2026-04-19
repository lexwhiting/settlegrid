/**
 * settlegrid-cohere-embed — Cohere Embed MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface EmbedTextsInput {
  texts: string[]
  model?: string
  input_type?: string
  embedding_types?: string[]
}

interface EmbedSingleInput {
  text: string
  model?: string
  input_type?: string
}

const BASE = 'https://api.cohere.com'
const SLUG = 'cohere-embed'

function getApiKey(): string {
  const k = process.env.COHERE_API_KEY
  if (!k) throw new Error('COHERE_API_KEY environment variable is required')
  return k
}

async function coherePost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': `settlegrid-${SLUG}/1.0`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Cohere API error ${res.status}: ${errText}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: SLUG,
  pricing: {
    defaultCostCents: 3,
    methods: {
      embed_texts: { costCents: 5, displayName: 'Embed Texts (batch)' },
      embed_single: { costCents: 3, displayName: 'Embed Single Text' },
    },
  },
})

const embedTexts = sg.wrap(async (args: EmbedTextsInput) => {
  if (!args.texts || !Array.isArray(args.texts) || args.texts.length === 0) {
    throw new Error('texts must be a non-empty array of strings')
  }
  const texts = args.texts.slice(0, 96).map(t => String(t).trim()).filter(t => t.length > 0)
  if (texts.length === 0) throw new Error('texts array contains no non-empty strings')

  const model = args.model?.trim() || 'embed-english-v3.0'
  const input_type = args.input_type?.trim() || 'search_document'
  const embedding_types = args.embedding_types && args.embedding_types.length > 0
    ? args.embedding_types
    : ['float']

  const data = await coherePost('/v2/embed', {
    texts,
    model,
    input_type,
    embedding_types,
  }) as {
    id: string
    embeddings: Record<string, number[][]>
    texts: string[]
    meta?: unknown
  }

  return {
    id: data.id,
    model,
    input_type,
    embedding_types,
    count: texts.length,
    texts: data.texts,
    embeddings: data.embeddings,
  }
}, { method: 'embed_texts' })

const embedSingle = sg.wrap(async (args: EmbedSingleInput) => {
  const text = args.text?.trim()
  if (!text) throw new Error('text is required and must be non-empty')

  const model = args.model?.trim() || 'embed-english-v3.0'
  const input_type = args.input_type?.trim() || 'search_query'

  const data = await coherePost('/v2/embed', {
    texts: [text],
    model,
    input_type,
    embedding_types: ['float'],
  }) as {
    id: string
    embeddings: { float: number[][] }
    texts: string[]
    meta?: unknown
  }

  const vector = data.embeddings?.float?.[0] ?? []
  return {
    id: data.id,
    model,
    input_type,
    text,
    dimensions: vector.length,
    embedding: vector,
  }
}, { method: 'embed_single' })

export { embedTexts, embedSingle }
console.log('settlegrid-cohere-embed MCP server ready')
console.log('Methods: embed_texts, embed_single')
console.log('Pricing: embed_texts=5¢, embed_single=3¢ | Powered by SettleGrid')