/**
 * settlegrid-assemblyai — AssemblyAI MCP Server
 *
 * Wraps the AssemblyAI API with SettleGrid billing.
 * Requires ASSEMBLYAI_API_KEY environment variable.
 *
 * Methods:
 *   create_transcript(audio_url)             (5¢)
 *   get_transcript(id)                       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateTranscriptInput {
  audio_url: string
  language_code?: string
}

interface GetTranscriptInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.assemblyai.com/v2'
const USER_AGENT = 'settlegrid-assemblyai/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) throw new Error('ASSEMBLYAI_API_KEY environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'authorization': `${getApiKey()}`,
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AssemblyAI API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'assemblyai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      create_transcript: { costCents: 5, displayName: 'Submit audio URL for transcription' },
      get_transcript: { costCents: 1, displayName: 'Get transcription result' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const createTranscript = sg.wrap(async (args: CreateTranscriptInput) => {
  if (!args.audio_url || typeof args.audio_url !== 'string') {
    throw new Error('audio_url is required (url of audio file to transcribe)')
  }

  const body: Record<string, unknown> = {}
  body['audio_url'] = args.audio_url
  if (args.language_code !== undefined) body['language_code'] = args.language_code

  const data = await apiFetch<Record<string, unknown>>('/transcript', {
    method: 'POST',
    body,
  })

  return data
}, { method: 'create_transcript' })

const getTranscript = sg.wrap(async (args: GetTranscriptInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (transcript id)')
  }

  const params: Record<string, string> = {}
  params['id'] = String(args.id)

  const data = await apiFetch<Record<string, unknown>>(`/transcript/${encodeURIComponent(String(args.id))}`, {
    params,
  })

  return data
}, { method: 'get_transcript' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { createTranscript, getTranscript }

console.log('settlegrid-assemblyai MCP server ready')
console.log('Methods: create_transcript, get_transcript')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')
