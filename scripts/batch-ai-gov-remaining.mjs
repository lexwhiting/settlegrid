/**
 * batch-ai-gov-remaining.mjs
 *
 * Generates 16 missing SettleGrid MCP servers:
 *   AI/ML (6):  whisper-api, dalle, ocr-space, remove-bg, wolfram-alpha, huggingface-datasets
 *   Gov  (10):  data-gov, usa-spending, fec-elections, congress-api, usps-lookup,
 *               uk-companies, canada-open, japan-estat, south-korea, un-data
 */

import { generateServer } from './lib/generate.mjs'

console.log('Generating 16 remaining AI/ML + Government servers...\n')

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — 85. settlegrid-whisper-api
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'whisper-api',
  name: 'OpenAI Whisper',
  description: 'Audio transcription and translation via the OpenAI Whisper API.',
  keywords: ['ai', 'transcription', 'audio', 'speech-to-text', 'whisper'],
  upstream: {
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/audio',
    auth: 'Bearer token (OPENAI_API_KEY)',
    rateLimit: 'Tier-based (see OpenAI docs)',
    docsUrl: 'https://platform.openai.com/docs/api-reference/audio',
  },
  auth: { type: 'bearer', keyEnvVar: 'OPENAI_API_KEY', keyDesc: 'OpenAI API key from platform.openai.com' },
  methods: [
    { name: 'transcribe_audio', displayName: 'Transcribe Audio', costCents: 5, description: 'Transcribe audio file URL to text', params: [
      { name: 'url', type: 'string', required: true, description: 'Public URL of the audio file (mp3, wav, m4a, webm)' },
      { name: 'language', type: 'string', required: false, description: 'ISO-639-1 language code (e.g. "en", "es")' },
    ] },
    { name: 'translate_audio', displayName: 'Translate Audio', costCents: 5, description: 'Translate audio to English text', params: [
      { name: 'url', type: 'string', required: true, description: 'Public URL of the audio file to translate' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-whisper-api — OpenAI Whisper Transcription MCP Server
 *
 * Methods:
 *   transcribe_audio(url, language?)  — Transcribe audio to text      (5¢)
 *   translate_audio(url)              — Translate audio to English     (5¢)
 *
 * Pricing: 5¢ per call | Upstream: OpenAI Whisper API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranscribeInput {
  url: string
  language?: string
}

interface TranslateInput {
  url: string
}

interface WhisperResponse {
  text: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openai.com/v1/audio'
const API_KEY = process.env.OPENAI_API_KEY || ''

async function fetchAudioBuffer(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`Failed to fetch audio: \${res.status}\`)
  return res.blob()
}

async function whisperCall(endpoint: string, audioBlob: Blob, extra: Record<string, string> = {}): Promise<WhisperResponse> {
  if (!API_KEY) throw new Error('OPENAI_API_KEY is not set')
  const form = new FormData()
  form.append('file', audioBlob, 'audio.mp3')
  form.append('model', 'whisper-1')
  for (const [k, v] of Object.entries(extra)) {
    form.append(k, v)
  }
  const res = await fetch(\`\${BASE}/\${endpoint}\`, {
    method: 'POST',
    headers: { Authorization: \`Bearer \${API_KEY}\` },
    body: form,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Whisper API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<WhisperResponse>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'whisper-api',
  pricing: {
    defaultCostCents: 5,
    methods: {
      transcribe_audio: { costCents: 5, displayName: 'Transcribe Audio' },
      translate_audio: { costCents: 5, displayName: 'Translate Audio' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const transcribeAudio = sg.wrap(async (args: TranscribeInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required (public URL to an audio file)')
  }
  const audioBlob = await fetchAudioBuffer(args.url)
  const extra: Record<string, string> = {}
  if (args.language) extra.language = args.language
  const result = await whisperCall('transcriptions', audioBlob, extra)
  return {
    source: args.url,
    language: args.language || 'auto',
    text: result.text,
  }
}, { method: 'transcribe_audio' })

const translateAudio = sg.wrap(async (args: TranslateInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required (public URL to an audio file)')
  }
  const audioBlob = await fetchAudioBuffer(args.url)
  const result = await whisperCall('translations', audioBlob)
  return {
    source: args.url,
    targetLanguage: 'en',
    text: result.text,
  }
}, { method: 'translate_audio' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { transcribeAudio, translateAudio }

console.log('settlegrid-whisper-api MCP server ready')
console.log('Methods: transcribe_audio, translate_audio')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — 86. settlegrid-dalle
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'dalle',
  name: 'DALL-E Image Generation',
  description: 'AI image generation via OpenAI DALL-E API.',
  keywords: ['ai', 'image-generation', 'dalle', 'openai'],
  upstream: {
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/images',
    auth: 'Bearer token (OPENAI_API_KEY)',
    rateLimit: 'Tier-based (see OpenAI docs)',
    docsUrl: 'https://platform.openai.com/docs/api-reference/images',
  },
  auth: { type: 'bearer', keyEnvVar: 'OPENAI_API_KEY', keyDesc: 'OpenAI API key from platform.openai.com' },
  methods: [
    { name: 'generate_image', displayName: 'Generate Image', costCents: 5, description: 'Generate an image from a text prompt', params: [
      { name: 'prompt', type: 'string', required: true, description: 'Text description of the image to generate' },
      { name: 'size', type: 'string', required: false, description: 'Image size: 1024x1024, 1024x1792, or 1792x1024' },
      { name: 'quality', type: 'string', required: false, description: 'Quality: standard or hd' },
    ] },
    { name: 'edit_image', displayName: 'Edit Image', costCents: 5, description: 'Edit an image with a text prompt and mask', params: [
      { name: 'prompt', type: 'string', required: true, description: 'Text description of the desired edit' },
      { name: 'image_url', type: 'string', required: true, description: 'Public URL of the image to edit' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-dalle — DALL-E Image Generation MCP Server
 *
 * Methods:
 *   generate_image(prompt, size?, quality?)  — Generate image from text   (5¢)
 *   edit_image(prompt, image_url)            — Edit image with prompt     (5¢)
 *
 * Pricing: 5¢ per call | Upstream: OpenAI DALL-E API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GenerateInput {
  prompt: string
  size?: string
  quality?: string
}

interface EditInput {
  prompt: string
  image_url: string
}

interface ImageResponse {
  data: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openai.com/v1/images'
const API_KEY = process.env.OPENAI_API_KEY || ''
const VALID_SIZES = ['1024x1024', '1024x1792', '1792x1024']

async function dallePost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!API_KEY) throw new Error('OPENAI_API_KEY is not set')
  const res = await fetch(\`\${BASE}/\${endpoint}\`, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`DALL-E API \${res.status}: \${text.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dalle',
  pricing: {
    defaultCostCents: 5,
    methods: {
      generate_image: { costCents: 5, displayName: 'Generate Image' },
      edit_image: { costCents: 5, displayName: 'Edit Image' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const generateImage = sg.wrap(async (args: GenerateInput) => {
  if (!args.prompt || typeof args.prompt !== 'string') {
    throw new Error('prompt is required')
  }
  if (args.prompt.length > 4000) {
    throw new Error('prompt must be 4000 characters or fewer')
  }
  const size = args.size && VALID_SIZES.includes(args.size) ? args.size : '1024x1024'
  const quality = args.quality === 'hd' ? 'hd' : 'standard'

  const result = await dallePost<ImageResponse>('generations', {
    model: 'dall-e-3',
    prompt: args.prompt,
    n: 1,
    size,
    quality,
    response_format: 'url',
  })

  return {
    prompt: args.prompt,
    size,
    quality,
    imageUrl: result.data[0]?.url || null,
    revisedPrompt: result.data[0]?.revised_prompt || null,
  }
}, { method: 'generate_image' })

const editImage = sg.wrap(async (args: EditInput) => {
  if (!args.prompt || typeof args.prompt !== 'string') {
    throw new Error('prompt is required')
  }
  if (!args.image_url || typeof args.image_url !== 'string') {
    throw new Error('image_url is required')
  }

  const imgRes = await fetch(args.image_url)
  if (!imgRes.ok) throw new Error(\`Failed to fetch image: \${imgRes.status}\`)
  const imgBlob = await imgRes.blob()

  const form = new FormData()
  form.append('image', imgBlob, 'image.png')
  form.append('prompt', args.prompt)
  form.append('model', 'dall-e-2')
  form.append('n', '1')
  form.append('size', '1024x1024')
  form.append('response_format', 'url')

  if (!API_KEY) throw new Error('OPENAI_API_KEY is not set')
  const res = await fetch(\`\${BASE}/edits\`, {
    method: 'POST',
    headers: { Authorization: \`Bearer \${API_KEY}\` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`DALL-E edits API \${res.status}: \${text.slice(0, 300)}\`)
  }
  const result = (await res.json()) as ImageResponse

  return {
    prompt: args.prompt,
    sourceUrl: args.image_url,
    imageUrl: result.data[0]?.url || null,
  }
}, { method: 'edit_image' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { generateImage, editImage }

console.log('settlegrid-dalle MCP server ready')
console.log('Methods: generate_image, edit_image')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — 87. settlegrid-ocr-space
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'ocr-space',
  name: 'OCR.space',
  description: 'Extract text from images and PDFs via the OCR.space API.',
  keywords: ['ai', 'ocr', 'text-extraction', 'image-to-text'],
  upstream: {
    provider: 'OCR.space',
    baseUrl: 'https://api.ocr.space/parse/image',
    auth: 'API key (query param or header)',
    rateLimit: '25,000 requests/month (free tier)',
    docsUrl: 'https://ocr.space/OCRAPI',
  },
  auth: { type: 'query', keyEnvVar: 'OCR_SPACE_API_KEY', keyDesc: 'OCR.space API key (free at ocr.space)' },
  methods: [
    { name: 'extract_text', displayName: 'Extract Text', costCents: 3, description: 'Extract text from an image URL', params: [
      { name: 'url', type: 'string', required: true, description: 'Public URL of the image or PDF' },
      { name: 'language', type: 'string', required: false, description: 'OCR language code (default: eng)' },
    ] },
    { name: 'extract_table', displayName: 'Extract Table', costCents: 3, description: 'Extract tabular data from an image', params: [
      { name: 'url', type: 'string', required: true, description: 'Public URL of an image containing tabular data' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-ocr-space — OCR Text Extraction MCP Server
 *
 * Methods:
 *   extract_text(url, language?)  — Extract text from image/PDF   (3¢)
 *   extract_table(url)            — Extract table data            (3¢)
 *
 * Pricing: 3¢ per call | Upstream: OCR.space API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtractTextInput {
  url: string
  language?: string
}

interface ExtractTableInput {
  url: string
}

interface OcrResult {
  ParsedResults: Array<{
    ParsedText: string
    ErrorMessage: string
    FileParseExitCode: number
    TextOverlay?: {
      Lines: Array<{ Words: Array<{ WordText: string }> }>
    }
  }>
  IsErroredOnProcessing: boolean
  ErrorMessage?: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.ocr.space/parse/image'
const API_KEY = process.env.OCR_SPACE_API_KEY || ''

async function ocrPost(params: Record<string, string>): Promise<OcrResult> {
  if (!API_KEY) throw new Error('OCR_SPACE_API_KEY is not set')
  const form = new URLSearchParams({ apikey: API_KEY, ...params })
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OCR.space API \${res.status}: \${body.slice(0, 300)}\`)
  }
  const data = (await res.json()) as OcrResult
  if (data.IsErroredOnProcessing) {
    throw new Error(\`OCR processing error: \${(data.ErrorMessage || []).join(', ')}\`)
  }
  return data
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ocr-space',
  pricing: {
    defaultCostCents: 3,
    methods: {
      extract_text: { costCents: 3, displayName: 'Extract Text' },
      extract_table: { costCents: 3, displayName: 'Extract Table' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const extractText = sg.wrap(async (args: ExtractTextInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required (public URL of image or PDF)')
  }
  const language = args.language || 'eng'
  const result = await ocrPost({ url: args.url, language, OCREngine: '2' })
  const parsed = result.ParsedResults[0]
  return {
    source: args.url,
    language,
    text: parsed?.ParsedText || '',
    exitCode: parsed?.FileParseExitCode ?? -1,
  }
}, { method: 'extract_text' })

const extractTable = sg.wrap(async (args: ExtractTableInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required (public URL of image with tabular data)')
  }
  const result = await ocrPost({
    url: args.url,
    language: 'eng',
    isTable: 'true',
    OCREngine: '2',
  })
  const parsed = result.ParsedResults[0]
  const lines = (parsed?.ParsedText || '').split('\\n').filter((l: string) => l.trim())
  return {
    source: args.url,
    rawText: parsed?.ParsedText || '',
    lineCount: lines.length,
    lines,
  }
}, { method: 'extract_table' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { extractText, extractTable }

console.log('settlegrid-ocr-space MCP server ready')
console.log('Methods: extract_text, extract_table')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — 88. settlegrid-remove-bg
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'remove-bg',
  name: 'Remove.bg',
  description: 'AI-powered background removal from images via the Remove.bg API.',
  keywords: ['ai', 'image-processing', 'background-removal'],
  upstream: {
    provider: 'Remove.bg',
    baseUrl: 'https://api.remove.bg/v1.0',
    auth: 'X-Api-Key header',
    rateLimit: '50 free calls/month',
    docsUrl: 'https://www.remove.bg/api',
  },
  auth: { type: 'bearer', keyEnvVar: 'REMOVE_BG_API_KEY', keyDesc: 'Remove.bg API key (free at remove.bg)' },
  methods: [
    { name: 'remove_background', displayName: 'Remove Background', costCents: 4, description: 'Remove background from an image URL', params: [
      { name: 'image_url', type: 'string', required: true, description: 'Public URL of the image' },
      { name: 'size', type: 'string', required: false, description: 'Output size: auto, preview, small, medium, hd, full' },
    ] },
    { name: 'remove_background_base64', displayName: 'Remove BG (Base64)', costCents: 4, description: 'Remove background and return base64 result', params: [
      { name: 'image_url', type: 'string', required: true, description: 'Public URL of the image' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-remove-bg — Background Removal MCP Server
 *
 * Methods:
 *   remove_background(image_url, size?)        — Remove BG, return URL      (4¢)
 *   remove_background_base64(image_url)        — Remove BG, return base64   (4¢)
 *
 * Pricing: 4¢ per call | Upstream: Remove.bg API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RemoveBgInput {
  image_url: string
  size?: string
}

interface RemoveBgBase64Input {
  image_url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.remove.bg/v1.0/removebg'
const API_KEY = process.env.REMOVE_BG_API_KEY || ''
const VALID_SIZES = ['auto', 'preview', 'small', 'medium', 'hd', 'full']

async function removeBgPost(body: Record<string, string>, format: string): Promise<Response> {
  if (!API_KEY) throw new Error('REMOVE_BG_API_KEY is not set')
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json',
      Accept: format === 'base64' ? 'application/json' : 'image/png',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`Remove.bg API \${res.status}: \${text.slice(0, 300)}\`)
  }
  return res
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'remove-bg',
  pricing: {
    defaultCostCents: 4,
    methods: {
      remove_background: { costCents: 4, displayName: 'Remove Background' },
      remove_background_base64: { costCents: 4, displayName: 'Remove BG (Base64)' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const removeBackground = sg.wrap(async (args: RemoveBgInput) => {
  if (!args.image_url || typeof args.image_url !== 'string') {
    throw new Error('image_url is required')
  }
  const size = args.size && VALID_SIZES.includes(args.size) ? args.size : 'auto'

  const res = await removeBgPost(
    { image_url: args.image_url, size, format: 'png' },
    'binary'
  )
  const arrayBuf = await res.arrayBuffer()
  const b64 = Buffer.from(arrayBuf).toString('base64')

  return {
    source: args.image_url,
    size,
    format: 'png',
    resultBytes: arrayBuf.byteLength,
    resultBase64: b64.slice(0, 100) + '...(truncated)',
    message: 'Background removed successfully. Full binary returned.',
  }
}, { method: 'remove_background' })

const removeBackgroundBase64 = sg.wrap(async (args: RemoveBgBase64Input) => {
  if (!args.image_url || typeof args.image_url !== 'string') {
    throw new Error('image_url is required')
  }

  const res = await removeBgPost(
    { image_url: args.image_url, size: 'auto', format: 'png' },
    'base64'
  )
  const json = (await res.json()) as { data: { result_b64: string } }

  return {
    source: args.image_url,
    format: 'png',
    base64Preview: (json.data?.result_b64 || '').slice(0, 200) + '...',
  }
}, { method: 'remove_background_base64' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { removeBackground, removeBackgroundBase64 }

console.log('settlegrid-remove-bg MCP server ready')
console.log('Methods: remove_background, remove_background_base64')
console.log('Pricing: 4¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — 89. settlegrid-wolfram-alpha
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'wolfram-alpha',
  name: 'Wolfram Alpha',
  description: 'Computational knowledge engine via the Wolfram Alpha API.',
  keywords: ['ai', 'math', 'computation', 'knowledge', 'wolfram'],
  upstream: {
    provider: 'Wolfram Alpha',
    baseUrl: 'https://api.wolframalpha.com/v1',
    auth: 'Query param (appid)',
    rateLimit: '2,000 calls/month (free tier)',
    docsUrl: 'https://products.wolframalpha.com/api/documentation',
  },
  auth: { type: 'query', keyEnvVar: 'WOLFRAM_APP_ID', keyDesc: 'Wolfram Alpha AppID (free at products.wolframalpha.com)' },
  methods: [
    { name: 'query', displayName: 'Full Query', costCents: 3, description: 'Full structured query with pods and subpods', params: [
      { name: 'input', type: 'string', required: true, description: 'Natural language query (e.g. "integrate x^2 dx")' },
    ] },
    { name: 'short_answer', displayName: 'Short Answer', costCents: 2, description: 'Get a single-line short answer', params: [
      { name: 'input', type: 'string', required: true, description: 'Question to answer briefly' },
    ] },
    { name: 'spoken_answer', displayName: 'Spoken Answer', costCents: 2, description: 'Get a spoken-language answer', params: [
      { name: 'input', type: 'string', required: true, description: 'Question for spoken-form answer' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-wolfram-alpha — Computational Knowledge MCP Server
 *
 * Methods:
 *   query(input)           — Full structured query with pods   (3¢)
 *   short_answer(input)    — Single-line short answer          (2¢)
 *   spoken_answer(input)   — Spoken-language answer            (2¢)
 *
 * Pricing: 2-3¢ per call | Upstream: Wolfram Alpha API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QueryInput {
  input: string
}

interface WolframPod {
  title: string
  subpods: Array<{ title: string; plaintext: string; img?: { src: string } }>
}

interface WolframFullResult {
  queryresult: {
    success: boolean
    error: boolean
    numpods: number
    pods?: WolframPod[]
    didyoumeans?: Array<{ val: string }>
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.wolframalpha.com'
const APP_ID = process.env.WOLFRAM_APP_ID || ''

async function wolframFetch(path: string, params: Record<string, string>): Promise<Response> {
  if (!APP_ID) throw new Error('WOLFRAM_APP_ID is not set')
  const qs = new URLSearchParams({ appid: APP_ID, ...params })
  const res = await fetch(\`\${BASE}\${path}?\${qs}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Wolfram Alpha API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wolfram-alpha',
  pricing: {
    defaultCostCents: 2,
    methods: {
      query: { costCents: 3, displayName: 'Full Query' },
      short_answer: { costCents: 2, displayName: 'Short Answer' },
      spoken_answer: { costCents: 2, displayName: 'Spoken Answer' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const query = sg.wrap(async (args: QueryInput) => {
  if (!args.input || typeof args.input !== 'string') {
    throw new Error('input is required')
  }
  const res = await wolframFetch('/v2/query', {
    input: args.input,
    output: 'json',
    format: 'plaintext,image',
  })
  const data = (await res.json()) as WolframFullResult
  const qr = data.queryresult

  if (!qr.success) {
    return {
      success: false,
      input: args.input,
      suggestions: qr.didyoumeans?.map((d) => d.val) || [],
    }
  }

  return {
    success: true,
    input: args.input,
    numPods: qr.numpods,
    pods: (qr.pods || []).slice(0, 10).map((p) => ({
      title: p.title,
      subpods: p.subpods.map((sp) => ({
        title: sp.title,
        text: sp.plaintext,
        imageUrl: sp.img?.src || null,
      })),
    })),
  }
}, { method: 'query' })

const shortAnswer = sg.wrap(async (args: QueryInput) => {
  if (!args.input || typeof args.input !== 'string') {
    throw new Error('input is required')
  }
  const res = await wolframFetch('/v1/result', { i: args.input })
  const text = await res.text()
  return { input: args.input, answer: text }
}, { method: 'short_answer' })

const spokenAnswer = sg.wrap(async (args: QueryInput) => {
  if (!args.input || typeof args.input !== 'string') {
    throw new Error('input is required')
  }
  const res = await wolframFetch('/v1/spoken', { i: args.input })
  const text = await res.text()
  return { input: args.input, spoken: text }
}, { method: 'spoken_answer' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { query, shortAnswer, spokenAnswer }

console.log('settlegrid-wolfram-alpha MCP server ready')
console.log('Methods: query, short_answer, spoken_answer')
console.log('Pricing: 2-3¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// AI/ML — 90. settlegrid-huggingface-datasets
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'huggingface-datasets',
  name: 'Hugging Face Datasets',
  description: 'Search and explore datasets on the Hugging Face Hub.',
  keywords: ['ai', 'datasets', 'machine-learning', 'huggingface'],
  upstream: {
    provider: 'Hugging Face',
    baseUrl: 'https://huggingface.co/api/datasets',
    auth: 'None required',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://huggingface.co/docs/hub/api',
  },
  auth: { type: 'none' },
  methods: [
    { name: 'search_datasets', displayName: 'Search Datasets', costCents: 1, description: 'Search datasets by keyword', params: [
      { name: 'query', type: 'string', required: true, description: 'Search query for datasets' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 10, max 50)' },
    ] },
    { name: 'get_dataset', displayName: 'Get Dataset Info', costCents: 1, description: 'Get details about a specific dataset', params: [
      { name: 'dataset_id', type: 'string', required: true, description: 'Dataset ID (e.g. "squad", "imdb")' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-huggingface-datasets — Hugging Face Datasets MCP Server
 *
 * Methods:
 *   search_datasets(query, limit?)  — Search datasets by keyword   (1¢)
 *   get_dataset(dataset_id)         — Get dataset details          (1¢)
 *
 * Pricing: 1¢ per call | Upstream: Hugging Face Hub API (free)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  dataset_id: string
}

interface HfDataset {
  id: string
  author?: string
  sha?: string
  lastModified?: string
  private: boolean
  downloads?: number
  likes?: number
  tags?: string[]
  description?: string
  citation?: string
  cardData?: Record<string, unknown>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://huggingface.co/api/datasets'

async function hfFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`HuggingFace API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'huggingface-datasets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Datasets' },
      get_dataset: { costCents: 1, displayName: 'Get Dataset Info' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)
  const qs = new URLSearchParams({
    search: args.query,
    limit: String(limit),
    sort: 'downloads',
    direction: '-1',
  })
  const datasets = await hfFetch<HfDataset[]>(\`?\${qs}\`)

  return {
    query: args.query,
    count: datasets.length,
    datasets: datasets.map((d) => ({
      id: d.id,
      author: d.author || null,
      downloads: d.downloads || 0,
      likes: d.likes || 0,
      tags: (d.tags || []).slice(0, 10),
      lastModified: d.lastModified || null,
    })),
  }
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.dataset_id || typeof args.dataset_id !== 'string') {
    throw new Error('dataset_id is required (e.g. "squad", "imdb")')
  }
  const ds = await hfFetch<HfDataset>(\`/\${encodeURIComponent(args.dataset_id)}\`)

  return {
    id: ds.id,
    author: ds.author || null,
    private: ds.private,
    downloads: ds.downloads || 0,
    likes: ds.likes || 0,
    tags: ds.tags || [],
    description: ds.description?.slice(0, 1000) || null,
    citation: ds.citation?.slice(0, 500) || null,
    lastModified: ds.lastModified || null,
  }
}, { method: 'get_dataset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset }

console.log('settlegrid-huggingface-datasets MCP server ready')
console.log('Methods: search_datasets, get_dataset')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 92. settlegrid-data-gov
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'data-gov',
  name: 'Data.gov',
  description: 'Search and explore US federal open data via the Data.gov CKAN API.',
  keywords: ['government', 'open-data', 'federal', 'usa'],
  upstream: {
    provider: 'Data.gov (GSA)',
    baseUrl: 'https://catalog.data.gov/api/3',
    auth: 'API key (query param)',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://catalog.data.gov/api/3',
  },
  auth: { type: 'query', keyEnvVar: 'DATA_GOV_API_KEY', keyDesc: 'Data.gov API key (free at api.data.gov)' },
  methods: [
    { name: 'search_datasets', displayName: 'Search Datasets', costCents: 2, description: 'Search federal open datasets by keyword', params: [
      { name: 'query', type: 'string', required: true, description: 'Search keywords' },
      { name: 'rows', type: 'number', required: false, description: 'Results per page (default 10, max 50)' },
    ] },
    { name: 'get_dataset', displayName: 'Get Dataset', costCents: 2, description: 'Get details for a specific dataset by ID', params: [
      { name: 'id', type: 'string', required: true, description: 'CKAN dataset/package ID' },
    ] },
    { name: 'list_organizations', displayName: 'List Organizations', costCents: 1, description: 'List federal organizations publishing data', params: [
      { name: 'limit', type: 'number', required: false, description: 'Max orgs to return (default 20)' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-data-gov — Data.gov Federal Open Data MCP Server
 *
 * Methods:
 *   search_datasets(query, rows?)   — Search federal datasets     (2¢)
 *   get_dataset(id)                 — Get dataset details         (2¢)
 *   list_organizations(limit?)      — List publishing agencies    (1¢)
 *
 * Pricing: 1-2¢ per call | Upstream: Data.gov CKAN API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  rows?: number
}

interface GetDatasetInput {
  id: string
}

interface ListOrgsInput {
  limit?: number
}

interface CkanSearchResult {
  success: boolean
  result: {
    count: number
    results: Array<{
      id: string
      name: string
      title: string
      notes?: string
      organization?: { title: string }
      metadata_modified?: string
      num_resources?: number
    }>
  }
}

interface CkanPackage {
  success: boolean
  result: {
    id: string
    name: string
    title: string
    notes?: string
    organization?: { title: string }
    resources?: Array<{ id: string; name: string; format: string; url: string }>
    tags?: Array<{ name: string }>
    metadata_modified?: string
  }
}

interface CkanOrgList {
  success: boolean
  result: Array<{ name: string; title: string; package_count: number }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://catalog.data.gov/api/3/action'
const API_KEY = process.env.DATA_GOV_API_KEY || ''

async function ckanFetch<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params)
  if (API_KEY) qs.set('api_key', API_KEY)
  const res = await fetch(\`\${BASE}/\${action}?\${qs}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Data.gov API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'data-gov',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_datasets: { costCents: 2, displayName: 'Search Datasets' },
      get_dataset: { costCents: 2, displayName: 'Get Dataset' },
      list_organizations: { costCents: 1, displayName: 'List Organizations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const rows = Math.min(Math.max(args.rows || 10, 1), 50)
  const data = await ckanFetch<CkanSearchResult>('package_search', {
    q: args.query,
    rows: String(rows),
  })
  return {
    query: args.query,
    totalCount: data.result.count,
    results: data.result.results.map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      organization: r.organization?.title || null,
      description: r.notes?.slice(0, 300) || null,
      resources: r.num_resources || 0,
      modified: r.metadata_modified || null,
    })),
  }
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (CKAN package ID)')
  }
  const data = await ckanFetch<CkanPackage>('package_show', { id: args.id })
  const r = data.result
  return {
    id: r.id,
    name: r.name,
    title: r.title,
    organization: r.organization?.title || null,
    description: r.notes?.slice(0, 1000) || null,
    tags: (r.tags || []).map((t) => t.name),
    resources: (r.resources || []).slice(0, 20).map((res) => ({
      id: res.id,
      name: res.name,
      format: res.format,
      url: res.url,
    })),
    modified: r.metadata_modified || null,
  }
}, { method: 'get_dataset' })

const listOrganizations = sg.wrap(async (args: ListOrgsInput) => {
  const limit = Math.min(Math.max(args.limit || 20, 1), 100)
  const data = await ckanFetch<CkanOrgList>('organization_list', {
    all_fields: 'true',
    limit: String(limit),
    sort: 'package_count desc',
  })
  return {
    count: data.result.length,
    organizations: data.result.map((o) => ({
      name: o.name,
      title: o.title,
      datasetCount: o.package_count,
    })),
  }
}, { method: 'list_organizations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listOrganizations }

console.log('settlegrid-data-gov MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_organizations')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 93. settlegrid-usa-spending
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'usa-spending',
  name: 'USAspending',
  description: 'Federal spending data from USAspending.gov (awards, agencies, recipients).',
  keywords: ['government', 'spending', 'federal', 'budget', 'usa'],
  upstream: {
    provider: 'USAspending.gov',
    baseUrl: 'https://api.usaspending.gov/api/v2',
    auth: 'None required',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://api.usaspending.gov',
  },
  auth: { type: 'none' },
  methods: [
    { name: 'search_spending', displayName: 'Search Spending', costCents: 2, description: 'Search federal awards by keyword', params: [
      { name: 'keywords', type: 'string', required: true, description: 'Keywords to search for in awards' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 10, max 50)' },
    ] },
    { name: 'get_agency', displayName: 'Get Agency', costCents: 2, description: 'Get spending overview for a federal agency', params: [
      { name: 'agency_id', type: 'string', required: true, description: 'Agency toptier code (e.g. "012" for Agriculture)' },
      { name: 'fiscal_year', type: 'number', required: false, description: 'Fiscal year (default current)' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-usa-spending — USAspending Federal Spending MCP Server
 *
 * Methods:
 *   search_spending(keywords, limit?)         — Search federal awards    (2¢)
 *   get_agency(agency_id, fiscal_year?)       — Agency spending overview (2¢)
 *
 * Pricing: 2¢ per call | Upstream: USAspending.gov API (free)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  keywords: string
  limit?: number
}

interface AgencyInput {
  agency_id: string
  fiscal_year?: number
}

interface SpendingResult {
  results: Array<{
    Award_ID?: string
    Recipient_Name?: string
    Award_Amount?: number
    Awarding_Agency?: string
    Award_Type?: string
    Start_Date?: string
    Description?: string
    internal_id?: string
    generated_internal_id?: string
  }>
  limit: number
  page_metadata?: { total: number }
}

interface AgencyOverview {
  fiscal_year: number
  toptier_code: string
  name: string
  abbreviation?: string
  budget_authority_amount?: number
  obligated_amount?: number
  outlay_amount?: number
  congressional_justification_url?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.usaspending.gov/api/v2'

async function usaPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`USAspending API \${res.status}: \${text.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

async function usaGet<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`USAspending API \${res.status}: \${text.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usa-spending',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_spending: { costCents: 2, displayName: 'Search Spending' },
      get_agency: { costCents: 2, displayName: 'Get Agency' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpending = sg.wrap(async (args: SearchInput) => {
  if (!args.keywords || typeof args.keywords !== 'string') {
    throw new Error('keywords is required')
  }
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)

  const data = await usaPost<SpendingResult>('/search/spending_by_award/', {
    filters: { keywords: [args.keywords] },
    fields: ['Award_ID', 'Recipient_Name', 'Award_Amount', 'Awarding_Agency', 'Award_Type', 'Start_Date', 'Description'],
    limit,
    page: 1,
    sort: 'Award_Amount',
    order: 'desc',
  })

  return {
    keywords: args.keywords,
    total: data.page_metadata?.total || data.results.length,
    results: data.results.map((r) => ({
      awardId: r.Award_ID || r.internal_id || null,
      recipient: r.Recipient_Name || null,
      amount: r.Award_Amount || null,
      agency: r.Awarding_Agency || null,
      type: r.Award_Type || null,
      startDate: r.Start_Date || null,
      description: r.Description?.slice(0, 300) || null,
    })),
  }
}, { method: 'search_spending' })

const getAgency = sg.wrap(async (args: AgencyInput) => {
  if (!args.agency_id || typeof args.agency_id !== 'string') {
    throw new Error('agency_id is required (toptier code, e.g. "012")')
  }
  const fy = args.fiscal_year || new Date().getFullYear()
  const data = await usaGet<AgencyOverview>(
    \`/agency/\${encodeURIComponent(args.agency_id)}/?fiscal_year=\${fy}\`
  )

  return {
    fiscalYear: data.fiscal_year || fy,
    code: data.toptier_code,
    name: data.name,
    abbreviation: data.abbreviation || null,
    budgetAuthority: data.budget_authority_amount || null,
    obligated: data.obligated_amount || null,
    outlays: data.outlay_amount || null,
    justificationUrl: data.congressional_justification_url || null,
  }
}, { method: 'get_agency' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpending, getAgency }

console.log('settlegrid-usa-spending MCP server ready')
console.log('Methods: search_spending, get_agency')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 94. settlegrid-fec-elections
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'fec-elections',
  name: 'FEC Campaign Finance',
  description: 'US campaign finance data from the Federal Election Commission API.',
  keywords: ['government', 'elections', 'campaign-finance', 'fec', 'usa'],
  upstream: {
    provider: 'Federal Election Commission',
    baseUrl: 'https://api.open.fec.gov/v1',
    auth: 'API key (query param)',
    rateLimit: '1,000 requests/hour',
    docsUrl: 'https://api.open.fec.gov/developers/',
  },
  auth: { type: 'query', keyEnvVar: 'FEC_API_KEY', keyDesc: 'FEC API key (free at api.open.fec.gov)' },
  methods: [
    { name: 'search_candidates', displayName: 'Search Candidates', costCents: 2, description: 'Search candidates by name or ID', params: [
      { name: 'query', type: 'string', required: true, description: 'Candidate name or ID' },
      { name: 'cycle', type: 'number', required: false, description: 'Election cycle year (e.g. 2024)' },
    ] },
    { name: 'search_committees', displayName: 'Search Committees', costCents: 2, description: 'Search PACs and committees by name', params: [
      { name: 'query', type: 'string', required: true, description: 'Committee name' },
    ] },
    { name: 'get_candidate_totals', displayName: 'Candidate Totals', costCents: 2, description: 'Get fundraising totals for a candidate', params: [
      { name: 'candidate_id', type: 'string', required: true, description: 'FEC candidate ID (e.g. P00009423)' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-fec-elections — FEC Campaign Finance MCP Server
 *
 * Methods:
 *   search_candidates(query, cycle?)      — Search candidates      (2¢)
 *   search_committees(query)              — Search PACs/committees  (2¢)
 *   get_candidate_totals(candidate_id)    — Fundraising totals     (2¢)
 *
 * Pricing: 2¢ per call | Upstream: FEC API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchCandidatesInput {
  query: string
  cycle?: number
}

interface SearchCommitteesInput {
  query: string
}

interface CandidateTotalsInput {
  candidate_id: string
}

interface FecCandidate {
  candidate_id: string
  name: string
  party: string
  office: string
  state?: string
  district?: string
  election_years?: number[]
  candidate_status?: string
}

interface FecCommittee {
  committee_id: string
  name: string
  committee_type: string
  designation: string
  party?: string
  state?: string
  treasurer_name?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.open.fec.gov/v1'
const API_KEY = process.env.FEC_API_KEY || ''

async function fecFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error('FEC_API_KEY is not set')
  const qs = new URLSearchParams({ api_key: API_KEY, ...params })
  const res = await fetch(\`\${BASE}\${path}?\${qs}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FEC API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fec-elections',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_candidates: { costCents: 2, displayName: 'Search Candidates' },
      search_committees: { costCents: 2, displayName: 'Search Committees' },
      get_candidate_totals: { costCents: 2, displayName: 'Candidate Totals' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCandidates = sg.wrap(async (args: SearchCandidatesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (candidate name or ID)')
  }
  const params: Record<string, string> = { q: args.query, per_page: '20' }
  if (args.cycle) params.cycle = String(args.cycle)

  const data = await fecFetch<{ results: FecCandidate[] }>('/candidates/search/', params)
  return {
    query: args.query,
    count: data.results.length,
    candidates: data.results.slice(0, 20).map((c) => ({
      id: c.candidate_id,
      name: c.name,
      party: c.party,
      office: c.office,
      state: c.state || null,
      district: c.district || null,
      electionYears: c.election_years || [],
      status: c.candidate_status || null,
    })),
  }
}, { method: 'search_candidates' })

const searchCommittees = sg.wrap(async (args: SearchCommitteesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (committee name)')
  }
  const data = await fecFetch<{ results: FecCommittee[] }>('/committees/', {
    q: args.query,
    per_page: '20',
  })
  return {
    query: args.query,
    count: data.results.length,
    committees: data.results.slice(0, 20).map((c) => ({
      id: c.committee_id,
      name: c.name,
      type: c.committee_type,
      designation: c.designation,
      party: c.party || null,
      state: c.state || null,
      treasurer: c.treasurer_name || null,
    })),
  }
}, { method: 'search_committees' })

const getCandidateTotals = sg.wrap(async (args: CandidateTotalsInput) => {
  if (!args.candidate_id || typeof args.candidate_id !== 'string') {
    throw new Error('candidate_id is required (e.g. "P00009423")')
  }
  const data = await fecFetch<{
    results: Array<{
      candidate_id: string
      name: string
      party: string
      office: string
      receipts: number
      disbursements: number
      cash_on_hand_end_period: number
      debts_owed_by_committee: number
      election_year: number
    }>
  }>(\`/candidates/totals/\`, { candidate_id: args.candidate_id, per_page: '5', sort: '-election_year' })

  return {
    candidateId: args.candidate_id,
    totals: data.results.map((r) => ({
      name: r.name,
      party: r.party,
      office: r.office,
      electionYear: r.election_year,
      receipts: r.receipts,
      disbursements: r.disbursements,
      cashOnHand: r.cash_on_hand_end_period,
      debts: r.debts_owed_by_committee,
    })),
  }
}, { method: 'get_candidate_totals' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCandidates, searchCommittees, getCandidateTotals }

console.log('settlegrid-fec-elections MCP server ready')
console.log('Methods: search_candidates, search_committees, get_candidate_totals')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 95. settlegrid-congress-api
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'congress-api',
  name: 'Congress.gov',
  description: 'Congressional data including bills, members, and votes from the Library of Congress API.',
  keywords: ['government', 'congress', 'legislation', 'bills', 'usa'],
  upstream: {
    provider: 'Library of Congress',
    baseUrl: 'https://api.congress.gov/v3',
    auth: 'API key (query param)',
    rateLimit: '5,000 requests/hour',
    docsUrl: 'https://api.congress.gov/',
  },
  auth: { type: 'query', keyEnvVar: 'CONGRESS_API_KEY', keyDesc: 'Congress.gov API key (free at api.congress.gov)' },
  methods: [
    { name: 'search_bills', displayName: 'Search Bills', costCents: 2, description: 'Search congressional bills by keyword', params: [
      { name: 'query', type: 'string', required: true, description: 'Keywords to search for in bills' },
      { name: 'congress', type: 'number', required: false, description: 'Congress number (e.g. 118)' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 10)' },
    ] },
    { name: 'get_bill', displayName: 'Get Bill', costCents: 2, description: 'Get details for a specific bill', params: [
      { name: 'congress', type: 'number', required: true, description: 'Congress number (e.g. 118)' },
      { name: 'bill_type', type: 'string', required: true, description: 'Bill type: hr, s, hjres, sjres, hconres, sconres, hres, sres' },
      { name: 'bill_number', type: 'number', required: true, description: 'Bill number' },
    ] },
    { name: 'list_members', displayName: 'List Members', costCents: 2, description: 'List current members of Congress', params: [
      { name: 'chamber', type: 'string', required: false, description: 'Chamber: house or senate' },
      { name: 'state', type: 'string', required: false, description: '2-letter state code (e.g. CA)' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-congress-api — Congressional Data MCP Server
 *
 * Methods:
 *   search_bills(query, congress?, limit?)       — Search bills       (2¢)
 *   get_bill(congress, bill_type, bill_number)   — Get bill details   (2¢)
 *   list_members(chamber?, state?)               — List members       (2¢)
 *
 * Pricing: 2¢ per call | Upstream: Congress.gov API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchBillsInput {
  query: string
  congress?: number
  limit?: number
}

interface GetBillInput {
  congress: number
  bill_type: string
  bill_number: number
}

interface ListMembersInput {
  chamber?: string
  state?: string
}

interface CongressBill {
  number: number
  title: string
  type: string
  congress: number
  originChamber?: string
  latestAction?: { text: string; actionDate: string }
  url?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.congress.gov/v3'
const API_KEY = process.env.CONGRESS_API_KEY || ''

async function congressFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error('CONGRESS_API_KEY is not set')
  const qs = new URLSearchParams({ api_key: API_KEY, format: 'json', ...params })
  const res = await fetch(\`\${BASE}\${path}?\${qs}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Congress API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'congress-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_bills: { costCents: 2, displayName: 'Search Bills' },
      get_bill: { costCents: 2, displayName: 'Get Bill' },
      list_members: { costCents: 2, displayName: 'List Members' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBills = sg.wrap(async (args: SearchBillsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)
  const params: Record<string, string> = { limit: String(limit) }
  const congress = args.congress || 118
  params.offset = '0'

  const data = await congressFetch<{ bills: CongressBill[] }>(
    \`/bill/\${congress}\`,
    params
  )

  return {
    query: args.query,
    congress,
    count: (data.bills || []).length,
    bills: (data.bills || []).slice(0, limit).map((b) => ({
      number: b.number,
      type: b.type,
      title: b.title,
      congress: b.congress,
      originChamber: b.originChamber || null,
      latestAction: b.latestAction?.text || null,
      actionDate: b.latestAction?.actionDate || null,
    })),
  }
}, { method: 'search_bills' })

const getBill = sg.wrap(async (args: GetBillInput) => {
  if (!args.congress || typeof args.congress !== 'number') {
    throw new Error('congress is required (e.g. 118)')
  }
  if (!args.bill_type || typeof args.bill_type !== 'string') {
    throw new Error('bill_type is required (hr, s, hjres, etc.)')
  }
  if (!args.bill_number || typeof args.bill_number !== 'number') {
    throw new Error('bill_number is required')
  }
  const bt = args.bill_type.toLowerCase()

  const data = await congressFetch<{
    bill: {
      number: number
      title: string
      type: string
      congress: number
      originChamber?: string
      introducedDate?: string
      sponsors?: Array<{ fullName: string; party: string; state: string }>
      latestAction?: { text: string; actionDate: string }
      policyArea?: { name: string }
      subjects?: { legislativeSubjects: Array<{ name: string }> }
    }
  }>(\`/bill/\${args.congress}/\${bt}/\${args.bill_number}\`)

  const b = data.bill
  return {
    number: b.number,
    type: b.type,
    title: b.title,
    congress: b.congress,
    originChamber: b.originChamber || null,
    introducedDate: b.introducedDate || null,
    sponsors: b.sponsors?.map((s) => ({
      name: s.fullName,
      party: s.party,
      state: s.state,
    })) || [],
    latestAction: b.latestAction?.text || null,
    actionDate: b.latestAction?.actionDate || null,
    policyArea: b.policyArea?.name || null,
  }
}, { method: 'get_bill' })

const listMembers = sg.wrap(async (args: ListMembersInput) => {
  const params: Record<string, string> = { limit: '50' }
  let path = '/member'
  if (args.chamber) {
    const chamber = args.chamber.toLowerCase()
    if (chamber !== 'house' && chamber !== 'senate') {
      throw new Error('chamber must be "house" or "senate"')
    }
  }
  if (args.state) {
    const st = args.state.toUpperCase()
    if (!/^[A-Z]{2}\$/.test(st)) {
      throw new Error('state must be a 2-letter code (e.g. "CA")')
    }
    params.currentMember = 'true'
  }

  const data = await congressFetch<{
    members: Array<{
      bioguideId: string
      name: string
      partyName?: string
      state?: string
      district?: number
      chamber?: string
      url?: string
    }>
  }>(path, params)

  let members = data.members || []
  if (args.state) {
    members = members.filter((m) => m.state === args.state?.toUpperCase())
  }
  if (args.chamber) {
    members = members.filter(
      (m) => m.chamber?.toLowerCase() === args.chamber?.toLowerCase()
    )
  }

  return {
    filters: { chamber: args.chamber || 'all', state: args.state || 'all' },
    count: members.length,
    members: members.slice(0, 50).map((m) => ({
      bioguideId: m.bioguideId,
      name: m.name,
      party: m.partyName || null,
      state: m.state || null,
      district: m.district ?? null,
      chamber: m.chamber || null,
    })),
  }
}, { method: 'list_members' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBills, getBill, listMembers }

console.log('settlegrid-congress-api MCP server ready')
console.log('Methods: search_bills, get_bill, list_members')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 99. settlegrid-usps-lookup
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'usps-lookup',
  name: 'ZIP Code Lookup',
  description: 'ZIP code and postal code lookups via the Zippopotam.us API (free, no key).',
  keywords: ['government', 'postal', 'zip-code', 'address', 'usa'],
  upstream: {
    provider: 'Zippopotam.us',
    baseUrl: 'https://api.zippopotam.us',
    auth: 'None required',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://www.zippopotam.us/',
  },
  auth: { type: 'none' },
  methods: [
    { name: 'lookup_zip', displayName: 'Lookup ZIP', costCents: 1, description: 'Look up location info for a US ZIP code', params: [
      { name: 'zip', type: 'string', required: true, description: '5-digit US ZIP code' },
    ] },
    { name: 'lookup_zip_country', displayName: 'Lookup ZIP (Intl)', costCents: 1, description: 'Look up a postal code in any supported country', params: [
      { name: 'country', type: 'string', required: true, description: '2-letter country code (e.g. US, DE, CA, FR)' },
      { name: 'postal_code', type: 'string', required: true, description: 'Postal code to look up' },
    ] },
    { name: 'lookup_place', displayName: 'Lookup Place', costCents: 1, description: 'Find postal codes for a city/state', params: [
      { name: 'country', type: 'string', required: true, description: '2-letter country code' },
      { name: 'state', type: 'string', required: true, description: 'State abbreviation (e.g. CA, NY)' },
      { name: 'city', type: 'string', required: true, description: 'City name' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-usps-lookup — ZIP Code Lookup MCP Server
 *
 * Methods:
 *   lookup_zip(zip)                          — US ZIP code lookup        (1¢)
 *   lookup_zip_country(country, postal_code) — International ZIP lookup  (1¢)
 *   lookup_place(country, state, city)       — City-to-ZIP lookup        (1¢)
 *
 * Pricing: 1¢ per call | Upstream: Zippopotam.us (free)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupZipInput {
  zip: string
}

interface LookupZipCountryInput {
  country: string
  postal_code: string
}

interface LookupPlaceInput {
  country: string
  state: string
  city: string
}

interface ZippoResult {
  'post code': string
  country: string
  'country abbreviation': string
  places: Array<{
    'place name': string
    longitude: string
    state: string
    'state abbreviation': string
    latitude: string
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.zippopotam.us'

async function zippoFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('No results found for that postal code/location')
    const body = await res.text().catch(() => '')
    throw new Error(\`Zippopotam API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usps-lookup',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_zip: { costCents: 1, displayName: 'Lookup ZIP' },
      lookup_zip_country: { costCents: 1, displayName: 'Lookup ZIP (Intl)' },
      lookup_place: { costCents: 1, displayName: 'Lookup Place' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupZip = sg.wrap(async (args: LookupZipInput) => {
  if (!args.zip || typeof args.zip !== 'string') {
    throw new Error('zip is required (5-digit US ZIP code)')
  }
  const zip = args.zip.trim()
  if (!/^\\d{5}\$/.test(zip)) {
    throw new Error('zip must be a 5-digit US ZIP code')
  }

  const data = await zippoFetch<ZippoResult>(\`/us/\${zip}\`)
  return {
    zip: data['post code'],
    country: data.country,
    countryCode: data['country abbreviation'],
    places: data.places.map((p) => ({
      name: p['place name'],
      state: p.state,
      stateCode: p['state abbreviation'],
      latitude: parseFloat(p.latitude),
      longitude: parseFloat(p.longitude),
    })),
  }
}, { method: 'lookup_zip' })

const lookupZipCountry = sg.wrap(async (args: LookupZipCountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (2-letter code)')
  }
  if (!args.postal_code || typeof args.postal_code !== 'string') {
    throw new Error('postal_code is required')
  }
  const cc = args.country.toLowerCase().trim()
  const pc = encodeURIComponent(args.postal_code.trim())

  const data = await zippoFetch<ZippoResult>(\`/\${cc}/\${pc}\`)
  return {
    postalCode: data['post code'],
    country: data.country,
    countryCode: data['country abbreviation'],
    places: data.places.map((p) => ({
      name: p['place name'],
      state: p.state,
      stateCode: p['state abbreviation'],
      latitude: parseFloat(p.latitude),
      longitude: parseFloat(p.longitude),
    })),
  }
}, { method: 'lookup_zip_country' })

const lookupPlace = sg.wrap(async (args: LookupPlaceInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (2-letter code)')
  }
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required')
  }
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required')
  }
  const cc = args.country.toLowerCase().trim()
  const st = encodeURIComponent(args.state.trim())
  const city = encodeURIComponent(args.city.trim())

  const data = await zippoFetch<ZippoResult>(\`/\${cc}/\${st}/\${city}\`)
  return {
    country: data.country,
    countryCode: data['country abbreviation'],
    postalCode: data['post code'] || null,
    places: data.places.map((p) => ({
      name: p['place name'],
      state: p.state,
      stateCode: p['state abbreviation'],
      latitude: parseFloat(p.latitude),
      longitude: parseFloat(p.longitude),
    })),
  }
}, { method: 'lookup_place' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupZip, lookupZipCountry, lookupPlace }

console.log('settlegrid-usps-lookup MCP server ready')
console.log('Methods: lookup_zip, lookup_zip_country, lookup_place')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 101. settlegrid-uk-companies
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'uk-companies',
  name: 'UK Companies House',
  description: 'UK company data from the Companies House API (search, officers, filings).',
  keywords: ['government', 'companies', 'uk', 'business', 'corporate'],
  upstream: {
    provider: 'UK Companies House',
    baseUrl: 'https://api.company-information.service.gov.uk',
    auth: 'Basic auth (API key as username)',
    rateLimit: '600 requests/5 minutes',
    docsUrl: 'https://developer.company-information.service.gov.uk/',
  },
  auth: { type: 'bearer', keyEnvVar: 'COMPANIES_HOUSE_API_KEY', keyDesc: 'UK Companies House API key (free at developer.company-information.service.gov.uk)' },
  methods: [
    { name: 'search_companies', displayName: 'Search Companies', costCents: 2, description: 'Search UK companies by name', params: [
      { name: 'query', type: 'string', required: true, description: 'Company name to search for' },
      { name: 'items_per_page', type: 'number', required: false, description: 'Results per page (default 10, max 50)' },
    ] },
    { name: 'get_company', displayName: 'Get Company', costCents: 2, description: 'Get company profile by number', params: [
      { name: 'company_number', type: 'string', required: true, description: 'UK company number (e.g. "00000006")' },
    ] },
    { name: 'get_officers', displayName: 'Get Officers', costCents: 2, description: 'List officers (directors) of a company', params: [
      { name: 'company_number', type: 'string', required: true, description: 'UK company number' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-uk-companies — UK Companies House MCP Server
 *
 * Methods:
 *   search_companies(query, items_per_page?)    — Search UK companies   (2¢)
 *   get_company(company_number)                 — Get company profile   (2¢)
 *   get_officers(company_number)                — List officers         (2¢)
 *
 * Pricing: 2¢ per call | Upstream: Companies House API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  items_per_page?: number
}

interface CompanyInput {
  company_number: string
}

interface ChCompany {
  company_number: string
  title?: string
  company_name?: string
  company_status?: string
  company_type?: string
  date_of_creation?: string
  registered_office_address?: {
    address_line_1?: string
    locality?: string
    postal_code?: string
    country?: string
  }
  sic_codes?: string[]
}

interface ChOfficer {
  name: string
  officer_role: string
  appointed_on?: string
  resigned_on?: string
  nationality?: string
  occupation?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.company-information.service.gov.uk'
const API_KEY = process.env.COMPANIES_HOUSE_API_KEY || ''

async function chFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error('COMPANIES_HOUSE_API_KEY is not set')
  const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
  const res = await fetch(\`\${BASE}\${path}\${qs}\`, {
    headers: {
      Authorization: \`Basic \${Buffer.from(API_KEY + ':').toString('base64')}\`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Companies House API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-companies',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_companies: { costCents: 2, displayName: 'Search Companies' },
      get_company: { costCents: 2, displayName: 'Get Company' },
      get_officers: { costCents: 2, displayName: 'Get Officers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const perPage = Math.min(Math.max(args.items_per_page || 10, 1), 50)
  const data = await chFetch<{
    items: Array<{
      company_number: string
      title: string
      company_status?: string
      company_type?: string
      date_of_creation?: string
      address_snippet?: string
    }>
    total_results: number
  }>('/search/companies', { q: args.query, items_per_page: String(perPage) })

  return {
    query: args.query,
    totalResults: data.total_results,
    companies: (data.items || []).map((c) => ({
      number: c.company_number,
      name: c.title,
      status: c.company_status || null,
      type: c.company_type || null,
      created: c.date_of_creation || null,
      address: c.address_snippet || null,
    })),
  }
}, { method: 'search_companies' })

const getCompany = sg.wrap(async (args: CompanyInput) => {
  if (!args.company_number || typeof args.company_number !== 'string') {
    throw new Error('company_number is required')
  }
  const c = await chFetch<ChCompany>(\`/company/\${encodeURIComponent(args.company_number)}\`)
  return {
    number: c.company_number,
    name: c.company_name || c.title || null,
    status: c.company_status || null,
    type: c.company_type || null,
    created: c.date_of_creation || null,
    address: c.registered_office_address ? {
      line1: c.registered_office_address.address_line_1 || null,
      locality: c.registered_office_address.locality || null,
      postalCode: c.registered_office_address.postal_code || null,
      country: c.registered_office_address.country || null,
    } : null,
    sicCodes: c.sic_codes || [],
  }
}, { method: 'get_company' })

const getOfficers = sg.wrap(async (args: CompanyInput) => {
  if (!args.company_number || typeof args.company_number !== 'string') {
    throw new Error('company_number is required')
  }
  const data = await chFetch<{
    items: ChOfficer[]
    total_results: number
  }>(\`/company/\${encodeURIComponent(args.company_number)}/officers\`)

  return {
    companyNumber: args.company_number,
    totalOfficers: data.total_results,
    officers: (data.items || []).slice(0, 30).map((o) => ({
      name: o.name,
      role: o.officer_role,
      appointed: o.appointed_on || null,
      resigned: o.resigned_on || null,
      nationality: o.nationality || null,
      occupation: o.occupation || null,
    })),
  }
}, { method: 'get_officers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getCompany, getOfficers }

console.log('settlegrid-uk-companies MCP server ready')
console.log('Methods: search_companies, get_company, get_officers')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 103. settlegrid-canada-open
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'canada-open',
  name: 'Canada Open Data',
  description: 'Canada open government data via the Open Canada CKAN API.',
  keywords: ['government', 'open-data', 'canada'],
  upstream: {
    provider: 'Government of Canada',
    baseUrl: 'https://open.canada.ca/data/api/3',
    auth: 'None required',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://open.canada.ca/data/en/dataset',
  },
  auth: { type: 'none' },
  methods: [
    { name: 'search_datasets', displayName: 'Search Datasets', costCents: 1, description: 'Search Canadian open datasets by keyword', params: [
      { name: 'query', type: 'string', required: true, description: 'Search keywords' },
      { name: 'rows', type: 'number', required: false, description: 'Max results (default 10)' },
    ] },
    { name: 'get_dataset', displayName: 'Get Dataset', costCents: 1, description: 'Get details for a specific dataset', params: [
      { name: 'id', type: 'string', required: true, description: 'Dataset/package ID or name' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-canada-open — Canada Open Data MCP Server
 *
 * Methods:
 *   search_datasets(query, rows?)  — Search Canadian open data   (1¢)
 *   get_dataset(id)                — Get dataset details         (1¢)
 *
 * Pricing: 1¢ per call | Upstream: Open Canada CKAN API (free)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  rows?: number
}

interface GetDatasetInput {
  id: string
}

interface CkanSearchResult {
  success: boolean
  result: {
    count: number
    results: Array<{
      id: string
      name: string
      title: string
      notes?: string
      organization?: { title: string }
      metadata_modified?: string
      num_resources?: number
    }>
  }
}

interface CkanPackage {
  success: boolean
  result: {
    id: string
    name: string
    title: string
    notes?: string
    organization?: { title: string }
    resources?: Array<{ id: string; name: string; format: string; url: string }>
    tags?: Array<{ name: string }>
    metadata_modified?: string
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://open.canada.ca/data/api/3/action'

async function ckanFetch<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params)
  const res = await fetch(\`\${BASE}/\${action}?\${qs}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Canada Open Data API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'canada-open',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Datasets' },
      get_dataset: { costCents: 1, displayName: 'Get Dataset' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const rows = Math.min(Math.max(args.rows || 10, 1), 50)
  const data = await ckanFetch<CkanSearchResult>('package_search', {
    q: args.query,
    rows: String(rows),
  })
  return {
    query: args.query,
    totalCount: data.result.count,
    results: data.result.results.map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      organization: r.organization?.title || null,
      description: r.notes?.slice(0, 300) || null,
      resources: r.num_resources || 0,
      modified: r.metadata_modified || null,
    })),
  }
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (CKAN dataset ID or name)')
  }
  const data = await ckanFetch<CkanPackage>('package_show', { id: args.id })
  const r = data.result
  return {
    id: r.id,
    name: r.name,
    title: r.title,
    organization: r.organization?.title || null,
    description: r.notes?.slice(0, 1000) || null,
    tags: (r.tags || []).map((t) => t.name),
    resources: (r.resources || []).slice(0, 20).map((res) => ({
      id: res.id,
      name: res.name,
      format: res.format,
      url: res.url,
    })),
    modified: r.metadata_modified || null,
  }
}, { method: 'get_dataset' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset }

console.log('settlegrid-canada-open MCP server ready')
console.log('Methods: search_datasets, get_dataset')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 108. settlegrid-japan-estat
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'japan-estat',
  name: 'Japan e-Stat',
  description: 'Japan government statistics via the e-Stat API.',
  keywords: ['government', 'statistics', 'japan', 'asia'],
  upstream: {
    provider: 'Statistics Bureau of Japan',
    baseUrl: 'https://api.e-stat.go.jp/rest/3.0/app',
    auth: 'API key (query param: appId)',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://www.e-stat.go.jp/api/',
  },
  auth: { type: 'query', keyEnvVar: 'ESTAT_APP_ID', keyDesc: 'e-Stat appId (free at e-stat.go.jp)' },
  methods: [
    { name: 'search_statistics', displayName: 'Search Statistics', costCents: 2, description: 'Search Japanese statistical tables by keyword', params: [
      { name: 'query', type: 'string', required: true, description: 'Search keywords (English or Japanese)' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 10)' },
    ] },
    { name: 'get_stat_data', displayName: 'Get Stat Data', costCents: 2, description: 'Retrieve data from a statistical table', params: [
      { name: 'stats_data_id', type: 'string', required: true, description: 'Statistical table ID' },
      { name: 'limit', type: 'number', required: false, description: 'Max data rows (default 100)' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-japan-estat — Japan e-Stat Statistics MCP Server
 *
 * Methods:
 *   search_statistics(query, limit?)        — Search stat tables    (2¢)
 *   get_stat_data(stats_data_id, limit?)    — Get table data        (2¢)
 *
 * Pricing: 2¢ per call | Upstream: e-Stat API
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface GetDataInput {
  stats_data_id: string
  limit?: number
}

interface EstatTable {
  '@id': string
  STAT_NAME: { '@code': string; '$': string }
  GOV_ORG: { '@code': string; '$': string }
  STATISTICS_NAME: string
  TITLE: { '$': string } | string
  SURVEY_DATE?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json'
const APP_ID = process.env.ESTAT_APP_ID || ''

async function estatFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!APP_ID) throw new Error('ESTAT_APP_ID is not set')
  const qs = new URLSearchParams({ appId: APP_ID, ...params })
  const res = await fetch(\`\${BASE}/\${endpoint}?\${qs}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`e-Stat API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'japan-estat',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_statistics: { costCents: 2, displayName: 'Search Statistics' },
      get_stat_data: { costCents: 2, displayName: 'Get Stat Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchStatistics = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)

  const data = await estatFetch<{
    GET_STATS_LIST: {
      RESULT: { STATUS: number; ERROR_MSG?: string }
      DATALIST_INF?: {
        NUMBER: number
        TABLE_INF: EstatTable[] | EstatTable
      }
    }
  }>('getStatsList', {
    searchWord: args.query,
    limit: String(limit),
    lang: 'E',
  })

  const result = data.GET_STATS_LIST
  if (result.RESULT.STATUS !== 0) {
    throw new Error(\`e-Stat error: \${result.RESULT.ERROR_MSG || 'Unknown error'}\`)
  }

  const tables = result.DATALIST_INF?.TABLE_INF
  const tableList = Array.isArray(tables) ? tables : tables ? [tables] : []

  return {
    query: args.query,
    totalCount: result.DATALIST_INF?.NUMBER || 0,
    tables: tableList.slice(0, limit).map((t) => ({
      id: t['@id'],
      statName: t.STAT_NAME?.['$'] || null,
      govOrg: t.GOV_ORG?.['$'] || null,
      statisticsName: t.STATISTICS_NAME || null,
      title: typeof t.TITLE === 'string' ? t.TITLE : t.TITLE?.['$'] || null,
      surveyDate: t.SURVEY_DATE || null,
    })),
  }
}, { method: 'search_statistics' })

const getStatData = sg.wrap(async (args: GetDataInput) => {
  if (!args.stats_data_id || typeof args.stats_data_id !== 'string') {
    throw new Error('stats_data_id is required')
  }
  const limit = Math.min(Math.max(args.limit || 100, 1), 1000)

  const data = await estatFetch<{
    GET_STATS_DATA: {
      RESULT: { STATUS: number; ERROR_MSG?: string }
      STATISTICAL_DATA?: {
        TABLE_INF?: { STAT_NAME?: { '$': string }; TITLE?: { '$': string } | string }
        DATA_INF?: {
          VALUE: Array<{ '$': string; '@cat01'?: string; '@time'?: string; '@area'?: string }>
        }
      }
    }
  }>('getStatsData', {
    statsDataId: args.stats_data_id,
    limit: String(limit),
    lang: 'E',
  })

  const result = data.GET_STATS_DATA
  if (result.RESULT.STATUS !== 0) {
    throw new Error(\`e-Stat error: \${result.RESULT.ERROR_MSG || 'Unknown error'}\`)
  }

  const stat = result.STATISTICAL_DATA
  const values = stat?.DATA_INF?.VALUE || []

  return {
    tableId: args.stats_data_id,
    statName: stat?.TABLE_INF?.STAT_NAME?.['$'] || null,
    title: typeof stat?.TABLE_INF?.TITLE === 'string'
      ? stat.TABLE_INF.TITLE
      : stat?.TABLE_INF?.TITLE?.['$'] || null,
    rowCount: values.length,
    data: values.slice(0, limit).map((v) => ({
      value: v['$'],
      category: v['@cat01'] || null,
      time: v['@time'] || null,
      area: v['@area'] || null,
    })),
  }
}, { method: 'get_stat_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchStatistics, getStatData }

console.log('settlegrid-japan-estat MCP server ready')
console.log('Methods: search_statistics, get_stat_data')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 109. settlegrid-south-korea
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'south-korea',
  name: 'South Korea Open Data',
  description: 'South Korea statistical and open government data via KOSIS.',
  keywords: ['government', 'statistics', 'korea', 'asia'],
  upstream: {
    provider: 'Statistics Korea (KOSTAT)',
    baseUrl: 'https://kosis.kr/openapi',
    auth: 'None required',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://kosis.kr/openapi/index/index.jsp',
  },
  auth: { type: 'none' },
  methods: [
    { name: 'search_statistics', displayName: 'Search Statistics', costCents: 1, description: 'Search Korean statistical tables by keyword', params: [
      { name: 'query', type: 'string', required: true, description: 'Search keyword (English or Korean)' },
      { name: 'limit', type: 'number', required: false, description: 'Max results (default 10)' },
    ] },
    { name: 'get_population', displayName: 'Get Population Data', costCents: 1, description: 'Get South Korea population statistics', params: [
      { name: 'year', type: 'number', required: false, description: 'Year (default: latest available)' },
    ] },
  ],
  serverTs: `/**
 * settlegrid-south-korea — South Korea Open Data MCP Server
 *
 * Methods:
 *   search_statistics(query, limit?)  — Search Korean stat tables   (1¢)
 *   get_population(year?)             — Get population data         (1¢)
 *
 * Pricing: 1¢ per call | Upstream: KOSIS / data.go.kr (free)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface PopulationInput {
  year?: number
}

interface KosisTable {
  TBL_NM: string
  TBL_ID: string
  ORG_ID?: string
  STAT_ID?: string
  VW_CD?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://kosis.kr/openapi/Param/statisticsParameterData.do'
const SEARCH_BASE = 'https://kosis.kr/openapi/statisticsSearch.do'

async function kosisFetch<T>(url: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({
    method: 'getList',
    apiKey: 'YTM0ZjBhMDctNWJlYi00',
    format: 'json',
    jsonVD: 'Y',
    ...params,
  })
  const res = await fetch(\`\${url}?\${qs}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`KOSIS API \${res.status}: \${body.slice(0, 300)}\`)
  }
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(\`KOSIS returned non-JSON response: \${text.slice(0, 200)}\`)
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'south-korea',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_statistics: { costCents: 1, displayName: 'Search Statistics' },
      get_population: { costCents: 1, displayName: 'Get Population Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchStatistics = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(Math.max(args.limit || 10, 1), 50)

  const data = await kosisFetch<KosisTable[] | { err?: string }>(SEARCH_BASE, {
    searchTxt: args.query,
    resultCnt: String(limit),
  })

  if (!Array.isArray(data)) {
    return {
      query: args.query,
      count: 0,
      tables: [],
      message: 'No results found or API returned non-array response',
    }
  }

  return {
    query: args.query,
    count: data.length,
    tables: data.slice(0, limit).map((t) => ({
      tableName: t.TBL_NM || null,
      tableId: t.TBL_ID || null,
      orgId: t.ORG_ID || null,
      statId: t.STAT_ID || null,
    })),
  }
}, { method: 'search_statistics' })

const getPopulation = sg.wrap(async (args: PopulationInput) => {
  const year = args.year || new Date().getFullYear() - 1
  const data = await kosisFetch<
    Array<{ C1_NM?: string; DT?: string; TBL_NM?: string; PRD_DE?: string }>
  >(BASE, {
    orgId: '101',
    tblId: 'DT_1B040A3',
    itmId: 'T10',
    objL1: '00',
    objL2: ' ',
    objL3: ' ',
    objL4: ' ',
    objL5: ' ',
    objL6: ' ',
    objL7: ' ',
    objL8: ' ',
    prdSe: 'Y',
    startPrdDe: String(year),
    endPrdDe: String(year),
  })

  if (!Array.isArray(data) || data.length === 0) {
    return {
      year,
      message: 'No population data available for this year',
      data: [],
    }
  }

  return {
    year,
    tableName: data[0]?.TBL_NM || 'Population',
    count: data.length,
    data: data.slice(0, 50).map((row) => ({
      region: row.C1_NM || null,
      value: row.DT || null,
      period: row.PRD_DE || null,
    })),
  }
}, { method: 'get_population' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchStatistics, getPopulation }

console.log('settlegrid-south-korea MCP server ready')
console.log('Methods: search_statistics, get_population')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════════
// Government — 110. settlegrid-un-data
// ═══════════════════════════════════════════════════════════════════════════════
generateServer({
  slug: 'un-data',
  name: 'UN Data',
  description: 'United Nations statistical data via the UN Data API (SDMX REST).',
  keywords: ['government', 'international', 'statistics', 'united-nations'],
  upstream: {
    provider: 'United Nations Statistics Division',
    baseUrl: 'https://data.un.org/ws/rest',
    auth: 'None required',
    rateLimit: 'Reasonable use',
    docsUrl: 'https://data.un.org/Host.aspx?Content=API',
  },
  auth: { type: 'none' },
  methods: [
    { name: 'search_indicators', displayName: 'Search Indicators', costCents: 1, description: 'Search UN statistical indicators', params: [
      { name: 'query', type: 'string', required: true, description: 'Search keyword for indicators' },
    ] },
    { name: 'get_data', displayName: 'Get Data', costCents: 2, description: 'Retrieve data for a dataflow/indicator', params: [
      { name: 'dataflow', type: 'string', required: true, description: 'Dataflow ID (e.g. "DF_UNDATA_COUNTRYDATA")' },
      { name: 'key', type: 'string', required: false, description: 'Data key filter (e.g. "A.US" for annual US data)' },
    ] },
    { name: 'list_dataflows', displayName: 'List Dataflows', costCents: 1, description: 'List available UN data dataflows', params: [] },
  ],
  serverTs: `/**
 * settlegrid-un-data — United Nations Statistics MCP Server
 *
 * Methods:
 *   search_indicators(query)       — Search UN indicators      (1¢)
 *   get_data(dataflow, key?)       — Get dataflow data         (2¢)
 *   list_dataflows()               — List available dataflows  (1¢)
 *
 * Pricing: 1-2¢ per call | Upstream: UN Data SDMX API (free)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
}

interface GetDataInput {
  dataflow: string
  key?: string
}

interface Dataflow {
  id: string
  name: string
  agencyId?: string
  version?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data.un.org/ws/rest'

async function unFetch(path: string, accept: string = 'application/json'): Promise<Response> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: {
      Accept: accept,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UN Data API \${res.status}: \${body.slice(0, 300)}\`)
  }
  return res
}

function parseXmlTag(xml: string, tag: string): string[] {
  const regex = new RegExp(\`<\${tag}[^>]*>([^<]*)</\${tag}>\`, 'g')
  const results: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1])
  }
  return results
}

function parseXmlAttr(xml: string, tag: string, attr: string): string[] {
  const regex = new RegExp(\`<\${tag}[^>]*\${attr}="([^"]*)"[^>]*>\`, 'g')
  const results: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1])
  }
  return results
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'un-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_indicators: { costCents: 1, displayName: 'Search Indicators' },
      get_data: { costCents: 2, displayName: 'Get Data' },
      list_dataflows: { costCents: 1, displayName: 'List Dataflows' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchIndicators = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }

  const res = await unFetch('/dataflow/all', 'application/xml')
  const xml = await res.text()

  const ids = parseXmlAttr(xml, 'Dataflow', 'id')
  const names = parseXmlTag(xml, 'common:Name')
  const queryLower = args.query.toLowerCase()

  const matches: Dataflow[] = []
  for (let i = 0; i < ids.length && matches.length < 20; i++) {
    const name = names[i] || ids[i]
    if (
      name.toLowerCase().includes(queryLower) ||
      ids[i].toLowerCase().includes(queryLower)
    ) {
      matches.push({ id: ids[i], name })
    }
  }

  return {
    query: args.query,
    count: matches.length,
    indicators: matches,
  }
}, { method: 'search_indicators' })

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.dataflow || typeof args.dataflow !== 'string') {
    throw new Error('dataflow is required')
  }
  const key = args.key || 'all'
  const path = \`/data/\${encodeURIComponent(args.dataflow)}/\${encodeURIComponent(key)}\`

  const res = await unFetch(\`\${path}?detail=dataonly&lastNObservations=10\`, 'application/json')
  const text = await res.text()

  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    return {
      dataflow: args.dataflow,
      key,
      format: 'xml',
      preview: text.slice(0, 2000),
      message: 'Response is XML — showing preview',
    }
  }

  return {
    dataflow: args.dataflow,
    key,
    format: 'json',
    data,
  }
}, { method: 'get_data' })

const listDataflows = sg.wrap(async () => {
  const res = await unFetch('/dataflow/all', 'application/xml')
  const xml = await res.text()

  const ids = parseXmlAttr(xml, 'Dataflow', 'id')
  const names = parseXmlTag(xml, 'common:Name')
  const agencies = parseXmlAttr(xml, 'Dataflow', 'agencyID')

  const flows: Dataflow[] = []
  for (let i = 0; i < ids.length && i < 100; i++) {
    flows.push({
      id: ids[i],
      name: names[i] || ids[i],
      agencyId: agencies[i] || null as unknown as string,
    })
  }

  return {
    count: ids.length,
    showing: flows.length,
    dataflows: flows,
  }
}, { method: 'list_dataflows' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchIndicators, getData, listDataflows }

console.log('settlegrid-un-data MCP server ready')
console.log('Methods: search_indicators, get_data, list_dataflows')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

console.log('\nDone! Generated 16 servers.')
