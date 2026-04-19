/**
 * settlegrid-elevenlabs — ElevenLabs MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.elevenlabs.io'

function getApiKey(): string {
  const k = process.env.ELEVENLABS_API_KEY
  if (!k) throw new Error('ELEVENLABS_API_KEY environment variable is required')
  return k
}

interface GetSpeechHistoryInput {
  page_size?: number
  voice_id?: string
  model_id?: string
  search?: string
  source?: string
  sort_direction?: string
}

interface GetHistoryItemInput {
  history_item_id: string
}

interface DeleteHistoryItemInput {
  history_item_id: string
}

interface GenerateSoundEffectInput {
  text: string
  duration_seconds?: number
  prompt_influence?: number
  output_format?: string
}

interface DownloadHistoryItemsInput {
  history_item_ids: string[]
}

const sg = settlegrid.init({
  toolSlug: 'elevenlabs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_speech_history: { costCents: 1, displayName: 'Get Speech History' },
      get_history_item: { costCents: 1, displayName: 'Get History Item' },
      delete_history_item: { costCents: 2, displayName: 'Delete History Item' },
      generate_sound_effect: { costCents: 8, displayName: 'Generate Sound Effect' },
      download_history_items: { costCents: 3, displayName: 'Download History Items' },
    },
  },
})

const getSpeechHistory = sg.wrap(async (args: GetSpeechHistoryInput) => {
  const apiKey = getApiKey()
  const pageSize = Math.min(args.page_size || 100, 1000)
  const params = new URLSearchParams()
  params.set('page_size', String(pageSize))
  if (args.voice_id) params.set('voice_id', args.voice_id)
  if (args.model_id) params.set('model_id', args.model_id)
  if (args.search) params.set('search', args.search)
  if (args.source && ['TTS', 'STS'].includes(args.source.toUpperCase())) {
    params.set('source', args.source.toUpperCase())
  }
  if (args.sort_direction && ['asc', 'desc'].includes(args.sort_direction.toLowerCase())) {
    params.set('sort_direction', args.sort_direction.toLowerCase())
  }
  const res = await fetch(`${BASE}/v1/history?${params.toString()}`, {
    headers: {
      'xi-api-key': apiKey,
      'User-Agent': 'settlegrid-elevenlabs/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ElevenLabs API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_speech_history' })

const getHistoryItem = sg.wrap(async (args: GetHistoryItemInput) => {
  const apiKey = getApiKey()
  const id = args.history_item_id?.trim()
  if (!id) throw new Error('history_item_id is required')
  const res = await fetch(`${BASE}/v1/history/${encodeURIComponent(id)}`, {
    headers: {
      'xi-api-key': apiKey,
      'User-Agent': 'settlegrid-elevenlabs/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ElevenLabs API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'get_history_item' })

const deleteHistoryItem = sg.wrap(async (args: DeleteHistoryItemInput) => {
  const apiKey = getApiKey()
  const id = args.history_item_id?.trim()
  if (!id) throw new Error('history_item_id is required')
  const res = await fetch(`${BASE}/v1/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
      'User-Agent': 'settlegrid-elevenlabs/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ElevenLabs API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}, { method: 'delete_history_item' })

const generateSoundEffect = sg.wrap(async (args: GenerateSoundEffectInput) => {
  const apiKey = getApiKey()
  const text = args.text?.trim()
  if (!text) throw new Error('text is required')
  const outputFormat = args.output_format || 'mp3_44100_128'
  const body: Record<string, unknown> = { text }
  if (args.duration_seconds !== undefined) {
    body.duration_seconds = Math.min(Math.max(args.duration_seconds, 0.5), 22)
  }
  if (args.prompt_influence !== undefined) {
    body.prompt_influence = Math.min(Math.max(args.prompt_influence, 0), 1)
  }
  const res = await fetch(`${BASE}/v1/sound-generation?output_format=${encodeURIComponent(outputFormat)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-elevenlabs/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ElevenLabs API ${res.status}: ${text.slice(0, 300)}`)
  }
  const audioBuffer = await res.arrayBuffer()
  const base64 = Buffer.from(audioBuffer).toString('base64')
  return {
    format: outputFormat,
    audio_base64: base64,
    size_bytes: audioBuffer.byteLength,
  }
}, { method: 'generate_sound_effect' })

const downloadHistoryItems = sg.wrap(async (args: DownloadHistoryItemsInput) => {
  const apiKey = getApiKey()
  if (!Array.isArray(args.history_item_ids) || args.history_item_ids.length === 0) {
    throw new Error('history_item_ids must be a non-empty array')
  }
  const ids = args.history_item_ids.slice(0, 50)
  const res = await fetch(`${BASE}/v1/history/download`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-elevenlabs/1.0',
    },
    body: JSON.stringify({ history_item_ids: ids }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ElevenLabs API ${res.status}: ${text.slice(0, 300)}`)
  }
  const contentType = res.headers.get('content-type') || ''
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return {
    content_type: contentType,
    item_count: ids.length,
    file_type: ids.length === 1 ? 'audio' : 'zip',
    data_base64: base64,
    size_bytes: buffer.byteLength,
  }
}, { method: 'download_history_items' })

export { getSpeechHistory, getHistoryItem, deleteHistoryItem, generateSoundEffect, downloadHistoryItems }
console.log('settlegrid-elevenlabs MCP server ready')
console.log('Methods: get_speech_history, get_history_item, delete_history_item, generate_sound_effect, download_history_items')
console.log('Pricing: 1-8¢ per call | Powered by SettleGrid')