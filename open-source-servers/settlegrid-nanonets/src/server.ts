/**
 * settlegrid-nanonets — Nanonets OCR MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://app.nanonets.com/api/v2'

interface GetModelDetailsInput {
  model_id: string
}

interface BndBox {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

interface AnnotationObject {
  name: string
  ocr_text?: string
  bndbox: BndBox
}

interface AnnotationData {
  filename: string
  object?: AnnotationObject[]
}

interface UploadTrainingImagesInput {
  model_id: string
  urls: string[]
  data?: AnnotationData[]
}

function getApiKey(): string {
  const k = process.env.NANONETS_API_KEY
  if (!k) throw new Error('NANONETS_API_KEY environment variable is required')
  return k
}

function basicAuth(apiKey: string): string {
  return 'Basic ' + Buffer.from(apiKey + ':').toString('base64')
}

const sg = settlegrid.init({
  toolSlug: 'nanonets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_model_details: { costCents: 1, displayName: 'Get Model Details' },
      upload_training_images_by_url: { costCents: 3, displayName: 'Upload Training Images by URL' },
    },
  },
})

const getModelDetails = sg.wrap(async (args: GetModelDetailsInput) => {
  const apiKey = getApiKey()
  const modelId = args.model_id?.trim()
  if (!modelId) throw new Error('model_id is required')

  const res = await fetch(`${BASE}/OCR/Model/${encodeURIComponent(modelId)}`, {
    method: 'GET',
    headers: {
      'Authorization': basicAuth(apiKey),
      'User-Agent': 'settlegrid-nanonets/1.0',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Nanonets API error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'get_model_details' })

const uploadTrainingImagesByUrl = sg.wrap(async (args: UploadTrainingImagesInput) => {
  const apiKey = getApiKey()
  const modelId = args.model_id?.trim()
  if (!modelId) throw new Error('model_id is required')

  const urls = args.urls
  if (!Array.isArray(urls) || urls.length === 0) throw new Error('urls must be a non-empty array')

  const limitedUrls = urls.slice(0, 20)

  const payload: Record<string, unknown> = { urls: limitedUrls }
  if (args.data && Array.isArray(args.data)) {
    payload.data = args.data
  }

  const res = await fetch(`${BASE}/OCR/Model/${encodeURIComponent(modelId)}/UploadUrls`, {
    method: 'POST',
    headers: {
      'Authorization': basicAuth(apiKey),
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-nanonets/1.0',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok && res.status !== 202) {
    const text = await res.text().catch(() => '')
    throw new Error(`Nanonets API error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'upload_training_images_by_url' })

export { getModelDetails, uploadTrainingImagesByUrl }
console.log('settlegrid-nanonets MCP server ready')
console.log('Methods: get_model_details, upload_training_images_by_url')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')