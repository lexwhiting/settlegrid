/**
 * settlegrid-ideogram — Ideogram AI Image Generation MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.ideogram.ai'

function getApiKey(): string {
  const k = process.env.IDEOGRAM_API_KEY
  if (!k) throw new Error('IDEOGRAM_API_KEY environment variable is required')
  return k
}

interface GenerateImageInput {
  prompt: string
  aspect_ratio?: string
  style_type?: string
  style_preset?: string
  negative_prompt?: string
  num_images?: number
  rendering_speed?: string
  seed?: number
}

interface GenerateTransparentImageInput {
  prompt: string
  aspect_ratio?: string
  negative_prompt?: string
  num_images?: number
  rendering_speed?: string
  upscale_factor?: number
  seed?: number
}

interface EditImageInput {
  image_url: string
  mask_url: string
  prompt: string
  style_type?: string
  style_preset?: string
  num_images?: number
  rendering_speed?: string
  seed?: number
}

interface RemixImageInput {
  image_url: string
  prompt: string
  image_weight?: number
  aspect_ratio?: string
  style_type?: string
  style_preset?: string
  negative_prompt?: string
  num_images?: number
  rendering_speed?: string
  seed?: number
}

async function fetchImageBlob(url: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(url, { headers: { 'User-Agent': 'settlegrid-ideogram/1.0' } })
  if (!res.ok) throw new Error(`Failed to fetch image from URL ${url}: HTTP ${res.status}`)
  const blob = await res.blob()
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
  const filename = `image.${ext}`
  return { blob, filename }
}

const sg = settlegrid.init({
  toolSlug: 'ideogram',
  pricing: {
    defaultCostCents: 8,
    methods: {
      generate_image: { costCents: 8, displayName: 'Generate Image' },
      generate_transparent_image: { costCents: 8, displayName: 'Generate Transparent Image' },
      edit_image: { costCents: 8, displayName: 'Edit Image' },
      remix_image: { costCents: 8, displayName: 'Remix Image' },
    },
  },
})

const generateImage = sg.wrap(async (args: GenerateImageInput) => {
  const apiKey = getApiKey()
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const numImages = Math.min(Math.max(args.num_images || 1, 1), 4)

  const form = new FormData()
  form.append('prompt', prompt)
  form.append('num_images', String(numImages))
  if (args.aspect_ratio) form.append('aspect_ratio', args.aspect_ratio)
  if (args.style_type) form.append('style_type', args.style_type)
  if (args.style_preset) form.append('style_preset', args.style_preset)
  if (args.negative_prompt) form.append('negative_prompt', args.negative_prompt)
  if (args.rendering_speed) form.append('rendering_speed', args.rendering_speed)
  if (args.seed !== undefined) form.append('seed', String(args.seed))

  const res = await fetch(`${BASE}/v1/ideogram-v3/generate`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'User-Agent': 'settlegrid-ideogram/1.0',
    },
    body: form,
  })

  if (res.status === 401) throw new Error('Unauthorized: check your IDEOGRAM_API_KEY')
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Prompt failed safety check: ${JSON.stringify(body)}`)
  }
  if (res.status === 429) throw new Error('Rate limit exceeded: too many requests to Ideogram API')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ideogram API error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'generate_image' })

const generateTransparentImage = sg.wrap(async (args: GenerateTransparentImageInput) => {
  const apiKey = getApiKey()
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const numImages = Math.min(Math.max(args.num_images || 1, 1), 4)

  const form = new FormData()
  form.append('prompt', prompt)
  form.append('num_images', String(numImages))
  if (args.aspect_ratio) form.append('aspect_ratio', args.aspect_ratio)
  if (args.negative_prompt) form.append('negative_prompt', args.negative_prompt)
  if (args.rendering_speed) form.append('rendering_speed', args.rendering_speed)
  if (args.upscale_factor !== undefined) form.append('upscale_factor', String(args.upscale_factor))
  if (args.seed !== undefined) form.append('seed', String(args.seed))

  const res = await fetch(`${BASE}/v1/ideogram-v3/generate-transparent`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'User-Agent': 'settlegrid-ideogram/1.0',
    },
    body: form,
  })

  if (res.status === 401) throw new Error('Unauthorized: check your IDEOGRAM_API_KEY')
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Prompt failed safety check: ${JSON.stringify(body)}`)
  }
  if (res.status === 429) throw new Error('Rate limit exceeded: too many requests to Ideogram API')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ideogram API error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'generate_transparent_image' })

const editImage = sg.wrap(async (args: EditImageInput) => {
  const apiKey = getApiKey()
  if (!args.image_url?.trim()) throw new Error('image_url is required')
  if (!args.mask_url?.trim()) throw new Error('mask_url is required')
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const numImages = Math.min(Math.max(args.num_images || 1, 1), 4)

  const [{ blob: imageBlob, filename: imageName }, { blob: maskBlob, filename: maskName }] = await Promise.all([
    fetchImageBlob(args.image_url.trim()),
    fetchImageBlob(args.mask_url.trim()),
  ])

  const form = new FormData()
  form.append('image', imageBlob, imageName)
  form.append('mask', maskBlob, maskName)
  form.append('prompt', prompt)
  form.append('num_images', String(numImages))
  if (args.style_type) form.append('style_type', args.style_type)
  if (args.style_preset) form.append('style_preset', args.style_preset)
  if (args.rendering_speed) form.append('rendering_speed', args.rendering_speed)
  if (args.seed !== undefined) form.append('seed', String(args.seed))

  const res = await fetch(`${BASE}/v1/ideogram-v3/edit`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'User-Agent': 'settlegrid-ideogram/1.0',
    },
    body: form,
  })

  if (res.status === 401) throw new Error('Unauthorized: check your IDEOGRAM_API_KEY')
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Image or prompt failed safety check: ${JSON.stringify(body)}`)
  }
  if (res.status === 429) throw new Error('Rate limit exceeded: too many requests to Ideogram API')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ideogram API error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'edit_image' })

const remixImage = sg.wrap(async (args: RemixImageInput) => {
  const apiKey = getApiKey()
  if (!args.image_url?.trim()) throw new Error('image_url is required')
  const prompt = args.prompt?.trim()
  if (!prompt) throw new Error('prompt is required')
  const numImages = Math.min(Math.max(args.num_images || 1, 1), 4)
  const imageWeight = args.image_weight !== undefined ? Math.min(Math.max(args.image_weight, 0), 100) : 50

  const { blob: imageBlob, filename: imageName } = await fetchImageBlob(args.image_url.trim())

  const form = new FormData()
  form.append('image', imageBlob, imageName)
  form.append('prompt', prompt)
  form.append('image_weight', String(imageWeight))
  form.append('num_images', String(numImages))
  if (args.aspect_ratio) form.append('aspect_ratio', args.aspect_ratio)
  if (args.style_type) form.append('style_type', args.style_type)
  if (args.style_preset) form.append('style_preset', args.style_preset)
  if (args.negative_prompt) form.append('negative_prompt', args.negative_prompt)
  if (args.rendering_speed) form.append('rendering_speed', args.rendering_speed)
  if (args.seed !== undefined) form.append('seed', String(args.seed))

  const res = await fetch(`${BASE}/v1/ideogram-v3/remix`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'User-Agent': 'settlegrid-ideogram/1.0',
    },
    body: form,
  })

  if (res.status === 401) throw new Error('Unauthorized: check your IDEOGRAM_API_KEY')
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Image or prompt failed safety check: ${JSON.stringify(body)}`)
  }
  if (res.status === 429) throw new Error('Rate limit exceeded: too many requests to Ideogram API')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ideogram API error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}, { method: 'remix_image' })

export { generateImage, generateTransparentImage, editImage, remixImage }
console.log('settlegrid-ideogram MCP server ready')
console.log('Methods: generate_image, generate_transparent_image, edit_image, remix_image')
console.log('Pricing: 8¢ per call | Powered by SettleGrid')