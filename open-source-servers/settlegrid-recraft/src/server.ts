/**
 * settlegrid-recraft — Recraft AI Image Generation MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://external.api.recraft.ai/v1'

function getApiKey(): string {
  const k = process.env.RECRAFT_API_KEY
  if (!k) throw new Error('RECRAFT_API_KEY environment variable is required')
  return k
}

interface GenerateImageInput {
  prompt: string
  style?: string
  width?: number
  height?: number
  n?: number
}

interface EditImageInput {
  image_url: string
  prompt: string
  style?: string
}

interface VectorizeInput {
  image_url: string
}

interface RemoveBackgroundInput {
  image_url: string
}

interface ClarityUpscaleInput {
  image_url: string
}

interface GenerativeUpscaleInput {
  image_url: string
}

interface DeleteStyleInput {
  id: string
}

async function recraftPost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-recraft/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Recraft API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

async function recraftPostFormUrl(path: string, image_url: string, extra?: Record<string, string>): Promise<unknown> {
  const key = getApiKey()
  const form = new FormData()
  // Fetch the image and attach as blob
  const imgRes = await fetch(image_url, { headers: { 'User-Agent': 'settlegrid-recraft/1.0' } })
  if (!imgRes.ok) throw new Error(`Failed to fetch source image: ${imgRes.status}`)
  const imgBlob = await imgRes.blob()
  form.append('file', imgBlob, 'image.png')
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      form.append(k, v)
    }
  }
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'User-Agent': 'settlegrid-recraft/1.0',
    },
    body: form,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Recraft API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'recraft',
  pricing: {
    defaultCostCents: 5,
    methods: {
      generate_image: { costCents: 8, displayName: 'Generate Image' },
      edit_image: { costCents: 8, displayName: 'Edit Image' },
      vectorize_image: { costCents: 5, displayName: 'Vectorize Image' },
      remove_background: { costCents: 5, displayName: 'Remove Background' },
      clarity_upscale: { costCents: 5, displayName: 'Clarity Upscale' },
      generative_upscale: { costCents: 8, displayName: 'Generative Upscale' },
      list_styles: { costCents: 1, displayName: 'List Styles' },
      delete_style: { costCents: 2, displayName: 'Delete Style' },
    },
  },
})

const generateImage = sg.wrap(async (args: GenerateImageInput) => {
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const n = Math.min(args.n || 1, 6)
  const body: Record<string, unknown> = { prompt, n }
  if (args.style) body.style = args.style
  if (args.width) body.width = args.width
  if (args.height) body.height = args.height
  return recraftPost('/images/generations', body)
}, { method: 'generate_image' })

const editImage = sg.wrap(async (args: EditImageInput) => {
  const image_url = args.image_url?.trim()
  const prompt = args.prompt?.trim()
  if (!image_url) throw new Error('image_url is required')
  if (!prompt) throw new Error('prompt is required')
  const extra: Record<string, string> = { prompt }
  if (args.style) extra.style = args.style
  return recraftPostFormUrl('/images/edits', image_url, extra)
}, { method: 'edit_image' })

const vectorizeImage = sg.wrap(async (args: VectorizeInput) => {
  const image_url = args.image_url?.trim()
  if (!image_url) throw new Error('image_url is required')
  return recraftPostFormUrl('/images/vectorize', image_url)
}, { method: 'vectorize_image' })

const removeBackground = sg.wrap(async (args: RemoveBackgroundInput) => {
  const image_url = args.image_url?.trim()
  if (!image_url) throw new Error('image_url is required')
  return recraftPostFormUrl('/images/removeBackground', image_url)
}, { method: 'remove_background' })

const clarityUpscale = sg.wrap(async (args: ClarityUpscaleInput) => {
  const image_url = args.image_url?.trim()
  if (!image_url) throw new Error('image_url is required')
  return recraftPostFormUrl('/images/clarityUpscale', image_url)
}, { method: 'clarity_upscale' })

const generativeUpscale = sg.wrap(async (args: GenerativeUpscaleInput) => {
  const image_url = args.image_url?.trim()
  if (!image_url) throw new Error('image_url is required')
  return recraftPostFormUrl('/images/generativeUpscale', image_url)
}, { method: 'generative_upscale' })

const listStyles = sg.wrap(async () => {
  const key = getApiKey()
  const res = await fetch(`${BASE}/styles`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'User-Agent': 'settlegrid-recraft/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Recraft API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'list_styles' })

const deleteStyle = sg.wrap(async (args: DeleteStyleInput) => {
  const id = args.id?.trim()
  if (!id) throw new Error('id is required')
  const key = getApiKey()
  const res = await fetch(`${BASE}/styles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${key}`,
      'User-Agent': 'settlegrid-recraft/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Recraft API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : { success: true, id }
}, { method: 'delete_style' })

export { generateImage, editImage, vectorizeImage, removeBackground, clarityUpscale, generativeUpscale, listStyles, deleteStyle }
console.log('settlegrid-recraft MCP server ready')
console.log('Methods: generate_image, edit_image, vectorize_image, remove_background, clarity_upscale, generative_upscale, list_styles, delete_style')
console.log('Pricing: 1-8¢ per call | Powered by SettleGrid')