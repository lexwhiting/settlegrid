/**
 * settlegrid-voyage-ai — Voyage AI Embeddings MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface CreateEmbeddingsInput {
  input: string | string[]
  model: string
  input_type?: string
  truncation?: boolean
  encoding_format?: string
}

interface CreateQueryEmbeddingInput {
  query: string
  model: string
  encoding_format?: string
}

interface CreateDocumentEmbeddingsInput {
  documents: string[]
  model: string
  truncation?: boolean
  encoding_format?: string
}

interface VoyageEmbeddingResponse {
  object: string
  data: Array<{ object: string; embedding: number[] | string; index: number }>
  model: string
  usage: { total_tokens: number }
}

const BASE = 'https://api.voyageai.com/v1'
const VALID_INPUT_TYPES = new Set(['query', 'document'])
const VALID_ENCODING_FORMATS = new Set(['float', 'base64'])
const MAX_BATCH_SIZE = 128

function getApiKey(): string {
  const k = process.env.VOYAGE_API_KEY
  if (!k) throw new Error('VOYAGE_API_KEY environment variable is required')
  return k
}

async function voyageFetch(body: Record<string, unknown>): Promise<VoyageEmbeddingResponse> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-voyage-ai/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Voyage AI API ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json() as Promise<VoyageEmbeddingResponse>
}

const sg = settlegrid.init({
  toolSlug: 'voyage-ai',
  pricing: {
    defaultCostCents: 3,
    methods: {
      create_embeddings: { costCents: 3, displayName: 'Create Embeddings' },
      create_query_embedding: { costCents: 2, displayName: 'Create Query Embedding' },
      create_document_embeddings: { costCents: 3, displayName: 'Create Document Embeddings' },
    },
  },
})

const createEmbeddings = sg.wrap(async (args: CreateEmbeddingsInput) => {
  if (!args.input) throw new Error('input is required')
  if (!args.model?.trim()) throw new Error('model is required')

  const inputArr = Array.isArray(args.input) ? args.input : [args.input]
  if (inputArr.length === 0) throw new Error('input must not be empty')
  const batchedInput = inputArr.slice(0, MAX_BATCH_SIZE)

  const body: Record<string, unknown> = {
    input: batchedInput.length === 1 && !Array.isArray(args.input) ? batchedInput[0] : batchedInput,
    model: args.model.trim(),
  }

  if (args.input_type !== undefined) {
    if (!VALID_INPUT_TYPES.has(args.input_type)) {
      throw new Error(`input_type must be one of: ${[...VALID_INPUT_TYPES].join(', ')}`)
    }
    body.input_type = args.input_type
  }
  if (args.truncation !== undefined) body.truncation = args.truncation
  if (args.encoding_format !== undefined) {
    if (!VALID_ENCODING_FORMATS.has(args.encoding_format)) {
      throw new Error(`encoding_format must be one of: ${[...VALID_ENCODING_FORMATS].join(', ')}`)
    }
    body.encoding_format = args.encoding_format
  }

  const data = await voyageFetch(body)
  return {
    model: data.model,
    count: data.data.length,
    total_tokens: data.usage.total_tokens,
    embeddings: data.data.map(d => ({ index: d.index, embedding: d.embedding })),
  }
}, { method: 'create_embeddings' })

const createQueryEmbedding = sg.wrap(async (args: CreateQueryEmbeddingInput) => {
  const query = args.query?.trim()
  if (!query) throw new Error('query is required')
  if (!args.model?.trim()) throw new Error('model is required')

  const body: Record<string, unknown> = {
    input: query,
    model: args.model.trim(),
    input_type: 'query',
  }
  if (args.encoding_format !== undefined) {
    if (!VALID_ENCODING_FORMATS.has(args.encoding_format)) {
      throw new Error(`encoding_format must be one of: ${[...VALID_ENCODING_FORMATS].join(', ')}`)
    }
    body.encoding_format = args.encoding_format
  }

  const data = await voyageFetch(body)
  const first = data.data[0]
  if (!first) throw new Error('No embedding returned')
  return {
    model: data.model,
    total_tokens: data.usage.total_tokens,
    embedding: first.embedding,
  }
}, { method: 'create_query_embedding' })

const createDocumentEmbeddings = sg.wrap(async (args: CreateDocumentEmbeddingsInput) => {
  if (!Array.isArray(args.documents) || args.documents.length === 0) {
    throw new Error('documents must be a non-empty array')
  }
  if (!args.model?.trim()) throw new Error('model is required')

  const docs = args.documents.slice(0, MAX_BATCH_SIZE)

  const body: Record<string, unknown> = {
    input: docs,
    model: args.model.trim(),
    input_type: 'document',
  }
  if (args.truncation !== undefined) body.truncation = args.truncation
  if (args.encoding_format !== undefined) {
    if (!VALID_ENCODING_FORMATS.has(args.encoding_format)) {
      throw new Error(`encoding_format must be one of: ${[...VALID_ENCODING_FORMATS].join(', ')}`)
    }
    body.encoding_format = args.encoding_format
  }

  const data = await voyageFetch(body)
  return {
    model: data.model,
    count: data.data.length,
    total_tokens: data.usage.total_tokens,
    embeddings: data.data.map(d => ({ index: d.index, embedding: d.embedding })),
  }
}, { method: 'create_document_embeddings' })

export { createEmbeddings, createQueryEmbedding, createDocumentEmbeddings }
console.log('settlegrid-voyage-ai MCP server ready')
console.log('Methods: create_embeddings, create_query_embedding, create_document_embeddings')
console.log('Pricing: 2-3¢ per call | Powered by SettleGrid')