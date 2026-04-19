/**
 * settlegrid-deepgram — Deepgram API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.deepgram.com'

function getApiKey(): string {
  const k = process.env.DEEPGRAM_API_KEY
  if (!k) throw new Error('DEEPGRAM_API_KEY environment variable is required')
  return k
}

interface TranscribeAudioInput {
  url: string
  model?: string
  language?: string
  punctuate?: boolean
  diarize?: boolean
}

interface SynthesizeSpeechInput {
  text: string
  model?: string
  encoding?: string
}

interface AnalyzeTextInput {
  url: string
  sentiment?: boolean
  summarize?: boolean
  topics?: boolean
  intents?: boolean
}

interface GetProjectInput {
  project_id: string
}

interface GetProjectUsageInput {
  project_id: string
  start?: string
  end?: string
}

interface ListProjectKeysInput {
  project_id: string
}

interface GetProjectBalancesInput {
  project_id: string
}

const sg = settlegrid.init({
  toolSlug: 'deepgram',
  pricing: {
    defaultCostCents: 1,
    methods: {
      transcribe_audio: { costCents: 5, displayName: 'Transcribe Audio' },
      synthesize_speech: { costCents: 5, displayName: 'Synthesize Speech' },
      analyze_text: { costCents: 5, displayName: 'Analyze Text/Audio' },
      list_projects: { costCents: 1, displayName: 'List Projects' },
      get_project: { costCents: 1, displayName: 'Get Project' },
      get_project_usage: { costCents: 1, displayName: 'Get Project Usage' },
      list_project_keys: { costCents: 1, displayName: 'List Project Keys' },
      get_project_balances: { costCents: 1, displayName: 'Get Project Balances' },
    },
  },
})

const transcribeAudio = sg.wrap(async (args: TranscribeAudioInput) => {
  const apiKey = getApiKey()
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const model = args.model || 'nova-2'
  const language = args.language || 'en'
  const punctuate = args.punctuate !== false
  const diarize = args.diarize === true
  const params = new URLSearchParams({
    model,
    language,
    punctuate: String(punctuate),
    diarize: String(diarize),
  })
  const res = await fetch(`${BASE}/v1/listen?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  const data = await res.json() as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript: string; confidence: number; words?: unknown[] }>
      }>
    }
    metadata?: unknown
  }
  const channel = data.results?.channels?.[0]
  const alternative = channel?.alternatives?.[0]
  return {
    transcript: alternative?.transcript ?? '',
    confidence: alternative?.confidence ?? 0,
    words: alternative?.words ?? [],
    metadata: data.metadata,
  }
}, { method: 'transcribe_audio' })

const synthesizeSpeech = sg.wrap(async (args: SynthesizeSpeechInput) => {
  const apiKey = getApiKey()
  const text = args.text?.trim()
  if (!text) throw new Error('text is required')
  const truncatedText = text.slice(0, 2000)
  const model = args.model || 'aura-asteria-en'
  const encoding = args.encoding || 'mp3'
  const params = new URLSearchParams({ model, encoding })
  const res = await fetch(`${BASE}/v1/speak?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
    body: JSON.stringify({ text: truncatedText }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram TTS API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  const contentType = res.headers.get('content-type') || encoding
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return {
    encoding,
    model,
    contentType,
    audioBase64: base64,
    byteLength: buffer.byteLength,
    characterCount: truncatedText.length,
  }
}, { method: 'synthesize_speech' })

const analyzeText = sg.wrap(async (args: AnalyzeTextInput) => {
  const apiKey = getApiKey()
  const url = args.url?.trim()
  if (!url) throw new Error('url is required')
  const params = new URLSearchParams()
  if (args.sentiment) params.set('sentiment', 'true')
  if (args.summarize) params.set('summarize', 'v2')
  if (args.topics) params.set('topics', 'true')
  if (args.intents) params.set('intents', 'true')
  const res = await fetch(`${BASE}/v1/read?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram Read API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'analyze_text' })

const listProjects = sg.wrap(async (_args: Record<string, never>) => {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}/v1/projects`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'list_projects' })

const getProject = sg.wrap(async (args: GetProjectInput) => {
  const apiKey = getApiKey()
  const projectId = args.project_id?.trim()
  if (!projectId) throw new Error('project_id is required')
  const res = await fetch(`${BASE}/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_project' })

const getProjectUsage = sg.wrap(async (args: GetProjectUsageInput) => {
  const apiKey = getApiKey()
  const projectId = args.project_id?.trim()
  if (!projectId) throw new Error('project_id is required')
  const params = new URLSearchParams()
  if (args.start) params.set('start', args.start)
  if (args.end) params.set('end', args.end)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`${BASE}/v1/projects/${encodeURIComponent(projectId)}/usage${query}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_project_usage' })

const listProjectKeys = sg.wrap(async (args: ListProjectKeysInput) => {
  const apiKey = getApiKey()
  const projectId = args.project_id?.trim()
  if (!projectId) throw new Error('project_id is required')
  const res = await fetch(`${BASE}/v1/projects/${encodeURIComponent(projectId)}/keys`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'list_project_keys' })

const getProjectBalances = sg.wrap(async (args: GetProjectBalancesInput) => {
  const apiKey = getApiKey()
  const projectId = args.project_id?.trim()
  if (!projectId) throw new Error('project_id is required')
  const res = await fetch(`${BASE}/v1/projects/${encodeURIComponent(projectId)}/balances`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'User-Agent': 'settlegrid-deepgram/1.0',
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Deepgram API error ${res.status}: ${errText.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_project_balances' })

export {
  transcribeAudio,
  synthesizeSpeech,
  analyzeText,
  listProjects,
  getProject,
  getProjectUsage,
  listProjectKeys,
  getProjectBalances,
}

console.log('settlegrid-deepgram MCP server ready')
console.log('Methods: transcribe_audio, synthesize_speech, analyze_text, list_projects, get_project, get_project_usage, list_project_keys, get_project_balances')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')