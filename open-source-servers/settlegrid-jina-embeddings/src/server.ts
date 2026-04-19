/**
 * settlegrid-jina-embeddings — Jina Embeddings MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.jina.ai'
const DEFAULT_MODEL = 'jina-embeddings-v3'

interface CreateEmbeddingsInput {
  input: string[]
  model?: string
  task?: string
  dimensions?: number
  normalized?: boolean
  encoding_type?: string
}

interface CreateQueryEmbeddingInput {
  query: string
  model?: string
  dimensions?: number
  normalized?: boolean
}

interface CreatePassageEmbeddingsInput {
  passages: string[]
  model?: string
  dimensions?: number
  normalized?: boolean
}

interface JinaEmbeddingData {
  object: string
  index: number
  embedding: number[] | string
}

interface JinaEmbeddingsResponse {
  object: string
  model: string
  data: JinaEmbeddingData[]
  usage: { prompt_tokens: number; total_tokens: number }
}

function getApiKey(): string {
  const k = process.env.JINA_API_KEY
  if (!k) throw new Error('JINA_API_KEY environment variable is required. Get yours at https://jina.ai/embeddings')
  return k
}

async function postEmbeddings(body: Record<string, unknown>): Promise<JinaEmbeddingsResponse> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-jina-embeddings/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Jina AI API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json() as Promise<JinaEmbeddingsResponse>
}

const sg = settlegrid.init({
  toolSlug: 'jina-embeddings',
  pricing: {
    defaultCostCents: 5,
    methods: {
      create_embeddings: { costCents: 5, displayName: 'Create Embeddings' },
      create_query_embedding: { costCents: 3, displayName: 'Create Query Embedding' },
      create_passage_embeddings: { costCents: 5, displayName: 'Create Passage Embeddings' },
    },
  },
})

const createEmbeddings = sg.wrap(async (args: CreateEmbeddingsInput) => {
  if (!Array.isArray(args.input) || args.input.length === 0) {
    throw new Error('input must be a non-empty array of strings')
  }
  const clampedInput = args.input.slice(0, 50)
  const body: Record<string, unknown> = {
    model: args.model?.trim() || DEFAULT_MODEL,
    input: clampedInput,
  }
  if (args.task) body.task = args.task
  if (args.dimensions !== undefined) body.dimensions = Math.max(1, Math.floor(args.dimensions))
  if (args.normalized !== undefined) body.normalized = args.normalized
  if (args.encoding_type) body.encoding_type = args.encoding_type

  const data = await postEmbeddings(body)
  return {
    model: data.model,
    count: data.data.length,
    embeddings: data.data.map(d => ({ index: d.index, embedding: d.embedding })),
    usage: data.usage,
  }
}, { method: 'create_embeddings' })

const createQueryEmbedding = sg.wrap(async (args: CreateQueryEmbeddingInput) => {
  const query = args.query?.trim()
  if (!query) throw new Error('query is required and must not be empty')

  const body: Record<string, unknown> = {
    model: args.model?.trim() || DEFAULT_MODEL,
    input: [query],
    task: 'retrieval.query',
  }
  if (args.dimensions !== undefined) body.dimensions = Math.max(1, Math.floor(args.dimensions))
  if (args.normalized !== undefined) body.normalized = args.normalized

  const data = await postEmbeddings(body)
  const first = data.data[0]
  if (!first) throw new Error('No embedding returned for query')
  return {
    model: data.model,
    query,
    embedding: first.embedding,
    usage: data.usage,
  }
}, { method: 'create_query_embedding' })

const createPassageEmbeddings = sg.wrap(async (args: CreatePassageEmbeddingsInput) => {
  if (!Array.isArray(args.passages) || args.passages.length === 0) {
    throw new Error('passages must be a non-empty array of strings')
  }
  const clampedPassages = args.passages.slice(0, 50)
  const body: Record<string, unknown> = {
    model: args.model?.trim() || DEFAULT_MODEL,
    input: clampedPassages,
    task: 'retrieval.passage',
  }
  if (args.dimensions !== undefined) body.dimensions = Math.max(1, Math.floor(args.dimensions))
  if (args.normalized !== undefined) body.normalized = args.normalized

  const data = await postEmbeddings(body)
  return {
    model: data.model,
    count: data.data.length,
    embeddings: data.data.map(d => ({ index: d.index, embedding: d.embedding })),
    usage: data.usage,
  }
}, { method: 'create_passage_embeddings' })

export { createEmbeddings, createQueryEmbedding, createPassageEmbeddings }
console.log('settlegrid-jina-embeddings MCP server ready')
console.log('Methods: create_embeddings, create_query_embedding, create_passage_embeddings')
console.log('Pricing: 3-5¢ per call | Powered by SettleGrid')