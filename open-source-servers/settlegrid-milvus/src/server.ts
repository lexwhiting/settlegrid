/**
 * settlegrid-milvus — Milvus Vector Database MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface CreateCollectionInput {
  collectionName: string
  dimension?: number
  metricType?: string
  idType?: string
  autoId?: boolean
  primaryFieldName?: string
  vectorFieldName?: string
}

function getMilvusBase(): string {
  const host = process.env.MILVUS_HOST
  if (!host) throw new Error('MILVUS_HOST environment variable is required')
  const port = process.env.MILVUS_PORT || '19530'
  return `http://${host}:${port}`
}

function getMilvusToken(): string {
  const token = process.env.MILVUS_TOKEN
  if (!token) throw new Error('MILVUS_TOKEN environment variable is required')
  return token
}

const sg = settlegrid.init({
  toolSlug: 'milvus',
  pricing: {
    defaultCostCents: 5,
    methods: {
      create_collection: { costCents: 5, displayName: 'Create Collection' },
    },
  },
})

const createCollection = sg.wrap(async (args: CreateCollectionInput) => {
  const name = args.collectionName?.trim()
  if (!name) throw new Error('collectionName is required')

  const base = getMilvusBase()
  const token = getMilvusToken()

  const body: Record<string, unknown> = {
    collectionName: name,
  }

  if (args.dimension !== undefined) {
    const dim = Math.min(Math.max(Math.floor(args.dimension), 1), 32768)
    body.dimension = dim
  }
  if (args.metricType !== undefined) body.metricType = args.metricType.trim()
  if (args.idType !== undefined) body.idType = args.idType.trim()
  if (args.autoId !== undefined) body.autoId = args.autoId
  if (args.primaryFieldName !== undefined) body.primaryFieldName = args.primaryFieldName.trim()
  if (args.vectorFieldName !== undefined) body.vectorFieldName = args.vectorFieldName.trim()

  const res = await fetch(`${base}/v2/vectordb/collections/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'settlegrid-milvus/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Milvus API ${res.status}: ${errText}`)
  }

  const data = await res.json() as { code: number; message?: string; data?: unknown }

  if (data.code !== 0 && data.code !== 200) {
    throw new Error(`Milvus error (code ${data.code}): ${data.message || 'Unknown error'}`)
  }

  return {
    success: true,
    collectionName: name,
    message: data.message || 'Collection created successfully',
    data: data.data,
  }
}, { method: 'create_collection' })

export { createCollection }
console.log('settlegrid-milvus MCP server ready')
console.log('Methods: create_collection')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')