/**
 * settlegrid-whisper-api — OpenAI Whisper MCP Server
 *
 * Audio transcription and translation via the OpenAI Whisper API.
 *
 * Methods:
 *   transcribe_audio(url, language) — Transcribe audio file to text via Whisper  (5¢)
 *   translate_audio(url)          — Translate audio to English text via Whisper  (5¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TranscribeAudioInput {
  url: string
  language?: string
}

interface TranslateAudioInput {
  url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.openai.com/v1/audio'
const API_KEY = process.env.OPENAI_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-whisper-api/1.0', Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenAI Whisper API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
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

const transcribeAudio = sg.wrap(async (args: TranscribeAudioInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const data = await apiFetch<any>(`/transcriptions`)
  return {
    text: data.text,
  }
}, { method: 'transcribe_audio' })

const translateAudio = sg.wrap(async (args: TranslateAudioInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/translations`)
  return {
    text: data.text,
  }
}, { method: 'translate_audio' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { transcribeAudio, translateAudio }

console.log('settlegrid-whisper-api MCP server ready')
console.log('Methods: transcribe_audio, translate_audio')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')
