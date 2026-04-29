/**
 * settlegrid-mistral-ocr — Mistral OCR MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface OcrUrlInput {
  url: string
  model?: string
  include_image_base64?: boolean
}

interface OcrBase64Input {
  data: string
  media_type: string
  model?: string
  include_image_base64?: boolean
}

const BASE = 'https://api.mistral.ai'
const DEFAULT_MODEL = 'mistral-ocr-latest'

function getApiKey(): string {
  const k = process.env.MISTRAL_API_KEY
  if (!k) throw new Error('MISTRAL_API_KEY environment variable is required')
  return k
}

async function callOcr(body: unknown): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}/v1/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-mistral-ocr/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown error')
    throw new Error(`Mistral OCR API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'mistral-ocr',
  pricing: {
    defaultCostCents: 5,
    methods: {
      ocr_url: { costCents: 5, displayName: 'OCR from URL' },
      ocr_base64: { costCents: 5, displayName: 'OCR from Base64' },
    },
  },
})

const ocrUrl = sg.wrap(async (args: OcrUrlInput) => {
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const model = args.model?.trim() || DEFAULT_MODEL
  const includeImageBase64 = args.include_image_base64 ?? false

  const body = {
    model,
    document: {
      type: 'url',
      url,
    },
    include_image_base64: includeImageBase64,
  }

  return callOcr(body)
}, { method: 'ocr_url' })

const ocrBase64 = sg.wrap(async (args: OcrBase64Input) => {
  const data = args.data?.trim()
  if (!data) throw new Error('data is required')
  const mediaType = args.media_type?.trim()
  if (!mediaType) throw new Error('media_type is required')
  const model = args.model?.trim() || DEFAULT_MODEL
  const includeImageBase64 = args.include_image_base64 ?? false

  // Determine document type based on media_type
  const isImage = mediaType.startsWith('image/')
  const documentType = isImage ? 'image_url' : 'document_url'
  const dataUri = `data:${mediaType};base64,${data}`

  const body = {
    model,
    document: {
      type: documentType,
      ...(isImage ? { image_url: dataUri } : { document_url: dataUri }),
    },
    include_image_base64: includeImageBase64,
  }

  return callOcr(body)
}, { method: 'ocr_base64' })

export { ocrUrl, ocrBase64 }
console.log('settlegrid-mistral-ocr MCP server ready')
console.log('Methods: ocr_url, ocr_base64')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')